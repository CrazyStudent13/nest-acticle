// 文章点赞：状态查询/点赞/取消/用户点赞列表。
// 点赞与取消均要求登录态；点赞栏列表为公开接口（个人空间对访客开放，同掘金「赞」栏），
// 本人空间与他人空间共用 guest/list（userId 区分归属）
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

  // 指定用户的点赞文章列表（个人空间点赞栏）：标题模糊搜索 + 点赞时间正/倒序
  const fetchUserLikedArticles = async (
    userId: number,
    params: {
      pageNum?: number
      pageSize?: number
      title?: string
      isAsc?: 'ascending' | 'descending'
    }
  ): Promise<PageResult<LikedArticleItem>> => {
    const res = await apiFetch<PageResult<LikedArticleItem>>('/api/post/like/guest/list', {
      query: { userId, ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  return { fetchLikeStatus, likeArticle, unlikeArticle, fetchUserLikedArticles }
}
