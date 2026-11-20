// 后端统一请求封装：拼 apiBase、携带 token、解析 { code, msg, data } 信封
// 页面级数据请求仍走 useFetch（可 SSR），此处供事件触发的交互型请求（登录等）使用
// 后端约定：HTTP 状态恒为 200，业务错误体现在 body.code（401/404/500）
// 信封契约类型来自 @nest-acticle/shared（server ResultData 的镜像）
import type { ApiResponse } from '@nest-acticle/shared'

// 401 统一出口：token 缺失/失效时清空本地登录态并弹登录框（原先 401 只抛错，各页 catch 行为不一）
// 克制原则（防循环/防重复弹）：
// - 登录/退出接口自身的 401 不处理：登录失败弹框会叠在打开的登录框上，退出接口的 401 再弹登录框属循环体验
// - 弹窗已打开时只清态不重复弹：一次导航内并发多个 401 请求只弹一次
const handleUnauthorized = (url: string) => {
  if (url.startsWith('/api/login') || url.startsWith('/api/logout')) {
    return
  }
  useUser().clearLocalAuth()
  const { isOpen, openLogin } = useAuthModal()
  if (!isOpen.value) {
    openLogin()
  }
}

export const apiFetch = async <T = any>(url: string, opts: Record<string, any> = {}): Promise<ApiResponse<T>> => {
  const config = useRuntimeConfig()
  try {
    const body = await $fetch<ApiResponse<T>>(`${config.public.apiBase}${url}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${getToken() || ''}`,
        ...(opts.headers || {})
      }
    })
    if (body.code !== 200) {
      if (body.code === 401) {
        handleUnauthorized(url)
      }
      throw new Error(body.msg || '请求失败')
    }
    return body
  } catch (error: any) {
    // ofetch 的 HTTP 层错误（非 2xx）带 data.msg，统一转成带 msg 的 Error 供调用方提示
    // HTTP 层 401（信封约定之外的形态）同样走统一出口
    if (error?.status === 401 || error?.data?.code === 401) {
      handleUnauthorized(url)
    }
    throw new Error(error?.data?.msg || error?.message || '请求失败')
  }
}
