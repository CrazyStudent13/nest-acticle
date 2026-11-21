// /api/** 代理：apiBase 改为同源相对路径后，相对请求按上下文分两路走——
// SSR 内部 $fetch/useFetch 的相对 /api 打到本 Nitro，这里转发到真实后端；
// 浏览器同源请求 docker 下由 nginx ^~ /api/ 直连后端不经此路由，dev 下则走这里（与 SSR 同路径）
// 转发目标走 runtimeConfig，docker 由 compose 注入 http://server:8080，本地 dev 默认 localhost:8080
export default defineEventHandler((event) => {
  const target = useRuntimeConfig(event).apiProxyTarget as string
  return proxyRequest(event, target + (event.node.req.url || ''))
})
