// 文章点赞：状态查询/点赞/取消。均要求登录态，未登录的引导逻辑由调用方处理
// 服务端一人一文一条点赞记录（post_like uk_article_user），点赞/取消幂等
import type { LikeActionResult } from '@nest-acticle/shared'

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

  return { fetchLikeStatus, likeArticle, unlikeArticle }
}
