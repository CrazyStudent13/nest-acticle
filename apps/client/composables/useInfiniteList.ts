// 追加列表（「加载更多」式）：首页由页面 useFetch SSR 直出后交进来，这里负责后续页的客户端追加
// （翻页替换式见 usePagedList）。收藏集详情页在用；首页/专栏详情沿用更早的 useArticleFeed。
// - 追加按 keyOf 去重：首页取到之后若有新文章插到最前，下一页会把已出现在首页末尾的那条再带一遍
// - 到底判定：拿到短页（不满一页/空页）即到底；否则按累计取到的原始条数（含被去重丢弃的）
//   对比 total——去重不会让计数对不上而「加载更多」常驻
// - 请求序号：setFirst/reset/clear 都会作废在飞的加载更多，切收藏集时旧集的后续页不会追加进新集
import type { PageResult } from '@nest-acticle/shared'

interface InfiniteListOptions<T> {
  /** 取某一页；页码从 2 起（首页由页面直出） */
  fetchPage: (pageNum: number) => Promise<PageResult<T>>
  /** 去重键（列表行的唯一标识，如文章 id） */
  keyOf: (item: T) => unknown
  pageSize: number
  /** 首页数据（SSR 直出结果），缺省为空 */
  first?: T[]
  total?: number
}

export const useInfiniteList = <T>(options: InfiniteListOptions<T>) => {
  const { pageSize, keyOf, fetchPage } = options
  const first = ref<T[]>(options.first ? [...options.first] : []) as Ref<T[]>
  const appended = ref<T[]>([]) as Ref<T[]>
  const total = ref(options.total || 0)
  // 累计取到的原始条数（含被去重丢弃的），用于到底判定
  const fetched = ref(first.value.length)
  const lastPage = ref(1)
  // 最后一页不满一页：服务端已无更多
  const lastPageShort = ref(false)
  const loading = ref(false)
  const loadError = ref('')

  let latestSeq = 0

  const items = computed(() => (appended.value.length ? [...first.value, ...appended.value] : first.value))

  // 是否已到底
  const finished = computed(() => lastPageShort.value || (total.value > 0 && fetched.value >= total.value))

  // 点过「加载更多」才展示「到底了」提示，单页小列表不出现
  const loadedMore = computed(() => appended.value.length > 0)

  // 与首页、已追加的行比对 key，滤掉重复行
  const dropDuplicates = (list: T[]) => {
    const seen = new Set<unknown>()
    const mark = (item: T) => seen.add(keyOf(item))
    first.value.forEach(mark)
    appended.value.forEach(mark)
    return list.filter((item) => {
      const key = keyOf(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  // 加载下一页并追加；加载中或已到底时不发请求
  const loadMore = async () => {
    if (loading.value || finished.value) {
      return
    }
    const seq = ++latestSeq
    loading.value = true
    loadError.value = ''
    try {
      const data = await fetchPage(lastPage.value + 1)
      // 期间切了集/重置了列表：旧集的这一页不追加
      if (seq !== latestSeq) {
        return
      }
      const list = data.list || []
      appended.value.push(...dropDuplicates(list))
      lastPage.value += 1
      if (list.length < pageSize) {
        lastPageShort.value = true
      }
      fetched.value += list.length
    } catch (err: any) {
      if (seq !== latestSeq) {
        return
      }
      loadError.value = err?.message || '加载失败'
    } finally {
      if (seq === latestSeq) {
        loading.value = false
      }
    }
  }

  // 追加区回到第 1 页的初始态（首页不动），在飞的加载更多随之作废
  const resetAppended = () => {
    latestSeq++
    appended.value = []
    lastPage.value = 1
    lastPageShort.value = false
    fetched.value = first.value.length
    loadError.value = ''
    loading.value = false
  }

  // 只清追加区，首页保留（编辑收藏集后重置列表）
  const reset = () => {
    resetAppended()
  }

  // 整个清空（首页一并清掉），切收藏集时用：URL 已指向新集，旧集首页一帧都不许留
  const clear = () => {
    first.value = []
    total.value = 0
    resetAppended()
  }

  // 用带登录态重拉的第一页覆盖首页（私密集本人访问时 SSR 无 token 拿不到列表），追加区回到第 1 页
  const setFirst = (list: T[], totalCount: number) => {
    first.value = list
    total.value = totalCount
    resetAppended()
  }

  // 本地移除一行（移出收藏集后不整页刷新）：首页与追加区一并找，命中才同步扣减 total
  const remove = (key: unknown) => {
    let removed = false
    if (first.value.some((item) => keyOf(item) === key)) {
      first.value = first.value.filter((item) => keyOf(item) !== key)
      removed = true
    }
    if (appended.value.some((item) => keyOf(item) === key)) {
      appended.value = appended.value.filter((item) => keyOf(item) !== key)
      removed = true
    }
    if (removed) {
      total.value = Math.max(0, total.value - 1)
      fetched.value = Math.max(0, fetched.value - 1)
    }
    return removed
  }

  return { items, total, finished, loadedMore, loading, loadError, loadMore, setFirst, reset, clear, remove }
}
