// 专栏：创作者中心的列表/新建/编辑/删除 + 公开（guest）列表。
// 管理接口要求登录态（服务端按创建者校验归属）；guest 列表公开可看（编辑器发布弹窗选专栏、个人空间专栏栏）
import type { PageResult, Subject } from '@nest-acticle/shared'

export const useSubject = () => {
  // 专栏列表（登录接口）：创作者中心按 userId 只查自己的，标题模糊搜索 + 排序分页
  const fetchSubjects = async (params: {
    userId: number
    pageNum?: number
    pageSize?: number
    orderByColumn?: string
    isAsc?: string
    title?: string
  }): Promise<PageResult<Subject>> => {
    const res = await apiFetch<PageResult<Subject>>('/api/post/subject/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 专栏公开列表（guest 接口，不要求登录）：带 userId 时查指定用户的专栏，不带时全量已发布专栏
  const fetchGuestSubjects = async (params: { userId?: number; pageNum?: number; pageSize?: number }): Promise<PageResult<Subject>> => {
    const res = await apiFetch<PageResult<Subject>>('/api/post/subject/guest/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 新建专栏：publishStatus 由调用方决定（公开站新建须显式传 '2'，后端默认 '0' 草稿不对访客展示）
  const createSubject = async (payload: Partial<Subject> & { title: string }) => {
    await apiFetch('/api/post/subject', { method: 'POST', body: payload })
  }

  // 编辑为补丁式更新：只传变更字段（不传 publishStatus 保持原状态）
  const updateSubject = async (payload: Partial<Subject> & { id: number; title: string }) => {
    await apiFetch('/api/post/subject', { method: 'PUT', body: payload })
  }

  // 删除（软删除）
  const deleteSubject = async (id: number | string) => {
    await apiFetch(`/api/post/subject/${id}`, { method: 'DELETE' })
  }

  return { fetchSubjects, fetchGuestSubjects, createSubject, updateSubject, deleteSubject }
}
