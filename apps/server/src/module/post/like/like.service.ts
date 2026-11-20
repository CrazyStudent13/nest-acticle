import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { applyLike, paginate } from 'src/common/query';
import { PublishStatusEnum, SortRuleEnum } from '@nest-acticle/shared';
import { PostLikeEntity } from './entities/like.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { ListLikeDto, ListMyLikeDto } from './dto/index';

/**
 * 点赞服务
 * 写路径（点赞/取消/管理删除）统一走事务，同步维护 post_article.like_num 计数
 */
@Injectable()
export class PostLikeService {
  private readonly logger = new Logger(PostLikeService.name);

  constructor(
    @InjectRepository(PostLikeEntity)
    private readonly likeRepo: Repository<PostLikeEntity>,
    @InjectRepository(PostArticleEntity)
    private readonly articleRepo: Repository<PostArticleEntity>,
  ) {}

  /**
   * 点赞（幂等：已点赞直接返回当前状态）
   * 仅已发布文章可点赞
   */
  async like(articleId: number, userId: number) {
    const result = await this.articleRepo.manager.transaction(async (manager) => {
      const article = await manager.findOne(PostArticleEntity, {
        where: { id: articleId, delFlag: '0', publishStatus: PublishStatusEnum.PUBLISHED },
      });
      if (!article) {
        return ResultData.fail(500, '文章不存在或未发布');
      }

      // 参数化 INSERT IGNORE + 唯一索引：并发重复点赞静默忽略，天然幂等（affectedRows=0 表示已赞过）
      // 不用 query builder 的 orIgnore：TypeORM 0.3 对实体插入被忽略时仍回写自增 id，会抛错
      const inserted: any = await manager.query('INSERT IGNORE INTO post_like (article_id, user_id) VALUES (?, ?)', [
        articleId,
        userId,
      ]);
      if (inserted?.affectedRows) {
        await manager.increment(PostArticleEntity, { id: articleId }, 'likeNum', 1);
      }

      // 回读最新计数，避免并发下返回过期值
      const fresh = await manager.findOne(PostArticleEntity, { where: { id: articleId }, select: ['likeNum'] });
      return ResultData.ok({ liked: true, likeNum: fresh?.likeNum ?? article.likeNum });
    });
    return result;
  }

