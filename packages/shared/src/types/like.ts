/**
 * 点赞相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/like/like.service.ts（like/unlike 返回载荷）
 * - 数据库表 post_like：一人一文一条记录（uk_article_user），取消即物理删除
 */

/**
 * 点赞动作返回载荷（点赞/取消共用，返回动作后的最新状态与计数）
 */
export interface LikeActionResult {
  /** 动作完成后当前用户是否处于已点赞状态 */
  liked: boolean;
  /** 动作完成后文章的点赞总数 */
  likeNum: number;
}
