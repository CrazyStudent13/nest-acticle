/**
 * 互动通知相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/notify/notify.service.ts（未读计数/已读水位打点）
 * - apps/server/src/module/post/comment/comment.service.ts findReceivedList（收到的评论流）
 * - 数据库表 post_notify_read：每用户每分类一行水位（联合主键），不逐条打已读标记
 */

/**
 * 未读计数（头部铃铛红标）
 * comment=收到的评论 like=收到的赞 collect=收到的收藏 total=互动分类合计；粉丝/系统通知未建不计
 */
export interface NotifyUnreadCount {
  comment: number;
  like: number;
  collect: number;
  total: number;
}

/**
 * 「收到的评论」列表行（通知中心评论栏）：他人评论我发布的文章或回复我的评论
 * replyUserId 等于当前用户即「回复了我的评论」，否则为「评论了我的文章/回复了他人」
 */
export interface ReceivedCommentItem {
  /** 评论记录 id（列表 key） */
  id: number;
  /** 评论人用户 ID（互动发起者，跳个人空间） */
  userId: number;
  nickName: string;
  avatar?: string | null;
  /** 所属文章 */
  articleId: number;
  /** 文章标题（文章已删/下架时该行不出现在列表中，标题由文章表联查） */
  articleTitle: string | null;
  articleCover?: string | null;
  /** 评论内容 */
  content: string;
  createTime?: string | null;
  /** 被回复的评论 id（根评论为 null） */
  parentId?: number | null;
  /** 被回复评论的作者用户 id（冗余，判定「回复了我的评论」用） */
  replyUserId?: number | null;
  /** 被回复人的昵称（服务端联查，展示用） */
  replyNickName?: string | null;
}