  /**
   * 取消点赞（幂等：未点赞直接返回当前状态）
   */
  async unlike(articleId: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const article = await manager.findOne(PostArticleEntity, {
        where: { id: articleId, delFlag: '0' },
      });
      if (!article) {
        return ResultData.fail(500, '文章不存在');
      }

      const removed = await manager.delete(PostLikeEntity, { articleId, userId });
      if (!removed.affected) {
        return ResultData.ok({ liked: false, likeNum: article.likeNum });
      }

      // 下限 0，防计数漂移后减成负数
      await manager
        .createQueryBuilder()
        .update(PostArticleEntity)
        .set({ likeNum: () => 'GREATEST(like_num - 1, 0)' })
        .where('id = :id', { id: articleId })
        .execute();
      const fresh = await manager.findOne(PostArticleEntity, { where: { id: articleId }, select: ['likeNum'] });
      return ResultData.ok({ liked: false, likeNum: fresh?.likeNum ?? Math.max(0, article.likeNum - 1) });
    });
  }

  /**
   * 当前用户对文章的点赞状态
   */
  async status(articleId: number, userId: number) {
    const liked = await this.likeRepo.findOne({
      where: { articleId, userId },
      select: ['id'],
    });
    return ResultData.ok({ liked: !!liked });
  }

  /**
   * 指定用户的点赞文章列表（个人空间点赞栏，本人/访客共用 guest/list）
   * 排序按点赞时间；行形状对齐 shared 的 LikedArticleItem（文章公开字段 + likeTime）
   */
  async findUserList(userId: number, query: ListMyLikeDto) {
    const entity = this.likeRepo.createQueryBuilder('like');
    entity
      .leftJoin(PostArticleEntity, 'article', 'article.id = like.articleId')
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
        'article.commentNum',
        'article.publishTime',
        'article.createTime',
        'user.nickName',
      ])
      .where('like.userId = :userId', { userId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });

    applyLike(entity, 'article.title', query.title);

    paginate(entity, query);

    // 排序方向：ascending → 升序，其余（descending 或未传）→ 降序；isAsc 在 DTO 层已被 @IsEnum(SortRuleEnum) 约束，非枚举值进不到这里
    entity.orderBy('like.createTime', query.isAsc === SortRuleEnum.ASCENDING ? 'ASC' : 'DESC');

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
      commentNum: row.article_comment_num,
      publishTime: row.article_publish_time,
      createTime: row.article_create_time,
      likeTime: row.like_create_time,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 收到的赞（通知中心：他人点赞我发布的文章），联点赞人公开信息与文章标题封面，最新在前
   * 只取已发布未删除的文章；自己给自己点的赞不算接收通知
   */
  async findReceivedList(userId: number, query: ListMyLikeDto) {
    const entity = this.likeRepo.createQueryBuilder('like');
    entity
      .innerJoin(PostArticleEntity, 'article', 'article.id = like.articleId')
      .leftJoin(UserEntity, 'liker', 'liker.userId = like.userId')
      .addSelect(['article.id', 'article.title', 'article.cover', 'liker.nickName', 'liker.avatar'])
      .where('article.userId = :userId', { userId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED })
      .andWhere('like.userId <> :userId');

    paginate(entity, query);

    entity.orderBy('like.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」，别名保留原大小写（liker → liker_nick_name）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.like_id,
      userId: row.like_user_id,
      nickName: row.liker_nick_name || '',
      avatar: row.liker_avatar || null,
      articleId: row.article_id,
      articleTitle: row.article_title || null,
      articleCover: row.article_cover || null,
      createTime: row.like_create_time,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 点赞管理列表（管理端，联文章标题与点赞人昵称）
   * 取数走 getRawAndEntities：like 实体 + join 出的文章/用户展示列手动拼平
   */
  async findAdminList(query: ListLikeDto) {
    const entity = this.likeRepo.createQueryBuilder('like');
    entity
      .leftJoin(PostArticleEntity, 'article', 'article.id = like.articleId')
      .leftJoin(UserEntity, 'user', 'user.userId = like.userId')
      .addSelect(['article.title', 'article.cover', 'user.nickName'])
      .where('1 = 1');

    applyLike(entity, 'article.title', query.title);
    applyLike(entity, 'user.nickName', query.nickName);

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('like.createTime BETWEEN :start AND :end', {
        start: query.params.beginTime,
        end: query.params.endTime,
      });
    }

    paginate(entity, query);

    entity.orderBy('like.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」（非实体属性名）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.like_id,
      articleId: row.like_article_id,
      userId: row.like_user_id,
      createTime: row.like_create_time,
      articleTitle: row.article_title,
      articleCover: row.article_cover,
      nickName: row.user_nick_name,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 管理端批量删除点赞记录：同步回减对应文章 like_num（下限 0）
   */
  async removeByIds(ids: number[]) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const rows = await manager.find(PostLikeEntity, { where: { id: In(ids) } });
      if (!rows.length) {
        return ResultData.ok();
      }

      await manager.delete(PostLikeEntity, { id: In(rows.map((row) => row.id)) });

      // 按文章聚合回减计数，单篇文章最多减到 0
      const countByArticle = new Map<number, number>();
      rows.forEach((row) => countByArticle.set(row.articleId, (countByArticle.get(row.articleId) || 0) + 1));
      for (const [articleId, count] of countByArticle) {
        await manager
          .createQueryBuilder()
          .update(PostArticleEntity)
          .set({ likeNum: () => `GREATEST(like_num - ${count}, 0)` })
          .where('id = :id', { id: articleId })
          .execute();
      }

      this.logger.log(`管理员删除点赞记录 ${rows.length} 条，涉及文章 ${countByArticle.size} 篇`);
      return ResultData.ok();
    });
  }
}
