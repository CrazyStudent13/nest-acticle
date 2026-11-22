import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { PublishStatusEnum } from '@nest-acticle/shared';
import { PostNotifyReadEntity } from './entities/notify-read.entity';
import { PostCommentEntity } from '../comment/entities/comment.entity';
import { PostLikeEntity } from '../like/entities/like.entity';
import { PostArticleEntity } from '../article/entities/article.entity';

/**
 * 互动通知分类（与 post_notify_read.category 对应；
 * 新增粉丝/私信等分类上线时在此扩列，init.sql 的 varchar(16) 足够容纳）
 */
export const NotifyCategory = {
  COMMENT: 'comment',
  LIKE: 'like',
} as const;

/**
 * 互动通知服务
 * 已读采用「水位」模型：post_notify_read 记每分类最后已读时刻，未读数 =
 * 互动记录 create_time 晚于水位的条数；进通知中心一次性把全部互动分类推平
 */
@Injectable()
export class PostNotifyService {
  constructor(
    @InjectRepository(PostNotifyReadEntity)
    private readonly readRepo: Repository<PostNotifyReadEntity>,
    @InjectRepository(PostCommentEntity)
    private readonly commentRepo: Repository<PostCommentEntity>,
    @InjectRepository(PostLikeEntity)
    private readonly likeRepo: Repository<PostLikeEntity>,
    @InjectRepository(PostArticleEntity)
    private readonly articleRepo: Repository<PostArticleEntity>,
  ) {}

  /**
   * 收到的评论未读条件：别人评论我发布的文章 或 别人回复我的评论（同一条只计一次），
   * 与 comment.service.findReceivedList 的口径严格一致——角标数必须能被列表清掉
   */
  private receivedCommentQb(userId: number) {
    return this.commentRepo
      .createQueryBuilder('comment')
      .innerJoin(PostArticleEntity, 'article', 'article.id = comment.articleId')
      // OR 整体必须再套一层外括号：TypeORM 不自动加，否则后续 andWhere（已发布/未删/水位）
      // 因 AND 优先级更高只约束右支，左支完全绕过过滤
      .where('((article.userId = :userId AND comment.userId <> :userId) OR (comment.replyUserId = :userId AND comment.userId <> :userId))', { userId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });
  }

  /**
   * 收到的赞未读条件：他人点赞我发布的已发布文章，与 like.service.findReceivedList 口径一致
   */
  private receivedLikeQb(userId: number) {
    return this.likeRepo
      .createQueryBuilder('like')
      .innerJoin(PostArticleEntity, 'article', 'article.id = like.articleId')
      .where('article.userId = :userId', { userId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED })
      .andWhere('like.userId <> :userId', { userId });
  }

  /**
   * 未读计数（铃铛红标）：按分类返回，total 为互动分类合计（粉丝/系统通知未建不计）
   */
  async unreadCount(userId: number) {
    const watermarks = await this.readRepo.find({ where: { userId } });
    const readMap = new Map(watermarks.map((row) => [row.category, row.readTime]));

    const commentQb = this.receivedCommentQb(userId);
    const commentRead = readMap.get(NotifyCategory.COMMENT);
    if (commentRead) {
      commentQb.andWhere('comment.createTime > :commentRead', { commentRead });
    }
    const comment = await commentQb.getCount();

    const likeQb = this.receivedLikeQb(userId);
    const likeRead = readMap.get(NotifyCategory.LIKE);
    if (likeRead) {
      likeQb.andWhere('like.createTime > :likeRead', { likeRead });
    }
    const like = await likeQb.getCount();

    return ResultData.ok({ comment, like, total: comment + like });
  }

  /**
   * 标记已读：把互动分类的水位推至当前，角标随即清零
   * 带 category 只推该分类（通知中心逐栏进入逐栏清），缺省推平全部互动分类
   */
  async markRead(userId: number, category?: string) {
    const now = new Date();
    const categories = category ? [category] : Object.values(NotifyCategory);
    await this.readRepo.manager.transaction(async (manager) => {
      for (const cat of categories) {
        // 先查后插在并发首次进入时会撞 (user_id, category) 主键，直接原子 upsert 推进水位
        await manager.query(
          'INSERT INTO post_notify_read (user_id, category, read_time) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE read_time = ?',
          [userId, cat, now, now],
        );
      }
    });
    return ResultData.ok();
  }
}
