import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, assertOwnership, attachUserInfo, paginate } from 'src/common/query';
import { PublishStatusEnum } from '@nest-acticle/shared';
import { PostCollectionEntity } from './entities/collection.entity';
import { PostCollectionArticleEntity } from './entities/collection-article.entity';
import { PostCollectionSubEntity } from './entities/collection-sub.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { UserDto } from 'src/module/system/user/user.decorator';
import {
  ListAdminCollectionDto,
  ListCollectionArticleDto,
  ListGuestCollectionDto,
  ListGuestSubDto,
  ListReceivedCollectDto,
  SaveCollectionDto,
} from './dto/index';

/** 默认收藏夹固定名称（每用户初始自带，标识以 is_default 列为准，改名不影响逻辑） */
export const DEFAULT_COLLECTION_NAME = '默认收藏夹';

/**
 * 收藏集服务
 * 收藏/移出、订阅/退订统一走事务并同步维护计数：
 * - 集内文章数 article_count 与文章收藏数 post_article.collect_num 双计数
 * - 订阅数 subscriber_count
 * 写路径幂等：INSERT IGNORE + 唯一索引（uk_collection_article / uk_collection_user），并发重复动作静默忽略
 * 可见性口径：私密收藏集仅创建者可见（guest 端点按可选登录态识别），通知列表只回公开收藏集
 */
@Injectable()
export class PostCollectionService {
  private readonly logger = new Logger(PostCollectionService.name);

  constructor(
    @InjectRepository(PostCollectionEntity)
    private readonly collectionRepo: Repository<PostCollectionEntity>,
    @InjectRepository(PostCollectionArticleEntity)
    private readonly relationRepo: Repository<PostCollectionArticleEntity>,
    @InjectRepository(PostCollectionSubEntity)
    private readonly subRepo: Repository<PostCollectionSubEntity>,
    @InjectRepository(PostArticleEntity)
    private readonly articleRepo: Repository<PostArticleEntity>,
  ) {}

  /**
   * 收藏集是否对当前请求者可见：私密集仅创建者（或管理员）可见
   */
  private canView(collection: PostCollectionEntity, user?: UserDto): boolean {
    if (collection.visibility !== '1') {
      return true;
    }
    if (!user?.userId) {
      return false;
    }
    return collection.userId === user.userId || user.roles?.includes('admin');
  }

  /**
   * 确保用户存在默认收藏夹（惰性补建：注册钩子之外，覆盖历史存量用户首次触达收藏功能的场景）
   * INSERT IGNORE + uk_user_default 唯一索引（null 不参与唯一约束）：并发首次触发只落一行，天然幂等
   */
  async ensureDefaultCollection(userId: number) {
    const existing = await this.collectionRepo.findOne({
      where: { userId, isDefault: '1', delFlag: '0' },
      select: ['id'],
    });
    if (existing) {
      return;
    }
    await this.collectionRepo.manager.query(
      'INSERT IGNORE INTO post_collection (user_id, name, `desc`, visibility, is_default) VALUES (?, ?, NULL, ?, ?)',
      [userId, DEFAULT_COLLECTION_NAME, '0', '1'],
    );
    this.logger.log(`用户 ${userId} 补建默认收藏夹`);
  }

  /**
   * 新建收藏集
   */
  async create(dto: SaveCollectionDto, user: UserDto) {
    const collection = await this.collectionRepo.save({
      userId: user.userId,
      name: dto.name,
      desc: dto.desc ?? null,
      visibility: dto.visibility ?? '0',
    });
    this.logger.log(`用户 ${user.userId} 新建收藏集 ${collection.id}「${collection.name}」`);
    return ResultData.ok(collection);
  }

