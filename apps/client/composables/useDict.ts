// 数据字典：按类型拉取字典项，供下拉/标签展示使用（对齐 admin 端 useDict 的用法）
// 接口 GET /system/dict/data/type/:dictType 只要求登录态、无权限串，注册用户可读
// useState 全局缓存：单页会话内同类型只请求一次；失败静默保持空数组，调用方按空字典兜底
export interface DictDataItem {
  dictLabel: string
  dictValue: string
}

export const useDict = (dictType: string) => {
  const cache = useState<Record<string, DictDataItem[]>>('client-dict', () => ({}))

  // 先占位空数组避免同类型重复请求，成功后整体替换触发响应式更新
  if (import.meta.client && !cache.value[dictType]) {
    cache.value = { ...cache.value, [dictType]: [] }
    apiFetch(`/api/system/dict/data/type/${dictType}`)
      .then((res) => {
        cache.value = { ...cache.value, [dictType]: (res.data as DictDataItem[]) || [] }
      })
      .catch(() => {
        // 拉取失败保持空数组：下拉无选项、标签不展示
      })
  }

  return computed(() => cache.value[dictType] || [])
}
