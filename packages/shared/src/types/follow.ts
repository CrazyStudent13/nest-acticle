/**
 * 关注相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/follow/follow.service.ts（follow/unfollow/status 返回载荷与列表行）
 * - 数据库表 post_follow：一人一人一条记录（uk_follower_following），取关物理删除；
 *   fan_num/follow_num 不落冗余计数列，展示侧读时 COUNT
 */

/**
 * 访问者视角的关注状态（列表条目按钮三态）
 * none=未关注 following=已关注 mutual=互相关注
 */
export type ViewerFollowState = 'none' | 'following' | 'mutual';

/**
 * 关注/取关动作返回载荷（动作完成后的最新状态与对方粉丝数）
 */
export interface FollowActionResult {
  /** 动作完成后当前用户是否处于已关注状态 */
  followed: boolean;
  /** 动作完成后目标用户的粉丝总数 */
  fanNum: number;
}

/**
 * 关注状态查询载荷（当前用户对目标用户）
 */
export interface FollowStatus {
  /** 当前用户是否已关注目标用户 */
  followed: boolean;
  /** 是否互相关注 */
  mutual: boolean;
  /** 目标用户的粉丝总数 */
  fanNum: number;
}

/**
 * 关注/粉丝列表行（个人空间关注/粉丝栏展示用，关注时间倒序）
 * followState 为访问者视角状态（未登录一律 none），条目按钮三态由此驱动
 */
export interface FollowUserItem {
  /** 该用户的 userID（跳个人空间） */
  userId: number;
  nickName: string;
  avatar?: string | null;
  /** 个性签名（未设置时 null） */
  signature?: string | null;
  /** 这条关注关系建立的时间（空间主人的关注动作时间） */
  followTime?: string | null;
  /** 该用户的粉丝总数（读时 COUNT，服务端批查回填） */
  fanNum: number;
  /** 访问者对该用户的关注状态 */
  followState: ViewerFollowState;
}

/**
 * 「收到的关注」通知行（通知中心新增粉丝栏）：他人关注了我
 * 行本身证明「对方关注列表主人」，followState 由统一解析得出：
 * mutual=已互关（列表主人回关了对方） none=待回关；不会出现 following
 */
export interface ReceivedFollowItem {
  /** 关注记录 id（列表 key） */
  id: number;
  /** 关注人 userID（跳个人空间） */
  userId: number;
  nickName: string;
  avatar?: string | null;
  /** 关注时间 */
  followTime?: string | null;
  /** 列表主人对关注人的关注状态 */
  followState: ViewerFollowState;
}
