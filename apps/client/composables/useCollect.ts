// 收藏集：列表/详情/集内文章/订阅列表（公开）+ 收藏集 CRUD、收藏/移出、订阅/退订、收到的收藏（登录）。
// 收藏动作要求登录态且仅能操作自己的收藏集；guest 端点公开可看（个人空间收藏集栏对访客开放，
// 本人可见自己的私密集），本人空间与他人空间共用 guest/list（userId 区分归属）
import type { Collection, CollectionArticleItem, CollectionStatusItem, PageResult, ReceivedCollectItem } from '@nest-acticle/shared'

export const useCollect = () => {
  // 指定用户的收藏集列表（个人空间收藏集栏，guest 接口可选登录：本人含私密集）
  const fetchGuestCollections = async (
    userId: number,
    params: { pageNum?: number; pageSize?: number }
  ): Promise<PageResult<Collection>> => {
    const res = await apiFetch<PageResult<Collection>>('/api/post/collection/guest/list', {
      query: { userId, ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 收藏集详情（含创建者公开信息与当前登录者的订阅状态/归属标记）
  const fetchCollectionDetail = async (id: number | string): Promise<Collection & { isMine?: boolean; isSubscribed?: boolean } | null> => {
    const res = await apiFetch<Collection & { isMine?: boolean; isSubscribed?: boolean }>(`/api/post/collection/guest/detail`, {
      query: { id }
    })
    return res.data ?? null
  }

  // 收藏集内文章列表（已发布文章按收藏时间倒序）
  const fetchCollectionArticles = async (
    collectionId: number | string,
    params: { pageNum?: number; pageSize?: number; title?: string }
  ): Promise<PageResult<CollectionArticleItem>> => {
    const res = await apiFetch<PageResult<CollectionArticleItem>>('/api/post/collection/guest/articles', {
      query: { collectionId, ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 指定用户订阅的收藏集列表（我订阅的/他人的订阅列表，仅公开收藏集）
  const fetchGuestSubscribed = async (
    userId: number,
    params: { pageNum?: number; pageSize?: number }
  ): Promise<PageResult<Collection>> => {
    const res = await apiFetch<PageResult<Collection>>('/api/post/collection/guest/subscribed', {
      query: { userId, ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  // 当前用户各收藏集对某文章的收藏状态（收藏弹窗勾选数据源）
  const fetchCollectStatus = async (articleId: number | string): Promise<CollectionStatusItem[]> => {
    const res = await apiFetch<CollectionStatusItem[]>(`/api/post/collection/status/${articleId}`)
    return res.data ?? []
  }

  // 新建收藏集
  const createCollection = async (payload: { name: string; desc?: string; visibility?: string }): Promise<Collection | null> => {
    const res = await apiFetch<Collection>('/api/post/collection', { method: 'POST', body: payload })
    return res.data ?? null
  }

  // 编辑收藏集（补丁式，只传变更字段）
  const updateCollection = async (payload: { id: number; name?: string; desc?: string; visibility?: string }) => {
    await apiFetch('/api/post/collection', { method: 'PUT', body: payload })
  }

  // 删除收藏集（软删，收藏/订阅关系一并清理）
  const deleteCollection = async (id: number | string) => {
    await apiFetch(`/api/post/collection/${id}`, { method: 'DELETE' })
  }

  // 收藏文章进收藏集
  const collectArticle = async (collectionId: number | string, articleId: number | string) => {
    const res = await apiFetch<{ collected: boolean; articleCount: number }>(`/api/post/collection/${collectionId}/${articleId}`, {
      method: 'POST'
    })
    return res.data ?? null
  }

  // 移出收藏
  const uncollectArticle = async (collectionId: number | string, articleId: number | string) => {
    const res = await apiFetch<{ collected: boolean; articleCount: number }>(`/api/post/collection/${collectionId}/${articleId}`, {
      method: 'DELETE'
    })
    return res.data ?? null
  }

  // 订阅收藏集
  const subscribeCollection = async (id: number | string) => {
    const res = await apiFetch<{ subscribed: boolean; subscriberCount: number }>(`/api/post/collection/${id}/subscribe`, {
      method: 'POST'
    })
    return res.data ?? null
  }

  // 退订收藏集
  const unsubscribeCollection = async (id: number | string) => {
    const res = await apiFetch<{ subscribed: boolean; subscriberCount: number }>(`/api/post/collection/${id}/subscribe`, {
      method: 'DELETE'
    })
    return res.data ?? null
  }

  // 收到的收藏（通知中心赞和收藏栏）
  const fetchReceivedCollects = async (
    params: { pageNum?: number; pageSize?: number; title?: string }
  ): Promise<PageResult<ReceivedCollectItem>> => {
    const res = await apiFetch<PageResult<ReceivedCollectItem>>('/api/post/collection/received/list', {
      query: { ...params }
    })
    return res.data ?? { list: [], total: 0 }
  }

  return {
    fetchGuestCollections,
    fetchCollectionDetail,
    fetchCollectionArticles,
    fetchGuestSubscribed,
    fetchCollectStatus,
    createCollection,
    updateCollection,
    deleteCollection,
    collectArticle,
    uncollectArticle,
    subscribeCollection,
    unsubscribeCollection,
    fetchReceivedCollects
  }
}
