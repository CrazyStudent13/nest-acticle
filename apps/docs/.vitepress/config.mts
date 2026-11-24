import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/manual/',
  title: 'nest-acticle 文档',
  description: 'nest-acticle 的部署与开发文档',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '部署', link: '/deploy-online/step' },
      { text: 'Admin 端', link: '/admin/overview' },
      { text: 'Client 端', link: '/client/overview' },
      { text: '开发', link: '/development-tips/partner' },
      { text: '发布记录', link: '/releases' },
    ],

    // 全站统一侧栏：所有分组同屏展示（在线部署/自动部署/Admin 端/Client 端/开发/发布记录）
    sidebar: [
      {
        text: '在线部署',
        items: [
          { text: '部署概览', link: '/deploy-online/step' },
          { text: 'MySQL', link: '/deploy-online/mysql' },
          { text: 'Redis', link: '/deploy-online/redis' },
          { text: 'PM2', link: '/deploy-online/pm2' },
          { text: 'Nginx', link: '/deploy-online/nginx' },
        ],
      },
      {
        text: '自动部署',
        items: [
          { text: '最小闭环', link: '/deploy-online/auto-deploy-overview' },
          { text: '密钥配置', link: '/deploy-online/auto-deploy-secrets' },
          { text: '问题排查', link: '/deploy-online/auto-deploy-troubleshooting' },
          { text: '命令速查', link: '/deploy-online/auto-deploy-checklist' },
        ],
      },
      {
        text: 'Admin 端',
        items: [
          { text: '概览', link: '/admin/overview' },
          { text: 'Element Plus 自动导入', link: '/admin/element-plus-auto-import' },
          { text: 'useAuth 权限验证', link: '/admin/useauth' },
        ],
      },
      {
        text: 'Client 端',
        items: [
          { text: '概览', link: '/client/overview' },
          { text: '开发约定', link: '/client/conventions' },
        ],
      },
      {
        text: '开发',
        items: [{ text: '协作开发', link: '/development-tips/partner' }],
      },
      {
        text: '发布记录',
        items: [
          { text: 'v1.2.1 · 2026-11-23', link: '/releases#v1-2-1' },
          { text: 'v1.2.0 · 2026-11-17', link: '/releases#v1-2-0' },
          { text: 'v1.1.0 · 2026-11-15', link: '/releases#v1-1-0' },
          { text: 'v1.0.1 · 2026-10-25', link: '/releases#v1-0-1' },
          { text: 'v1.0.0 · 2026-10-25', link: '/releases#v1-0-0' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CrazyStudent13/nest-acticle' },
    ],
  },
})
