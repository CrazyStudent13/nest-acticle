/**
 * 评论相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/comment/comment.service.ts（guest 列表/创建返回载荷）
 * - 数据库表 post_comment：平铺一层评论（v1 不做楼中楼），管理员/作者删除为物理删除
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
}

/**
 * 创建评论载荷
 */
export interface CommentPayload {
  articleId: number;
  /** 1-500 字 */
  content: string;
}