  /**
   * 更新收藏集（补丁式，仅创建者）
   */
  async update(dto: SaveCollectionDto, user: UserDto) {
    if (!dto.id) {
      throw new BusinessException(500, '收藏集不存在');
    }
    const collection = await this.collectionRepo.findOne({ where: { id: dto.id, delFlag: '0' } });
    if (!collection) {
      throw new BusinessException(500, '收藏集不存在');
    }
    if (!assertOwnership(user, collection)) {
      throw new BusinessException(403, '无权修改此收藏集');
    }

    const patch: Partial<PostCollectionEntity> = {};
    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    if (dto.desc !== undefined) {
      patch.desc = dto.desc;
    }
    if (dto.visibility !== undefined) {
      patch.visibility = dto.visibility;
    }
    await this.collectionRepo.update(collection.id, patch);
    return ResultData.ok();
  }

  /**
   * 删除收藏集（软删集行，物理清理收藏/订阅关系并回减文章收藏数）
   */
  async remove(id: number, user: UserDto) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const collection = await manager.findOne(PostCollectionEntity, { where: { id, delFlag: '0' } });
      if (!collection) {
        throw new BusinessException(500, '收藏集不存在');
      }
      if (!assertOwnership(user, collection)) {
        throw new BusinessException(403, '无权删除此收藏集');
      }
      if (collection.isDefault === '1') {
        throw new BusinessException(500, '默认收藏夹不可删除');
      }

