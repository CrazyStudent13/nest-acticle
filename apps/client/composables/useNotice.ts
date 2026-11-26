// 通知中心数据：系统通知/公告列表 + 我发表的评论列表 + 通知分类清单。
// 两个接口都按登录态过滤（未登录必 401），调用方须保证守卫先行（auth middleware / 组件级恢复）；
// 已关闭（status='1'）的公告由服务端按 status 参数过滤，分页 total 与列表一致
import type { MyCommentItem, PageResult } from '@nest-acticle/shared'

// 系统通知行数据（openapi 有对应 schema，shared 暂未沉淀线格式类型，先就地定义）
// noticeType：1 通知 2 公告 3 举报反馈（定向私密通知，sys_notice.user_id 定向到人，列表按登录人过滤）
// unread：行级未读标记（scope=mine 时服务端按逐条已读标记回传，管理端视角无此字段）
export interface NoticeItem {
  noticeId: number
  noticeTitle: string
  noticeType: string
  noticeContent: string
  status: string
  unread?: boolean
  createBy?: string
  createTime: string
}

// 通知分类清单：头部铃铛下拉与通知中心左侧竖栏同源（改一处两边同步），key 即通知页的 ?tab=
// （system 为默认栏不带参数）；icon 为全站规范的内联描边 SVG，铃铛下拉只取 key/label。
// 新增粉丝栏后端未建，进入为占位空态
export const NOTICE_CATS = [
  {
    key: 'comment',
    label: '评论',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
  },
  {
    key: 'like',
    label: '赞和收藏',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
  },
  {
    key: 'follower',
    label: '新增粉丝',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>'
  },
  {
    key: 'system',
    label: '系统通知',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
  }
] as const

export type NoticeTab = (typeof NOTICE_CATS)[number]['key']

export const useNotice = () => {
  // 系统通知/公告列表：分页拉取，status 传 '0' 只取正常公告（关闭的不计入 total）；
  // scope='mine' 让服务端只回「全员公告 + 发给我的定向通知（如举报反馈）」；
  // 详情页按 noticeId 取单条（复用 list 权限，服务端对定向通知同样做本人校验）
  const fetchNotices = async (params: {
    pageNum?: number
    pageSize?: number
    status?: string
    noticeId?: number
  }): Promise<PageResult<NoticeItem>> => {
    const res = await apiFetch<PageResult<NoticeItem>>('/api/system/notice/list', {
      query: { scope: 'mine', ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 我发表的评论与回复（服务端按当前登录人过滤），删除后重拉由页面负责
  const fetchMyComments = async (params: { pageNum?: number; pageSize?: number }): Promise<PageResult<MyCommentItem>> => {
    const res = await apiFetch<PageResult<MyCommentItem>>('/api/post/comment/my/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  return { fetchNotices, fetchMyComments }
}
