// 文章点赞：状态查询/点赞/取消/我的点赞列表。
// 点赞与取消均要求登录态；「我的点赞」按登录态返回本人点赞过的已发布文章（个人空间点赞栏）
import type { LikedArticleItem, LikeActionResult, PageResult } from '@nest-acticle/shared'

export const useLike = () => {
  const fetchLikeStatus = async (articleId: number | string): Promise<boolean> => {
    const res = await apiFetch<{ liked: boolean }>(`/api/post/like/status/${articleId}`)
    return !!res.data?.liked
  }

  const likeArticle = async (articleId: number | string): Promise<LikeActionResult | null> => {
    const res = await apiFetch<LikeActionResult>(`/api/post/like/${articleId}`, { method: 'POST' })
    return res.data ?? null
  }

  const unlikeArticle = async (articleId: number | string): Promise<LikeActionResult | null> => {
    const res = await apiFetch<LikeActionResult>(`/api/post/like/${articleId}`, { method: 'DELETE' })
    return res.data ?? null
  }

  // 我的点赞文章列表（个人空间点赞栏）：标题模糊搜索 + 点赞时间正/倒序
  const fetchMyLikedArticles = async (params: {
    pageNum?: number
    pageSize?: number
    title?: string
    isAsc?: 'ascending' | 'descending'
  }): Promise<PageResult<LikedArticleItem>> => {
    const res = await apiFetch<PageResult<LikedArticleItem>>('/api/post/like/my/list', { query: params })
    return res.data ?? { list: [], total: 0 }
  }

  return { fetchLikeStatus, likeArticle, unlikeArticle, fetchMyLikedArticles }
}
