import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { PublishStatusEnum } from '@nest-acticle/shared';
import { NOTICE_READ_PREFIX, PostNotifyReadEntity } from './entities/notify-read.entity';
import { PostCommentEntity } from '../comment/entities/comment.entity';
import { PostLikeEntity } from '../like/entities/like.entity';
import { PostCollectionArticleEntity } from '../collection/entities/collection-article.entity';
import { PostCollectionEntity } from '../collection/entities/collection.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { PostFollowEntity } from '../follow/entities/follow.entity';
import { SysNoticeEntity } from 'src/module/system/notice/entities/notice.entity';

/**
 * 互动通知分类（与 post_notify_read.category 对应；
 * 新增私信等分类上线时在此扩列，init.sql 的 varchar(16) 足够容纳。
 * 系统通知（sys_notice，含举报反馈定向通知）**不走分类水位**：它是逐条已读模型——
 * post_notify_read 以 category='n:<noticeId>' 记「该用户已读过的通知」，未读数 =
 * 可见公告中无已读标记的条数（见 receivedSystemQb / readNotices），
 * 进系统通知栏只把**本页**通知标已读，角标随之回落、行级未读样式得以保留
 */
export const NotifyCategory = {
  COMMENT: 'comment',
  LIKE: 'like',
  COLLECT: 'collect',
  FOLLOW: 'follow',
} as const;

/**
 * 互动通知服务
 * 已读采用「水位」模型：post_notify_read 记每分类最后已读时刻，未读数 =
 * 互动记录 create_time 晚于水位的条数；进通知中心一次性把全部互动分类推平
 * 水位列与互动 create_time 均为 datetime(3) 毫秒粒度——秒级粒度下 markRead
 * 同秒到达的互动（create_time = 水位）被严格 > 永久排除、漏红标；毫秒级后
 * 残余窗口缩至同毫秒并发，属存储粒度极限
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
    @InjectRepository(PostCollectionArticleEntity)
    private readonly collectRepo: Repository<PostCollectionArticleEntity>,
    @InjectRepository(PostCollectionEntity)
    private readonly collectionRepo: Repository<PostCollectionEntity>,
    @InjectRepository(PostArticleEntity)
    private readonly articleRepo: Repository<PostArticleEntity>,
    @InjectRepository(PostFollowEntity)
    private readonly followRepo: Repository<PostFollowEntity>,
    @InjectRepository(SysNoticeEntity)
    private readonly noticeRepo: Repository<SysNoticeEntity>,
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
   * 收到的收藏未读条件：他人把我的已发布文章收进 ta 的公开收藏集，
   * 与 collection.service.findReceivedList 口径严格一致（私密集不产生通知，自收藏不计）
   */
  private receivedCollectQb(userId: number) {
    return this.collectRepo
      .createQueryBuilder('relation')
      .innerJoin(PostArticleEntity, 'article', 'article.id = relation.articleId')
      .innerJoin(PostCollectionEntity, 'collection', 'collection.id = relation.collectionId')
      .where('article.userId = :userId', { userId })
      .andWhere('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED })
      .andWhere('relation.userId <> :userId', { userId })
      .andWhere('collection.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('collection.visibility = :visibility', { visibility: '0' });
  }

  /**
   * 收到的关注未读条件：他人关注我，与 follow.service.findReceivedList 口径一致
   * 服务层已禁止自关注，DB 层仍兜底排除 follower = following 的脏行
   */
  private receivedFollowQb(userId: number) {
    return this.followRepo
      .createQueryBuilder('follow')
      .where('follow.followingId = :userId', { userId })
      .andWhere('follow.followerId <> :userId', { userId });
  }

  /**
   * 系统通知未读条件：生效中的全员公告 + 发给我的定向通知（举报反馈等），
   * 与 notice.service.findAll 的 scope=mine 口径严格一致（delFlag='0' + status='0' + 定向过滤），
   * 并排除已读标记（post_notify_read category='n:<noticeId>'）——角标数必须能被列表/详情的标已读动作清掉
   */
  private receivedSystemQb(userId: number) {
    return this.noticeRepo
      .createQueryBuilder('notice')
      .where('notice.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('notice.status = :status', { status: '0' })
      .andWhere('(notice.userId IS NULL OR notice.userId = :userId)', { userId })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM post_notify_read r WHERE r.user_id = :readUserId AND r.category = CONCAT(:readPrefix, notice.notice_id))',
        { readUserId: userId, readPrefix: NOTICE_READ_PREFIX },
      );
  }

  /**
   * 未读计数（铃铛红标）：按分类返回，total 为互动四分类 + 系统通知合计。
   * 互动四分类走 create_time > 水位；system 走逐条已读（NOT EXISTS 标记，无水位比较）
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

    const collectQb = this.receivedCollectQb(userId);
    const collectRead = readMap.get(NotifyCategory.COLLECT);
    if (collectRead) {
      collectQb.andWhere('relation.createTime > :collectRead', { collectRead });
    }
    const collect = await collectQb.getCount();

    const followQb = this.receivedFollowQb(userId);
    const followRead = readMap.get(NotifyCategory.FOLLOW);
    if (followRead) {
      followQb.andWhere('follow.createTime > :followRead', { followRead });
    }
    const follow = await followQb.getCount();

    const system = await this.receivedSystemQb(userId).getCount();

    return ResultData.ok({ comment, like, collect, follow, system, total: comment + like + collect + follow + system });
  }

  /**
   * 系统通知逐条标已读（进详情页标单条时调用）
   * 写 post_notify_read category='n:<noticeId>'（INSERT IGNORE，重复标幂等）；
   * 只接收数字 id（调用方传列表页/详情页拿到的 noticeId），不校验可见性——
   * 已读标记是用户私有状态，标记不可见通知无泄露无副作用
   */
  async readNotices(userId: number, noticeIds: number[]) {
    const ids = [...new Set(noticeIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
    if (!ids.length) {
      return ResultData.ok();
    }
    const now = new Date();
    await this.readRepo.manager.transaction(async (manager) => {
      for (const noticeId of ids) {
        await manager.query(
          'INSERT IGNORE INTO post_notify_read (user_id, category, read_time) VALUES (?, ?, ?)',
          [userId, `${NOTICE_READ_PREFIX}${noticeId}`, now],
        );
      }
    });
    return ResultData.ok();
  }

  /**
   * 系统通知全部标已读（列表「全部已读」按钮）：一条 INSERT...SELECT 把当前可见公告
   * （生效中 + 全员或定向给我，与 receivedSystemQb 可见性口径一致）全部写已读标记，
   * ON DUPLICATE KEY 幂等；已读过的行仅刷新标记时间，无副作用
   */
  async readAllNotices(userId: number) {
    const now = new Date();
    await this.readRepo.manager.query(
      `INSERT INTO post_notify_read (user_id, category, read_time)
       SELECT ?, CONCAT('n:', notice_id), ? FROM sys_notice
       WHERE del_flag = '0' AND status = '0' AND (user_id IS NULL OR user_id = ?)
       ON DUPLICATE KEY UPDATE read_time = VALUES(read_time)`,
      [userId, now, userId],
    );
    return ResultData.ok();
  }

  /**
   * 标记已读（互动分类）：把分类的水位推至当前，角标随即清零
   * 带 category 只推该分类（通知中心逐栏进入逐栏清），缺省推平全部互动分类；
   * 系统通知不走此端点（逐条已读见 readNotices）
   * 水位为 datetime(3) 毫秒粒度，与互动 create_time 同粒度比较（类注释附粒度论证）
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
