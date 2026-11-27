// 文章信息流「加载更多」：首页（最新/关注双 tab）、专栏详情页共用
// 第 1 页由页面自行提供（useFetch SSR 直出，或关注 tab 的客户端首屏拉取），这里负责后续页的追加；
// filters（标题搜索 / subjectId）变化时清空追加区，展示层回退到首屏数据
import type { Article, PageResult } from '@nest-acticle/shared'

// 首屏数据的宽松形状：Nuxt 对 useFetch 泛型有 PickFrom 变换，完整信封类型会导致重载解析失败，
// 这里保持部分信封 + 收紧条目类型；关注 tab 的客户端首屏也按同一形状写入
type FeedInitial = { data?: { list?: Article[]; total?: number } | null }

export const useArticleFeed = (
  initial: Ref<FeedInitial | null | undefined>,
  filters: ComputedRef<Record<string, any>>,
  pageSize = 10,
  endpoint = '/api/post/article/guest/list'
) => {
  const appended = ref<Article[]>([])
  const lastPage = ref(1)
  const lastPageShort = ref(false)
  const loading = ref(false)
  const loadError = ref('')

  const articles = computed(() => {
    const first = initial.value?.data?.list || []
    return appended.value.length ? [...first, ...appended.value] : first
  })

  const total = computed(() => initial.value?.data?.total || 0)

  // 是否已到底：优先信后端 total，缺失时按「上一页不满一页」判定
  const finished = computed(() => {
    if (total.value) {
      return articles.value.length >= total.value
    }
    return lastPageShort.value
  })

  const loadMore = async () => {
    if (loading.value || finished.value) {
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      // 统一走 apiFetch：自动携带 token（关注 feed 需要），并把非 2xx 信封转成可提示的 ApiError
      const res = await apiFetch<PageResult<Article>>(endpoint, {
        query: { ...filters.value, pageNum: lastPage.value + 1, pageSize }
      })
      const list = res.data?.list || []
      appended.value.push(...list)
      lastPage.value += 1
      if (list.length < pageSize) {
        lastPageShort.value = true
      }
    } catch (error: any) {
      loadError.value = error?.message || '加载失败'
    } finally {
      loading.value = false
    }
  }

  // 点过「加载更多」才展示「到底了」提示，单页小列表不出现
  const loadedMore = computed(() => appended.value.length > 0)

  // 清空追加区（首屏数据由调用方自行作废）：filters 变化、登录态切换时复用
  const reset = () => {
    appended.value = []
    lastPage.value = 1
    lastPageShort.value = false
    loadError.value = ''
  }

  watch(filters, () => {
    reset()
  })

  return { articles, total, loading, loadError, finished, loadedMore, loadMore, reset }
}
