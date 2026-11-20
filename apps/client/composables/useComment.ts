// 文章评论：guest 列表公开；发表/删除自己的评论要求登录态
// 服务端平铺一层评论（v1 无楼中楼），comment_num 计数在文章表冗余维护
import type { CommentItem, PageResult } from '@nest-acticle/shared'

export const useComment = () => {
  const fetchComments = async (
    articleId: number | string,
    params: { pageNum?: number; pageSize?: number } = {}
  ): Promise<PageResult<CommentItem>> => {
    const res = await apiFetch<PageResult<CommentItem>>('/api/post/comment/guest/list', {
      query: { articleId, ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  const addComment = async (
    articleId: number | string,
    content: string,
    parentId?: number
  ): Promise<CommentItem | null> => {
    const res = await apiFetch<CommentItem>('/api/post/comment', {
      method: 'POST',
      body: { articleId, content, ...(parentId ? { parentId } : {}) }
    })
    return res.data ?? null
  }

  // 返回服务端实际删除条数（含级联后代），供调用方精确回减计数
  const deleteComment = async (id: number | string): Promise<number> => {
    const res = await apiFetch<{ removed?: number }>(`/api/post/comment/${id}`, { method: 'DELETE' })
    return res.data?.removed ?? 0
  }

  return { fetchComments, addComment, deleteComment }
}
