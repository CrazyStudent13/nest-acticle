// 互动通知：铃铛红标未读计数 + 已读水位打点 + 收到的评论流。
// 未读计数走全局 state（AppHeader 角标与通知中心页共用）；轮询/路由切换刷新由 AppHeader
// 在登录态就绪后启动；未登录不拉取且清零（退出后不残留计数）。接口只要求 JWT，
// 调用方须保证登录态（AppHeader 已登录区块 / 通知页 auth middleware）
import type { NotifyUnreadCount, PageResult, ReceivedCommentItem } from '@nest-acticle/shared'

const EMPTY_UNREAD: NotifyUnreadCount = { comment: 0, like: 0, total: 0 }

// 红标轮询间隔：角标是辅助信息，60s 足够跟手，路由切换时另有即时刷新兜底
const BADGE_POLL_MS = 60_000

export const useNotify = () => {
  // 全局未读数：useState 跨组件共享，AppHeader 与通知中心页读写同一份
  const unread = useState<NotifyUnreadCount>('notify-unread', () => ({ ...EMPTY_UNREAD }))

  // 未读计数：仅登录后拉取；失败静默——角标缺失不打扰主流程，下轮轮询会再试
  const refreshBadge = async () => {
    const { isLoggedIn } = useUser()
    if (!isLoggedIn.value) {
      unread.value = { ...EMPTY_UNREAD }
      return
    }
    try {
      const res = await apiFetch<NotifyUnreadCount>('/api/post/notify/unread/count')
      if (res.data) {
        unread.value = res.data
      }
    } catch {
      /* 静默 */
    }
  }

  // 标记已读：进通知中心时调用，全部互动分类水位推至当前；本地同步清零，
  // 不等服务端回读（后端口径与未读计数一致，刷新后也为 0）
  const markRead = async () => {
    await apiFetch('/api/post/notify/read', { method: 'POST' })
    unread.value = { ...EMPTY_UNREAD }
  }

  // 收到的评论流（他人评论我的文章/回复我的评论），分页拉取
  const fetchReceivedComments = async (params: { pageNum?: number; pageSize?: number }): Promise<PageResult<ReceivedCommentItem>> => {
    const res = await apiFetch<PageResult<ReceivedCommentItem>>('/api/post/comment/received/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 红标轮询：登录期间每分钟拉一次计数，组件卸载即停；登录态由调用方 watch 驱动启停
  const startBadgePolling = () => {
    if (badgeTimer) {
      return
    }
    badgeTimer = setInterval(refreshBadge, BADGE_POLL_MS)
  }

  const stopBadgePolling = () => {
    if (badgeTimer) {
      clearInterval(badgeTimer)
      badgeTimer = null
    }
  }

  return { unread, refreshBadge, markRead, fetchReceivedComments, startBadgePolling, stopBadgePolling }
}

// 模块级定时器句柄：轮询只在头部组件启动（全局一份），存 composable 文件作用域即可
let badgeTimer: ReturnType<typeof setInterval> | null = null
