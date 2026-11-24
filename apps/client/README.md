# nest-acticle client（前台）

基于 Nuxt 4 的内容展示端（文章 / 专栏 / 收藏集 / 通知，SSR 渲染），monorepo 三应用之一（后端 `apps/server`、管理端 `apps/admin`）。

## Tech Stack

- Nuxt 4 + Vue 3
- Less（设计变量见 `assets/style/tokens.less`）
- Markdown 渲染与编辑器为 monorepo 共享包：`@nest-acticle/markdown`（内含 markdown-it + highlight.js）、`@nest-acticle/editor`——前台/管理端/预览同源同效果
- pnpm + Volta

## Version Policy

- Volta 锁定 Node（当前 `22.22.2`，见根 `package.json` 的 `volta.node`）
- `packageManager` 锁定 pnpm（当前 `10.33.0`）
- `engines` + `.npmrc` 的 `engine-strict=true` / `package-manager-strict=true` 安装期尽早失败
- 升级 Node / pnpm / Nuxt 时同步更新 `volta`、`packageManager`、`engines` 与本文档

## Setup

仓库根目录一次性安装（pnpm workspace）：

```bash
pnpm install
```

## Development

```bash
pnpm --filter client dev        # Nuxt dev server
pnpm --filter client typecheck  # nuxt typecheck（vue-tsc）
```

## Production

```bash
pnpm --filter client build      # 产物 .output/，容器化见根 docker-compose.yml
pnpm --filter client preview    # 本地预览生产构建
```

## API 地址

不配置任何后端地址：接口一律走**同源相对路径 + Nitro 代理转发**（见 `nuxt.config.ts` 的 proxy 段与 `composables/api.ts`），开发与生产同构，换网络/换服务器无需改动（旧的 `NUXT_PUBLIC_API_BASE` 机制已移除）。栈内部署由 blog-nginx 统一反代 `/api`。

## Docs

开发约定、通知红标、点赞/收藏/评论范式等详见文档站 **Client 端** 分组（`apps/docs`，`pnpm --filter docs dev` 后 http://localhost:6173/manual/ ）。

## Team Notes

- 统一 pnpm，不要 `npm install` / `yarn install`
- 服务器地址、密钥等敏感信息不进源码与版本库（本地密钥已无入库面，`local-config` 体系已废止）
