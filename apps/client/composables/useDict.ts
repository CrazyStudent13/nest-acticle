// 数据字典：按类型拉取字典项，供下拉/标签展示使用（对齐 admin 端 useDict 的用法）
// 接口 GET /system/dict/data/type/:dictType 游客可读公开字典（is_public=Y，如文章来源/用户性别），
// 非公开字典游客返回 403、登录用户不限——guest 页按需调用即可，失败静默为空数组并清除缓存键，
// 登录后 watch(enabled) 再触发时可重试；useState 全局缓存：单页会话内同类型只请求一次
import type { Ref } from 'vue'

export interface DictDataItem {
  dictLabel: string
  dictValue: string
}

export const useDict = (dictType: string, options?: { enabled?: Ref<boolean> }) => {
  const cache = useState<Record<string, DictDataItem[]>>('client-dict', () => ({}))

  // 先占位空数组避免同类型重复请求，成功后整体替换触发响应式更新
  const load = () => {
    if (cache.value[dictType]) {
      return
    }
    cache.value = { ...cache.value, [dictType]: [] }
    apiFetch(`/api/system/dict/data/type/${dictType}`)
      .then((res) => {
        cache.value = { ...cache.value, [dictType]: (res.data as DictDataItem[]) || [] }
      })
      .catch(() => {
        // 拉取失败移除占位键（消费方经 || [] 按空数组兜底）：保留键会因 cache 命中永久跳过重拉，
        // 登录前 403（非公开字典）后登录成功 watch(enabled) 再触发也无法恢复——移除后下次触发即可重试
        cache.value = Object.fromEntries(Object.entries(cache.value).filter(([key]) => key !== dictType))
      })
  }

  if (import.meta.client) {
    if (options?.enabled) {
      // 条件拉取：enabled 变 true 时才发请求（如空间页仅自己的空间需要性别标签）
      watch(
        options.enabled,
        (value) => {
          if (value) {
            load()
          }
        },
        { immediate: true }
      )
    } else {
      load()
    }
  }

  return computed(() => cache.value[dictType] || [])
}
