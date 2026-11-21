import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, paginate } from 'src/common/query';
import { PublishStatusEnum } from '@nest-acticle/shared';
import { PostCommentEntity } from './entities/comment.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { CreateCommentDto, ListCommentDto, ListCommentGuestDto, ListMyCommentDto } from './dto/index';

/**
 * 评论服务
 * 写路径（创建/删除）统一走事务，同步维护 post_article.comment_num 计数
 */
@Injectable()
export class PostCommentService {
  private readonly logger = new Logger(PostCommentService.name);

  constructor(
    @InjectRepository(PostCommentEntity)
    private readonly commentRepo: Repository<PostCommentEntity>,
    @InjectRepository(PostArticleEntity)
    private readonly articleRepo: Repository<PostArticleEntity>,
  ) {}

  /**
   * 发表评论（仅已发布文章；带 parentId 即为回复，校验父评论存在且同文章）
   * 事务内插记录 + increment comment_num；返回带评论人公开信息的完整行，供前端即时追加
   */
  async create(dto: CreateCommentDto, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const article = await manager.findOne(PostArticleEntity, {
        where: { id: dto.articleId, delFlag: '0', publishStatus: PublishStatusEnum.PUBLISHED },
      });
      if (!article) {
        throw new BusinessException(500, '文章不存在或未发布');
      }

      // 回复目标校验：父评论必须存在且属于同一篇文章，被回复人取父评论作者
      // 同时带出被回复人昵称：前端据此即时渲染「回复 @xx：」前缀，与刷新后的列表形状一致
      let replyUserId: number | null = null;
      let replyNickName: string | null = null;
      if (dto.parentId) {
        const parent = await manager.findOne(PostCommentEntity, {
          where: { id: dto.parentId, articleId: dto.articleId },
        });
        if (!parent) {
          throw new BusinessException(500, '被回复的评论不存在');
        }
        replyUserId = parent.userId;
        const replyUser = await manager.findOne(UserEntity, {
          where: { userId: parent.userId },
          select: ['nickName'],
        });
        replyNickName = replyUser?.nickName || null;
      }

      const created = await manager.insert(PostCommentEntity, {
        articleId: dto.articleId,
        userId,
        content: dto.content,
        parentId: dto.parentId || null,
        replyUserId,
      });
      await manager.increment(PostArticleEntity, { id: dto.articleId }, 'commentNum', 1);

      const user = await manager.findOne(UserEntity, {
        where: { userId },
        select: ['userId', 'nickName', 'avatar'],
      });

      return ResultData.ok({
        id: created.identifiers[0].id,
        articleId: dto.articleId,
        userId,
        content: dto.content,
        createTime: new Date().toISOString(),
        userInfo: user ? { userId: user.userId, nickName: user.nickName, avatar: user.avatar } : null,
        parentId: dto.parentId || null,
        replyUserId,
        replyNickName,
      });
    });
  }

  /**
   * 评论 guest 列表（公开：仅已发布文章的评论，联评论人与被回复人公开信息，最新在前，平铺不嵌套）
   */
  async findGuestList(query: ListCommentGuestDto) {
    const entity = this.commentRepo.createQueryBuilder('comment');
    entity
      .leftJoin(PostArticleEntity, 'article', 'article.id = comment.articleId')
      .leftJoin(UserEntity, 'user', 'user.userId = comment.userId')
      .leftJoin(UserEntity, 'replyUser', 'replyUser.userId = comment.replyUserId')
      .addSelect(['user.nickName', 'user.avatar', 'replyUser.nickName'])
      .where('comment.articleId = :articleId', { articleId: query.articleId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });

    paginate(entity, query);

    entity.orderBy('comment.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」，别名保留原大小写（replyUser → replyUser_nick_name）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.comment_id,
      articleId: row.comment_article_id,
      userId: row.comment_user_id,
      content: row.comment_content,
      createTime: row.comment_create_time,
      userInfo: row.user_nick_name
        ? { userId: row.comment_user_id, nickName: row.user_nick_name, avatar: row.user_avatar }
        : null,
      parentId: row.comment_parent_id,
      replyUserId: row.comment_reply_user_id,
      replyNickName: row.replyUser_nick_name || null,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 评论管理列表（管理端，联文章标题与评论人昵称）
   */
  async findAdminList(query: ListCommentDto) {
    const entity = this.commentRepo.createQueryBuilder('comment');
    entity
      .leftJoin(PostArticleEntity, 'article', 'article.id = comment.articleId')
      .leftJoin(UserEntity, 'user', 'user.userId = comment.userId')
      .leftJoin(UserEntity, 'replyUser', 'replyUser.userId = comment.replyUserId')
      .addSelect(['article.title', 'user.nickName', 'replyUser.nickName'])
      .where('1 = 1');

    applyLike(entity, 'article.title', query.title);
    applyLike(entity, 'user.nickName', query.nickName);
    applyLike(entity, 'comment.content', query.content);

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('comment.createTime BETWEEN :start AND :end', {
        start: query.params.beginTime,
        end: query.params.endTime,
      });
    }

    paginate(entity, query);

    entity.orderBy('comment.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    const list = raw.map((row: Record<string, any>) => ({
      id: row.comment_id,
      articleId: row.comment_article_id,
      articleTitle: row.article_title,
      userId: row.comment_user_id,
      nickName: row.user_nick_name,
      content: row.comment_content,
      createTime: row.comment_create_time,
      parentId: row.comment_parent_id,
      // raw 键保留别名大小写：replyUser → replyUser_nick_name
      replyNickName: row.replyUser_nick_name || null,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 我的评论列表（通知中心「评论」栏：当前用户发表的评论与回复，联文章标题与被回复人昵称，最新在前）
   * 行形状对齐 shared 的 MyCommentItem；文章已删时 articleTitle 为空由前端降级展示
   */
  async findMyList(userId: number, query: ListMyCommentDto) {
    const entity = this.commentRepo.createQueryBuilder('comment');
    entity
      .leftJoin(PostArticleEntity, 'article', 'article.id = comment.articleId')
      .leftJoin(UserEntity, 'replyUser', 'replyUser.userId = comment.replyUserId')
      .addSelect(['article.title', 'replyUser.nickName'])
      .where('comment.userId = :userId', { userId });

    applyLike(entity, 'article.title', query.title);

    paginate(entity, query);

    entity.orderBy('comment.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」，别名保留原大小写（replyUser → replyUser_nick_name）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.comment_id,
      articleId: row.comment_article_id,
      articleTitle: row.article_title || null,
      content: row.comment_content,
      createTime: row.comment_create_time,
      parentId: row.comment_parent_id,
      replyUserId: row.comment_reply_user_id,
      replyNickName: row.replyUser_nick_name || null,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 收到的评论列表（通知中心「评论-收到的评论」栏：他人评论我发布的文章或回复我的评论，最新在前）
   * 行形状对齐 shared 的 ReceivedCommentItem；口径与 notify.service 未读计数严格一致
   * （角标数必须能被这条列表清掉），仅含已发布未删文章
   */
  async findReceivedList(userId: number, query: ListMyCommentDto) {
    const entity = this.commentRepo.createQueryBuilder('comment');
    entity
      .innerJoin(PostArticleEntity, 'article', 'article.id = comment.articleId')
      .leftJoin(UserEntity, 'commenter', 'commenter.userId = comment.userId')
      .leftJoin(UserEntity, 'replyUser', 'replyUser.userId = comment.replyUserId')
      .addSelect(['article.title', 'article.cover', 'commenter.nickName', 'commenter.avatar', 'replyUser.nickName'])
      // OR 整体必须再套一层外括号：TypeORM 不自动加，否则后续 andWhere（已发布/未删）
      // 因 AND 优先级更高只约束右支，左支完全绕过过滤
      .where(
        '((article.userId = :userId AND comment.userId <> :userId) OR (comment.replyUserId = :userId AND comment.userId <> :userId))',
        { userId }
      )
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });

    paginate(entity, query);

    entity.orderBy('comment.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」，别名保留原大小写（commenter → commenter_nick_name）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.comment_id,
      userId: row.comment_user_id,
      nickName: row.commenter_nick_name || '',
      avatar: row.commenter_avatar || null,
      articleId: row.comment_article_id,
      articleTitle: row.article_title || null,
      articleCover: row.article_cover || null,
      content: row.comment_content,
      createTime: row.comment_create_time,
      parentId: row.comment_parent_id,
      replyUserId: row.comment_reply_user_id,
      replyNickName: row.replyUser_nick_name || null,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 级联收集待删评论及其全部后代（回复可指向回复，逐层向下找）
   * 返回按文章聚合的删除计数 Map，供回减 comment_num
   */
  private async collectCascade(
    manager: EntityManager,
    rootIds: number[]
  ): Promise<{ ids: number[]; countByArticle: Map<number, number> }> {
    const allIds = new Set<number>(rootIds);
    let pending = [...rootIds];

    while (pending.length) {
      const children = await manager.find(PostCommentEntity, {
        where: { parentId: In(pending) },
        select: ['id', 'articleId'],
      });
      pending = children.map((c) => c.id).filter((id) => !allIds.has(id));
      children.forEach((c) => allIds.add(c.id));
    }

    const rows = await manager.find(PostCommentEntity, { where: { id: In([...allIds]) } });
    const countByArticle = new Map<number, number>();
    rows.forEach((row) => countByArticle.set(row.articleId, (countByArticle.get(row.articleId) || 0) + 1));
    return { ids: [...allIds], countByArticle };
  }

  /**
   * 删除自己的评论（前端入口；非本人评论拒绝；带回复时级联删除全部后代）
   */
  async removeOwn(id: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const comment = await manager.findOne(PostCommentEntity, { where: { id } });
      if (!comment) {
        throw new BusinessException(500, '评论不存在');
      }
      if (comment.userId !== userId) {
        throw new BusinessException(403, '只能删除自己的评论');
      }

      const { ids, countByArticle } = await this.collectCascade(manager, [id]);
      await manager.delete(PostCommentEntity, { id: In(ids) });
      for (const [articleId, count] of countByArticle) {
        await manager
          .createQueryBuilder()
          .update(PostArticleEntity)
          .set({ commentNum: () => `GREATEST(comment_num - ${count}, 0)` })
          .where('id = :id', { id: articleId })
          .execute();
      }
      // 回抛实际删除条数（含未加载的级联后代），前端据此精确回减计数
      return ResultData.ok({ removed: ids.length });
    });
  }

  /**
   * 管理端批量删除评论：级联删除后代，同步回减对应文章 comment_num（下限 0）
   */
  async removeByIds(ids: number[]) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const { ids: allIds, countByArticle } = await this.collectCascade(manager, ids);
      if (!allIds.length) {
        return ResultData.ok();
      }

      await manager.delete(PostCommentEntity, { id: In(allIds) });
      for (const [articleId, count] of countByArticle) {
        await manager
          .createQueryBuilder()
          .update(PostArticleEntity)
          .set({ commentNum: () => `GREATEST(comment_num - ${count}, 0)` })
          .where('id = :id', { id: articleId })
          .execute();
      }

      this.logger.log(`管理员删除评论 ${allIds.length} 条（含级联），涉及文章 ${countByArticle.size} 篇`);
      return ResultData.ok();
    });
  }
}
