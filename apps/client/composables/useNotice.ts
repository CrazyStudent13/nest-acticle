// 通知中心数据：系统通知/公告列表 + 我发表的评论列表。
// 两个接口都按登录态过滤（未登录必 401），调用方须保证守卫先行（auth middleware / 组件级恢复）；
// 已关闭（status='1'）的公告由服务端按 status 参数过滤，分页 total 与列表一致
import type { MyCommentItem, PageResult } from '@nest-acticle/shared'

// 系统通知行数据（openapi 有对应 schema，shared 暂未沉淀线格式类型，先就地定义）
export interface NoticeItem {
  noticeId: number
  noticeTitle: string
  noticeType: string
  noticeContent: string
  status: string
  createTime: string
}

export const useNotice = () => {
  // 系统通知/公告列表：分页拉取，status 传 '0' 只取正常公告（关闭的不计入 total）
  const fetchNotices = async (params: {
    pageNum?: number
    pageSize?: number
    status?: string
  }): Promise<PageResult<NoticeItem>> => {
    const res = await apiFetch<PageResult<NoticeItem>>('/api/system/notice/list', {
      query: { ...params }
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
