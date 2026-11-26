// 后端统一请求封装：拼 apiBase、携带 token、解析 { code, msg, data } 信封
// 页面级数据请求仍走 useFetch（可 SSR），此处供事件触发的交互型请求（登录等）使用
// 后端约定：错误协议已迁移——业务异常抛真实 HTTP 状态码，由 AllExceptionsFilter 统一出 { code, msg, data } 信封
// （信封 code 为业务码，多数与 HTTP 状态一致，专属业务码可与之不同，如 602 账号已存在归 HTTP 500，前端以信封 code 为准）
// 信封契约类型来自 @nest-acticle/shared（server ResultData 的镜像）
import type { ApiResponse } from '@nest-acticle/shared'

// 请求失败统一抛 ApiError：message 为可直接提示的 msg，code 为信封业务码，data 为信封附带数据
// （如账号停用 603 携带 { stopTime, stopReason } 供登录弹窗渲染），调用方按 error.code 读取即可，不必 instanceof
export class ApiError extends Error {
  readonly code: number

  readonly data: any

  constructor(code: number, message: string, data: any = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

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

// HTTP 层错误（非 2xx）的业务码：响应体仍是信封时取 body.code，否则退回 HTTP 状态，都没有按 500
const httpErrorCode = (error: any): number => Number(error?.data?.code ?? error?.status ?? error?.statusCode) || 500

export const apiFetch = async <T = any>(url: string, opts: Record<string, any> = {}): Promise<ApiResponse<T>> => {
  const config = useRuntimeConfig()
  // silent401：静默恢复登录态等后台调用用——401 只抛错不弹登录框不清态，
  // 由调用方兜底（公开页保持游客态继续渲染，需要登录的页面由 auth middleware 拦）
  const { silent401, ...fetchOpts } = opts
  let body: ApiResponse<T>
  try {
    body = await $fetch<ApiResponse<T>>(`${config.public.apiBase}${url}`, {
      ...fetchOpts,
      headers: {
        Authorization: `Bearer ${getToken() || ''}`,
        ...(fetchOpts.headers || {})
      }
    })
  } catch (error: any) {
    // ofetch 的 HTTP 层错误（非 2xx）带 data.msg，统一转成带 msg 的 ApiError 供调用方提示；
    // 业务异常走真实 HTTP 状态码（如撞号 602 → HTTP 500），信封业务码从响应体取回
    // HTTP 层 401（信封约定之外的形态）同样走统一出口
    if (error?.status === 401 || error?.data?.code === 401) {
      if (!silent401) {
        handleUnauthorized(url)
      }
    }
    throw new ApiError(httpErrorCode(error), error?.data?.msg || error?.message || '请求失败', error?.data?.data ?? null)
  }
  // HTTP 200 但信封 code 非 200：业务码原样透出
  if (body.code !== 200) {
    if (body.code === 401 && !silent401) {
      handleUnauthorized(url)
    }
    throw new ApiError(body.code, body.msg || '请求失败', body.data ?? null)
  }
  return body
}
