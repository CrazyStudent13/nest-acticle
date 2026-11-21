// 互动通知：铃铛红标未读计数 + 已读水位打点 + 收到的评论流。
// 刷新时机刻意克制（不轮询/不监路由）：头部挂载、登录成功两处各拉一次；
// 未登录不拉取且清零（退出后不残留计数）。已读打点在通知中心逐栏进入时按分类清。
// 接口只要求 JWT，调用方须保证登录态（AppHeader 已登录区块 / 通知页 auth middleware）
import type { NotifyUnreadCount, PageResult, ReceivedCommentItem } from '@nest-acticle/shared'

const EMPTY_UNREAD: NotifyUnreadCount = { comment: 0, like: 0, total: 0 }

// 有未读计数的互动分类（粉丝/系统通知未建未接计数）
export type NotifyCategoryKey = 'comment' | 'like'

export const useNotify = () => {
  // 全局未读数：useState 跨组件共享，AppHeader 与通知中心页读写同一份
  const unread = useState<NotifyUnreadCount>('notify-unread', () => ({ ...EMPTY_UNREAD }))

  // 未读计数：仅登录后拉取；失败静默——角标缺失不打扰主流程，下次刷新/登录再取
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

  // 标记已读：通知中心进入对应分类栏时调用（逐栏清零）；category 缺省=全部互动分类推平。
  // 本地同步扣减/清零，不回读服务端（后端口径与未读计数一致）
  const markRead = async (category?: NotifyCategoryKey) => {
    await apiFetch('/api/post/notify/read', {
      method: 'POST',
      body: category ? { category } : undefined
    })
    unread.value = category
      ? { ...unread.value, [category]: 0, total: Math.max(0, unread.value.total - unread.value[category]) }
      : { ...EMPTY_UNREAD }
  }

  // 收到的评论流（他人评论我的文章/回复我的评论），分页拉取
  const fetchReceivedComments = async (params: { pageNum?: number; pageSize?: number }): Promise<PageResult<ReceivedCommentItem>> => {
    const res = await apiFetch<PageResult<ReceivedCommentItem>>('/api/post/comment/received/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  return { unread, refreshBadge, markRead, fetchReceivedComments }
}
