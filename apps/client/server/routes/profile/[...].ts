// /profile/** 代理：apiBase 为相对路径后，封面/头像等上传资源在 dev 下没有 nginx 反代，
// 这里补上到后端静态服务的转发；docker 下 nginx ^~ /profile/ 已直连后端，此路由不会被命中
// （client 只消费 /profile，/uploads 是 admin 侧路径，不在此代理）
export default defineEventHandler((event) => {
  const target = useRuntimeConfig(event).apiProxyTarget as string
  return proxyRequest(event, target + (event.node.req.url || ''))
})
