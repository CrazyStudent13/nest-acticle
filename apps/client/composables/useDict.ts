// 数据字典：按类型拉取字典项，供下拉/标签展示使用（对齐 admin 端 useDict 的用法）
// 接口 GET /system/dict/data/type/:dictType 只要求登录态、无权限串，注册用户可读——
// guest 页不要无条件调用（游客 401 会触发统一出口弹登录框），需要时传 enabled 挂在登录态上
// useState 全局缓存：单页会话内同类型只请求一次；失败静默保持空数组，调用方按空字典兜底
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
        // 拉取失败保持空数组：下拉无选项、标签不展示
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
