// 用户关注：状态查询/关注/取消/关注粉丝列表/收到的关注。
// 关注与取消均要求登录态；关注/粉丝列表为公开接口（个人空间对访客开放，同掘金），
// 本人空间与他人空间共用 guest/list（userId + type 区分归属与方向）；
// 带登录态访问时服务端会回填访问者视角的 followState（条目按钮三态），未登录一律 none；
// 收到的关注按登录态过滤，须保证守卫先行
import type { FollowActionResult, FollowStatus, FollowUserItem, PageResult, ReceivedFollowItem } from '@nest-acticle/shared'

// 列表方向：following=TA 关注的人，fans=关注 TA 的人
export type FollowListType = 'following' | 'fans'

export const useFollow = () => {
  const fetchFollowStatus = async (targetUserId: number | string): Promise<FollowStatus | null> => {
    const res = await apiFetch<FollowStatus>(`/api/post/follow/status/${targetUserId}`)
    return res.data ?? null
  }

  const followUser = async (targetUserId: number | string): Promise<FollowActionResult | null> => {
    const res = await apiFetch<FollowActionResult>(`/api/post/follow/${targetUserId}`, { method: 'POST' })
    return res.data ?? null
  }

  const unfollowUser = async (targetUserId: number | string): Promise<FollowActionResult | null> => {
    const res = await apiFetch<FollowActionResult>(`/api/post/follow/${targetUserId}`, { method: 'DELETE' })
    return res.data ?? null
  }

  // 指定用户的关注/粉丝列表（个人空间关注/粉丝栏）：关注时间倒序，登录态下条目带 followState
  const fetchUserFollows = async (
    userId: number,
    type: FollowListType,
    params: { pageNum?: number; pageSize?: number }
  ): Promise<PageResult<FollowUserItem>> => {
    const res = await apiFetch<PageResult<FollowUserItem>>('/api/post/follow/guest/list', {
      query: { userId, type, ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 收到的关注（通知中心新增粉丝栏）：谁关注了我，服务端按当前登录人过滤，最新在前
  const fetchReceivedFollows = async (params: { pageNum?: number; pageSize?: number }): Promise<PageResult<ReceivedFollowItem>> => {
    const res = await apiFetch<PageResult<ReceivedFollowItem>>('/api/post/follow/received/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  return { fetchFollowStatus, followUser, unfollowUser, fetchUserFollows, fetchReceivedFollows }
}