      await this.purgeCollection(manager, id);
      this.logger.log(`用户 ${user.userId} 删除收藏集 ${id}「${collection.name}」`);
      return ResultData.ok();
    });
  }

  /**
   * 收藏集删除的公共清理：软删集行 + 物理清收藏/订阅关系 + 按文章聚合 GREATEST 回减 collect_num
   * 前台删除与管理端批量删除共用；调用方负责归属校验与事务
   */
  private async purgeCollection(manager: any, id: number) {
    await manager.update(PostCollectionEntity, id, { delFlag: '1' });

    const rows = await manager.find(PostCollectionArticleEntity, { where: { collectionId: id } });
    if (rows.length) {
      await manager.delete(PostCollectionArticleEntity, { collectionId: id });
      const countByArticle = new Map<number, number>();
      rows.forEach((row) => countByArticle.set(row.articleId, (countByArticle.get(row.articleId) || 0) + 1));
      for (const [articleId, count] of countByArticle) {
        await manager
          .createQueryBuilder()
          .update(PostArticleEntity)
          .set({ collectNum: () => `GREATEST(collect_num - ${count}, 0)` })
          .where('id = :id', { id: articleId })
          .execute();
      }
    }

    await manager.delete(PostCollectionSubEntity, { collectionId: id });
    return rows.length;
  }

  /**
   * 收藏进集（幂等：已收录直接返回当前状态）
   * 仅创建者可往自己的收藏集收录已发布文章，命中插入时 article_count 与文章 collect_num 双计数
   */
  async collect(collectionId: number, articleId: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const collection = await manager.findOne(PostCollectionEntity, { where: { id: collectionId, delFlag: '0' } });
      if (!collection) {
        throw new BusinessException(500, '收藏集不存在');
      }
      if (collection.userId !== userId) {
        throw new BusinessException(403, '只能往自己的收藏集收录文章');
      }
      const article = await manager.findOne(PostArticleEntity, {
        where: { id: articleId, delFlag: '0', publishStatus: PublishStatusEnum.PUBLISHED },
        select: ['id', 'collectNum'],
      });
      if (!article) {
        throw new BusinessException(500, '文章不存在或未发布');
      }

      // 参数化 INSERT IGNORE + 唯一索引 uk_collection_article：并发重复收藏静默忽略（affectedRows=0 表示已收藏过）
      // collect_num 口径为「收藏关系条数」而非「去重人数」：同一文章被收进 N 个收藏集即计 N
      // （不像 like_num 一人一文一条天然去重），uncollect / 清集 / 删集对称回减，账目自洽；
      // 展示语义是「被收藏次数」，跨收藏集的重复收录按次累加属预期行为
      const inserted: any = await manager.query(
        'INSERT IGNORE INTO post_collection_article (collection_id, article_id, user_id) VALUES (?, ?, ?)',
        [collectionId, articleId, userId],
      );
      if (inserted?.affectedRows) {
        await manager.increment(PostCollectionEntity, { id: collectionId }, 'articleCount', 1);
        await manager.increment(PostArticleEntity, { id: articleId }, 'collectNum', 1);
      }

      const fresh = await manager.findOne(PostCollectionEntity, { where: { id: collectionId }, select: ['articleCount'] });
      return ResultData.ok({ collected: true, articleCount: fresh?.articleCount ?? collection.articleCount });
    });
  }

  /**
   * 移出收藏（幂等：未收录直接返回当前状态）
   */
  async uncollect(collectionId: number, articleId: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const collection = await manager.findOne(PostCollectionEntity, { where: { id: collectionId, delFlag: '0' } });
      if (!collection) {
        throw new BusinessException(500, '收藏集不存在');
      }
      if (collection.userId !== userId) {
        throw new BusinessException(403, '只能操作自己的收藏集');
      }

      const removed = await manager.delete(PostCollectionArticleEntity, { collectionId, articleId });
      if (!removed.affected) {
        return ResultData.ok({ collected: false, articleCount: collection.articleCount });
      }

      // 双计数回减，下限 0 防计数漂移
      await manager
        .createQueryBuilder()
        .update(PostCollectionEntity)
        .set({ articleCount: () => 'GREATEST(article_count - 1, 0)' })
        .where('id = :id', { id: collectionId })
        .execute();
      await manager
        .createQueryBuilder()
        .update(PostArticleEntity)
        .set({ collectNum: () => 'GREATEST(collect_num - 1, 0)' })
        .where('id = :id', { id: articleId })
        .execute();

      const fresh = await manager.findOne(PostCollectionEntity, { where: { id: collectionId }, select: ['articleCount'] });
      return ResultData.ok({ collected: false, articleCount: fresh?.articleCount ?? Math.max(0, collection.articleCount - 1) });
    });
  }

  /**
   * 订阅收藏集（幂等：已订阅直接返回当前状态；私密收藏集不可订阅）
   * 不能订阅自己创建的收藏集：订阅是「关注他人动态」语义，自订阅只会让
   * subscriber_count 虚高、自己的空间页「我订阅的」混入自己的收藏集
   */
  async subscribe(collectionId: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const collection = await manager.findOne(PostCollectionEntity, { where: { id: collectionId, delFlag: '0' } });
      if (!collection) {
        throw new BusinessException(500, '收藏集不存在');
      }
      if (collection.visibility === '1') {
        throw new BusinessException(500, '私密收藏集不可订阅');
      }
      if (collection.userId === userId) {
        throw new BusinessException(400, '不能订阅自己的收藏集');
      }

      const inserted: any = await manager.query(
        'INSERT IGNORE INTO post_collection_sub (collection_id, user_id) VALUES (?, ?)',
        [collectionId, userId],
      );
      if (inserted?.affectedRows) {
        await manager.increment(PostCollectionEntity, { id: collectionId }, 'subscriberCount', 1);
      }

      const fresh = await manager.findOne(PostCollectionEntity, { where: { id: collectionId }, select: ['subscriberCount'] });
      return ResultData.ok({ subscribed: true, subscriberCount: fresh?.subscriberCount ?? collection.subscriberCount });
    });
  }

  /**
   * 退订收藏集（幂等：未订阅直接返回当前状态）
   */
  async unsubscribe(collectionId: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const collection = await manager.findOne(PostCollectionEntity, { where: { id: collectionId, delFlag: '0' } });
      if (!collection) {
        throw new BusinessException(500, '收藏集不存在');
      }

      const removed = await manager.delete(PostCollectionSubEntity, { collectionId, userId });
      if (removed.affected) {
        await manager
          .createQueryBuilder()
          .update(PostCollectionEntity)
          .set({ subscriberCount: () => 'GREATEST(subscriber_count - 1, 0)' })
          .where('id = :id', { id: collectionId })
          .execute();
      }

      const fresh = await manager.findOne(PostCollectionEntity, { where: { id: collectionId }, select: ['subscriberCount'] });
      return ResultData.ok({ subscribed: false, subscriberCount: fresh?.subscriberCount ?? collection.subscriberCount });
    });
  }

  /**
   * 当前用户对文章的收藏状态：我的全部收藏集 + 各自 collected 布尔（收藏弹窗数据源，一集一文勾选）
   * 打开弹窗顺手补建默认收藏夹；默认收藏夹排最前
   */
  async status(articleId: number, userId: number) {
    await this.ensureDefaultCollection(userId);

    const entity = this.collectionRepo.createQueryBuilder('collection');
    entity
      .leftJoin(PostCollectionArticleEntity, 'relation', 'relation.collectionId = collection.id AND relation.articleId = :articleId', {
        articleId,
      })
      .addSelect('relation.id')
      .where('collection.userId = :userId', { userId })
      .andWhere('collection.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('collection.isDefault', 'DESC')
      .addOrderBy('collection.updateTime', 'DESC');

    const { raw, entities } = await entity.getRawAndEntities();

    // raw 键格式为「别名_列名」；relation 命中行说明该文章已在此收藏集中
    const collectedIds = new Set(raw.filter((row: Record<string, any>) => row.relation_id).map((row: Record<string, any>) => row.collection_id));
    const list = entities.map((item) => ({
      id: item.id,
      name: item.name,
      visibility: item.visibility,
      isDefault: item.isDefault === '1',
      collected: collectedIds.has(item.id),
    }));

    return ResultData.ok(list);
  }

  /**
   * 指定用户的收藏集列表（个人空间收藏集栏，本人/访客共用 guest/list）
   * 可选登录识别创建者本人：本人含私密（前端锁图标），他人仅公开；本人视角顺手补建默认收藏夹
   * 默认收藏夹置顶，其余按最近更新在前
   */
  async findGuestList(query: ListGuestCollectionDto, user?: UserDto) {
    const isOwnerView = !!user?.userId && (user.userId === query.userId || user.roles?.includes('admin'));
    if (isOwnerView) {
      await this.ensureDefaultCollection(query.userId);
    }

    const entity = this.collectionRepo.createQueryBuilder('collection');
    entity.where('collection.userId = :userId', { userId: query.userId }).andWhere('collection.delFlag = :delFlag', { delFlag: '0' });

    if (!isOwnerView) {
      entity.andWhere('collection.visibility = :visibility', { visibility: '0' });
    }

    paginate(entity, query);
    entity.orderBy('collection.isDefault', 'DESC').addOrderBy('collection.updateTime', 'DESC');

    const [list, total] = await entity.getManyAndCount();
    const rows = await attachUserInfo(
      list.map((item) => ({
        id: item.id,
        name: item.name,
        desc: item.desc,
        visibility: item.visibility,
        isDefault: item.isDefault === '1',
        articleCount: item.articleCount,
        subscriberCount: item.subscriberCount,
        userId: item.userId,
        createTime: item.createTime,
        updateTime: item.updateTime,
      })),
      this.collectionRepo.manager.getRepository(UserEntity),
    );

    return ResultData.ok({ list: rows, total });
  }

  /**
   * 收藏集详情（guest/detail，可选登录）：创建者信息 + 我是否已订阅 + 是否本人
   */
  async findGuestDetail(id: number, user?: UserDto) {
    const collectionId = Number(id);
    if (!collectionId) {
      throw new BusinessException(500, '收藏集不存在');
    }
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId, delFlag: '0' } });
    if (!collection || !this.canView(collection, user)) {
      throw new BusinessException(500, '收藏集不存在');
    }

    const [userInfoRow] = await attachUserInfo([collection], this.collectionRepo.manager.getRepository(UserEntity));
    const isMine = !!user?.userId && user.userId === collection.userId;
    const isSubscribed = user?.userId
      ? !!(await this.subRepo.findOne({ where: { collectionId: collection.id, userId: user.userId }, select: ['id'] }))
      : false;

    return ResultData.ok({
      id: collection.id,
      name: collection.name,
      desc: collection.desc,
      visibility: collection.visibility,
      isDefault: collection.isDefault === '1',
      articleCount: collection.articleCount,
      subscriberCount: collection.subscriberCount,
      userId: collection.userId,
      createTime: collection.createTime,
      updateTime: collection.updateTime,
      userInfo: userInfoRow.userInfo,
      isMine,
      isSubscribed,
    });
  }

  /**
   * 收藏集内文章列表（guest/articles）：已发布文章按收藏时间倒序，私密集仅创建者可见
   * 行形状对齐 shared 的 CollectionArticleItem（文章公开字段 + collectTime）
   */
  async findGuestArticles(query: ListCollectionArticleDto, user?: UserDto) {
    const collection = await this.collectionRepo.findOne({ where: { id: query.collectionId, delFlag: '0' } });
    if (!collection || !this.canView(collection, user)) {
      throw new BusinessException(500, '收藏集不存在');
    }

    const entity = this.relationRepo.createQueryBuilder('relation');
    entity
      .innerJoin(PostArticleEntity, 'article', 'article.id = relation.articleId')
      .leftJoin(UserEntity, 'user', 'user.userId = article.userId')
      .addSelect([
        'article.id',
        'article.title',
        'article.desc',
        'article.cover',
        'article.author',
        'article.userId',
        'article.readNum',
        'article.likeNum',
        'article.collectNum',
        'article.commentNum',
        'article.publishTime',
        'article.createTime',
        'user.nickName',
      ])
      .where('relation.collectionId = :collectionId', { collectionId: query.collectionId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });

    applyLike(entity, 'article.title', query.title);

    paginate(entity, query);
    entity.orderBy('relation.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」；author 空时回退文章作者的昵称
    const list = raw.map((row: Record<string, any>) => ({
      id: row.article_id,
      title: row.article_title,
      desc: row.article_desc,
      cover: row.article_cover,
      author: row.article_author || row.user_nick_name || '',
      userId: row.article_user_id,
      readNum: row.article_read_num,
      likeNum: row.article_like_num,
      collectNum: row.article_collect_num,
      commentNum: row.article_comment_num,
      publishTime: row.article_publish_time,
      createTime: row.article_create_time,
      collectTime: row.relation_create_time,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 指定用户订阅的收藏集列表（guest/subscribed：我订阅的/他人的订阅列表，本人/访客共用）
   * 只回公开收藏集（私密集不建立订阅关系，转私密后也从此隐藏），按订阅时间倒序
   */
  async findGuestSubscribed(query: ListGuestSubDto) {
    const entity = this.subRepo.createQueryBuilder('sub');
    entity
      .innerJoin(PostCollectionEntity, 'collection', 'collection.id = sub.collectionId')
      .addSelect([
        'collection.id',
        'collection.name',
        'collection.desc',
        'collection.visibility',
        'collection.articleCount',
        'collection.subscriberCount',
        'collection.userId',
        'collection.createTime',
        'collection.updateTime',
      ])
      .where('sub.userId = :userId', { userId: query.userId })
      .andWhere('collection.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('collection.visibility = :visibility', { visibility: '0' });

    paginate(entity, query);
    entity.orderBy('sub.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」
    const rows = raw.map((row: Record<string, any>) => ({
      id: row.collection_id,
      name: row.collection_name,
      desc: row.collection_desc,
      visibility: row.collection_visibility,
      articleCount: row.collection_article_count,
      subscriberCount: row.collection_subscriber_count,
      userId: row.collection_user_id,
      createTime: row.collection_create_time,
      updateTime: row.collection_update_time,
    }));

    const list = await attachUserInfo(rows, this.collectionRepo.manager.getRepository(UserEntity));
    return ResultData.ok({ list, total });
  }

  /**
   * 收到的收藏（通知中心赞和收藏栏：他人把我的已发布文章收进 ta 的公开收藏集），最新在前
   * 私密收藏集不产生通知行；自己收录自己的文章不算接收通知
   */
  async findReceivedList(userId: number, query: ListReceivedCollectDto) {
    const entity = this.relationRepo.createQueryBuilder('relation');
    entity
      .innerJoin(PostArticleEntity, 'article', 'article.id = relation.articleId')
      .innerJoin(PostCollectionEntity, 'collection', 'collection.id = relation.collectionId')
      .leftJoin(UserEntity, 'collector', 'collector.userId = relation.userId')
      .addSelect(['article.id', 'article.title', 'article.cover', 'collection.id', 'collection.name', 'collector.nickName', 'collector.avatar'])
      .where('article.userId = :userId', { userId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED })
      .andWhere('relation.userId <> :userId', { userId })
      .andWhere('collection.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('collection.visibility = :visibility', { visibility: '0' });

    applyLike(entity, 'article.title', query.title);

    paginate(entity, query);
    entity.orderBy('relation.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」（非实体属性名）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.relation_id,
      userId: row.relation_user_id,
      nickName: row.collector_nick_name || '',
      avatar: row.collector_avatar || null,
      collectionId: row.collection_id,
      collectionName: row.collection_name || null,
      articleId: row.article_id,
      articleTitle: row.article_title || null,
      articleCover: row.article_cover || null,
      createTime: row.relation_create_time,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 收藏集管理列表（管理端，联创建者昵称；私密集同样可见，软删行不展示）
   * 取数走 getRawAndEntities：collection 实体 + join 出的用户昵称手动拼平
   */
  async findAdminList(query: ListAdminCollectionDto) {
    const entity = this.collectionRepo.createQueryBuilder('collection');
    entity
      .leftJoin(UserEntity, 'user', 'user.userId = collection.userId')
      .addSelect(['user.userId', 'user.nickName'])
      .where('collection.delFlag = :delFlag', { delFlag: '0' });

    applyLike(entity, 'collection.name', query.name);
    applyLike(entity, 'user.nickName', query.nickName);

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('collection.createTime BETWEEN :start AND :end', {
        start: query.params.beginTime,
        end: query.params.endTime,
      });
    }

    paginate(entity, query);

    entity.orderBy('collection.createTime', 'DESC');

    const { raw, entities } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」
    const nickNameById = new Map(raw.map((row: Record<string, any>) => [row.collection_id, row.user_nick_name]));
    const list = entities.map((item) => ({
      id: item.id,
      userId: item.userId,
      name: item.name,
      desc: item.desc,
      visibility: item.visibility,
      isDefault: item.isDefault === '1',
      articleCount: item.articleCount,
      subscriberCount: item.subscriberCount,
      createTime: item.createTime,
      updateTime: item.updateTime,
      nickName: nickNameById.get(item.id) || '',
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 管理端批量删除收藏集：逐个走 purgeCollection 清理（不存在的跳过），同步回减文章收藏数
   * 默认收藏夹不可删除，命中即跳过（保留夹子与其收藏关系）
   */
  async removeByIds(ids: number[]) {
    return this.articleRepo.manager.transaction(async (manager) => {
      let purged = 0;
      let skippedDefault = 0;
      let relationCount = 0;
      for (const id of ids) {
        const collection = await manager.findOne(PostCollectionEntity, { where: { id, delFlag: '0' } });
        if (!collection) {
          continue;
        }
        if (collection.isDefault === '1') {
          skippedDefault++;
          continue;
        }
        relationCount += await this.purgeCollection(manager, id);
        purged++;
      }

      this.logger.log(
        `管理员批量删除收藏集 ${purged}/${ids.length} 个，清理收藏关系 ${relationCount} 条${skippedDefault ? `，跳过默认收藏夹 ${skippedDefault} 个` : ''}`,
      );
      // 返回实际结果：默认收藏夹跳过不是成功也不是失败，管理端据此区分提示，不再一律「删除成功」
      return ResultData.ok({ purged, skippedDefault });
    });
  }
}
