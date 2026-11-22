import { defineNuxtConfig } from 'nuxt/config'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  app: {
    head: {
      title: '游戏速递',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'keywords', content: '单机游戏,游戏资讯,游戏攻略,游戏评测' },
        { name: 'description', content: '专注分享游戏资讯，玩家攻略，游戏存档的快乐小站，希望为玩家们提供更好的游戏体验。' }
      ],
      link: [],
      // 防闪烁：首屏绘制前按 localStorage/系统偏好挂 html.dark（与 useTheme 同步）
      script: [
        {
          innerHTML:
            "(function(){try{var m=localStorage.getItem('theme')||'light';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var el=document.documentElement;d?el.classList.add('dark'):el.classList.remove('dark')}catch(e){}})()"
        }
      ]
    }
  },
  css: ['/assets/style/tokens.less', '/assets/style/base.less'],
  // workspace 共享包进入运行时 bundle（utils 的 formatDateTime/joinFileUrl 被组件实际调用；
  // shared 目前仅类型引用，提前登记以便将来引入运行时常量时不踩 nitro standalone 缺依赖的坑）
  build: {
    transpile: ['@nest-acticle/utils', '@nest-acticle/shared']
  },
  routeRules: {
    // 首页即文章列表，旧列表地址重定向过去
    '/article/list': { redirect: { to: '/', statusCode: 301 } },
    // 个人中心 / 设置页依赖客户端 token 与登录态，关闭 SSR
    '/user/space': { ssr: false },
    '/user/settings': { ssr: false },
    // 通知中心：依赖客户端 token 与登录态，关闭 SSR
    '/notification': { ssr: false },
    // 通知/公告详情：同上，且按 id 取数需登录态
    '/notice/detail': { ssr: false },
    // 写文章：独立编辑器流程，依赖客户端 token
    '/editor/new': { ssr: false },
    // 创作者中心：依赖客户端 token 与登录态，关闭 SSR
    '/creator': { ssr: false },
    '/creator/article': { ssr: false },
    '/creator/column': { ssr: false }
  },
  runtimeConfig: {
    // /api、/profile 代理路由（server/routes/api、profile）的转发目标：
    // SSR 内部与 dev 浏览器的相对请求由此转发到真实后端；docker 由 compose 注入 http://server:8080
    apiProxyTarget: process.env.NUXT_API_PROXY_TARGET || 'http://localhost:8080',
    public: {
      // 后端入口前缀：默认空串走同源相对路径——浏览器经 nginx（docker）/ Nitro 代理（dev）访问
      // /api 与 /profile，不再依赖局域网 IP；特殊部署（无 nginx 反代）仍可用
      // NUXT_PUBLIC_API_BASE 注入绝对地址（见 .env.example）
      apiBase: process.env.NUXT_PUBLIC_API_BASE || ''
    }
  }
})
