// 分页列表（翻页替换式）：页码/总数/列表/加载态/错误态 + 加载逻辑，收编各页手写的分页块
// （通知中心 5 套、个人空间文章/专栏/点赞/收藏集 5 套；「加载更多」追加式见 useInfiniteList）。
// - 请求只由显式调用触发，内部不 watch 页码：翻页走分页器的 update:page → load(页码)，
//   切 tab/子栏、搜索或排序条件变化走 reload（回第一页）。此前「先置页码触发 watch、再显式加载」
//   的并发两发不再出现
// - 请求序号：只认最新一发，先发后到的过期响应（快速翻页、切空间、改搜索词）不落任何状态
// - 状态是组件实例级的普通 ref，不走 useState：SSR 每次请求各自独立，不跨请求串数据
import type { PageResult } from '@nest-acticle/shared'

interface PagedListOptions {
  /** 每页条数，默认 10 */
  pageSize?: number
  /** 失败时的默认提示（接口没给出 msg 时用） */
  errorMsg?: string
  /** 加载态初值：首屏要等挂载后才首次加载的页面设为 true，避免水合前闪一下空态 */
  initialLoading?: boolean
}

export const usePagedList = <T>(
  fetchPage: (params: { pageNum: number; pageSize: number }) => Promise<PageResult<T>>,
  options: PagedListOptions = {}
) => {
  const pageSize = options.pageSize ?? 10
  const page = ref(1)
  const total = ref(0)
  const list = ref<T[]>([]) as Ref<T[]>
  const loading = ref(options.initialLoading ?? false)
  const error = ref('')

  // 最新一发请求的序号；reset 也递增，用来作废在飞的旧请求
  let latestSeq = 0

  // 加载指定页（缺省为当前页）并同步页码。返回被采纳的那一页数据；失败或过期返回 null，
  // 调用方据此决定是否执行加载后的副作用
  const load = async (target = page.value): Promise<PageResult<T> | null> => {
    const seq = ++latestSeq
    page.value = target
    loading.value = true
    error.value = ''
    try {
      const data = await fetchPage({ pageNum: target, pageSize })
      if (seq !== latestSeq) {
        return null
      }
      list.value = data.list || []
      total.value = data.total || 0
      return data
    } catch (err: any) {
      if (seq !== latestSeq) {
        return null
      }
      list.value = []
      total.value = 0
      error.value = err?.message || options.errorMsg || '加载失败'
      return null
    } finally {
      // 只有最新一发负责收加载态：过期响应后到时新请求还在飞，不能提前结束 loading
      if (seq === latestSeq) {
        loading.value = false
      }
    }
  }

  // 回到第一页并加载（切 tab/子栏、搜索或排序条件变化、增删后重拉）
  const reload = () => load(1)

  // 清空回到初始态，不发请求；在飞的请求随之作废
  const reset = () => {
    latestSeq++
    page.value = 1
    total.value = 0
    list.value = []
    error.value = ''
    loading.value = false
  }

  return { page, total, list, loading, error, load, reload, reset }
}
