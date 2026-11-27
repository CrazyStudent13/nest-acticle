// 创作者文章管理：文章列表（登录接口，按 userId 过滤）、上下架、删除，另含指定用户的公开（guest）列表。
// publishStatus/auditStatus 只能经专门端点流转、计数由服务端维护（服务端 DTO 已剥离这些可写字段），
// 上下架走 PUT 补丁式更新（title/subjectId 为 DTO 必填）
import type { Article, PageResult } from '@nest-acticle/shared'

export const useArticleManage = () => {
  // 我的文章列表（创作者中心数据源）：走 /my/list（服务端强制只查当前登录人，不挂权限串）——
  // 注册用户角色（member）没有 post:article:list，管理端 /list 不能用；
  // 状态 tab（publishStatus/auditStatus）、标题模糊搜索、排序、分页全部 query 透传，
  // userId 参数保留透传但服务端会强制覆盖为登录人
  const fetchArticles = async (params: {
    userId: number
    pageNum?: number
    pageSize?: number
    orderByColumn?: string
    isAsc?: string
    title?: string
    publishStatus?: string
    auditStatus?: string
  }): Promise<PageResult<Article>> => {
    const res = await apiFetch<PageResult<Article>>('/api/post/article/my/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 指定用户的已发布文章列表（guest 公开接口，不要求登录）：个人空间文章栏用，标题搜索 + 时间正/倒序
  const fetchGuestArticles = async (params: {
    userId: number
    pageNum?: number
    pageSize?: number
    orderByColumn?: string
    isAsc?: string
    title?: string
  }): Promise<PageResult<Article>> => {
    const res = await apiFetch<PageResult<Article>>('/api/post/article/guest/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 下架/重新发布：PUT 补丁式更新，只传状态字段（title/subjectId 为 DTO 必填）不影响内容
  const updateArticle = async (payload: { id: number; title: string; subjectId?: number; publishStatus: string }) => {
    await apiFetch('/api/post/article', { method: 'PUT', body: payload })
  }

  // 删除（软删除）
  const deleteArticle = async (id: number | string) => {
    await apiFetch(`/api/post/article/${id}`, { method: 'DELETE' })
  }

  return { fetchArticles, fetchGuestArticles, updateArticle, deleteArticle }
}
