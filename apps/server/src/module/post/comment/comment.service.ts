import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { PublishStatusEnum } from '@nest-acticle/shared';
import { PostCommentEntity } from './entities/comment.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { CreateCommentDto, ListCommentDto, ListCommentGuestDto } from './dto/index';

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
   * 发表评论（仅已发布文章；事务内插记录 + increment comment_num）
   * 返回带评论人公开信息的完整行，供前端即时追加
   */
  async create(dto: CreateCommentDto, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const article = await manager.findOne(PostArticleEntity, {
        where: { id: dto.articleId, delFlag: '0', publishStatus: PublishStatusEnum.PUBLISHED },
      });
      if (!article) {
        return ResultData.fail(500, '文章不存在或未发布');
      }

      const created = await manager.insert(PostCommentEntity, {
        articleId: dto.articleId,
        userId,
        content: dto.content,
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
      });
    });
  }

  /**
   * 评论 guest 列表（公开：仅已发布文章的评论，联评论人公开信息，最新在前）
   */
  async findGuestList(query: ListCommentGuestDto) {
    const entity = this.commentRepo.createQueryBuilder('comment');
    entity
      .leftJoin(PostArticleEntity, 'article', 'article.id = comment.articleId')
      .leftJoin(UserEntity, 'user', 'user.userId = comment.userId')
      .addSelect(['user.nickName', 'user.avatar'])
      .where('comment.articleId = :articleId', { articleId: query.articleId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });

    if (query.pageSize && query.pageNum) {
      entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    entity.orderBy('comment.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」
    const list = raw.map((row: Record<string, any>) => ({
      id: row.comment_id,
      articleId: row.comment_article_id,
      userId: row.comment_user_id,
      content: row.comment_content,
      createTime: row.comment_create_time,
      userInfo: row.user_nick_name
        ? { userId: row.comment_user_id, nickName: row.user_nick_name, avatar: row.user_avatar }
        : null,
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
      .addSelect(['article.title', 'user.nickName'])
      .where('1 = 1');

    if (query.title) {
      entity.andWhere('article.title LIKE :title', { title: `%${query.title}%` });
    }

    if (query.nickName) {
      entity.andWhere('user.nickName LIKE :nickName', { nickName: `%${query.nickName}%` });
    }

    if (query.content) {
      entity.andWhere('comment.content LIKE :content', { content: `%${query.content}%` });
    }

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('comment.createTime BETWEEN :start AND :end', {
        start: query.params.beginTime,
        end: query.params.endTime,
      });
    }

    if (query.pageSize && query.pageNum) {
      entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

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
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 删除自己的评论（前端入口；非本人评论拒绝）
   */
  async removeOwn(id: number, userId: number) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const comment = await manager.findOne(PostCommentEntity, { where: { id } });
      if (!comment) {
        return ResultData.fail(500, '评论不存在');
      }
      if (comment.userId !== userId) {
        return ResultData.fail(403, '只能删除自己的评论');
      }

      await manager.delete(PostCommentEntity, { id });
      await manager.decrement(PostArticleEntity, { id: comment.articleId }, 'commentNum', 1);
      return ResultData.ok();
    });
  }

  /**
   * 管理端批量删除评论：同步回减对应文章 comment_num（下限 0）
   */
  async removeByIds(ids: number[]) {
    return this.articleRepo.manager.transaction(async (manager) => {
      const rows = await manager.find(PostCommentEntity, { where: { id: In(ids) } });
      if (!rows.length) {
        return ResultData.ok();
      }

      await manager.delete(PostCommentEntity, { id: In(rows.map((row) => row.id)) });

      const countByArticle = new Map<number, number>();
      rows.forEach((row) => countByArticle.set(row.articleId, (countByArticle.get(row.articleId) || 0) + 1));
      for (const [articleId, count] of countByArticle) {
        await manager
          .createQueryBuilder()
          .update(PostArticleEntity)
          .set({ commentNum: () => `GREATEST(comment_num - ${count}, 0)` })
          .where('id = :id', { id: articleId })
          .execute();
      }

      this.logger.log(`管理员删除评论 ${rows.length} 条，涉及文章 ${countByArticle.size} 篇`);
      return ResultData.ok();
    });
  }
}
