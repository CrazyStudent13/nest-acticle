// robots.txt：允许全站抓取并指向 sitemap（地址从请求头推导，兼容开发/生产环境）；接口文档路径不收录
export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host') || 'localhost'
  const proto = getRequestHeader(event, 'x-forwarded-proto') || 'http'

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return `User-agent: *\nAllow: /\nDisallow: /openapi.json\nDisallow: /swagger-ui\nDisallow: /docs\n\nSitemap: ${proto}://${host}/sitemap.xml\n`
})
