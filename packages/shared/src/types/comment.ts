/**
 * 评论相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/comment/comment.service.ts（guest 列表/创建返回载荷）
 * - 数据库表 post_comment：平铺一层展示（回复以 parent_id/reply_user_id 标记，
 *   列表不嵌套，前端按「回复 @某人」呈现，同掘金）；删除为物理删除，
 *   删除带回复的评论时级联删除其全部后代并回减计数
 */

/**
 * 评论作者公开信息（与文章userInfo口径一致：昵称+头像）
 */
export interface CommentUserInfo {
  userId: number;
  nickName?: string;
  avatar?: string;
}

/**
 * 评论行（guest 列表/创建返回）
 */
export interface CommentItem {
  id: number;
  articleId: number;
  /** 评论人用户 ID */
  userId: number;
  content: string;
  createTime?: string | null;
  /** 评论人公开信息（昵称/头像） */
  userInfo?: CommentUserInfo | null;
  /** 被回复的评论 id（根评论为 null） */
  parentId?: number | null;
  /** 被回复评论的作者用户 id（冗余，展示「回复 @某人」用） */
  replyUserId?: number | null;
  /** 被回复人的昵称（服务端联查，展示用） */
  replyNickName?: string | null;
}

/**
 * 创建评论载荷（带 parentId 即为回复）
 */
export interface CommentPayload {
  articleId: number;
  /** 1-500 字 */
  content: string;
  /** 被回复的评论 id（回复时必传，服务端校验同文章） */
  parentId?: number;
}

/**
 * 我的评论行（通知中心「评论」栏：当前登录用户发表的评论与回复，服务端联文章标题与被回复人昵称）
 */
export interface MyCommentItem {
  id: number;
  articleId: number;
  /** 所属文章标题（文章已删时为 null，前端降级展示） */
  articleTitle?: string | null;
  content: string;
  createTime?: string | null;
  /** 被回复的评论 id（根评论为 null） */
  parentId?: number | null;
  /** 被回复评论的作者用户 id（冗余，跳转其个人空间用） */
  replyUserId?: number | null;
  /** 被回复人的昵称（服务端联查，展示用；账号被删时为 null） */
  replyNickName?: string | null;
}
