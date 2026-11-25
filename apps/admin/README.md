# nest-acticle 管理后台（admin）

Vue3 + Element Plus + Vite 单页管理端，是 monorepo 的三个应用之一（后端 `apps/server`、前台 `apps/client`、本文档 `apps/admin`）。基于 RuoYi-Vue3 模板深度改造：权限/菜单/字典体系保留，业务层已全部重写为 monorepo 契约驱动。

## 开发

```bash
# 仓库根目录一次性安装（pnpm workspace，Node >= 20.19）
pnpm install

# 起管理端 dev server（端口 8888；被占用时用 dev:clean 先释放）
pnpm --filter admin dev
# 或
pnpm --filter admin dev:clean
```

生产构建 `pnpm --filter admin build:prod`（产物在 `dist/`，容器化部署见根目录 `docker-compose.yml`）。

本地栈口径：管理后台入口 http://localhost:8081 （compose nginx 反代），API 统一走 `/api` 前缀。

## 权限与鉴权

- 页面/按钮级：`v-hasPermi` / `v-hasRole` 自定义指令（18+ 处消费），权限串与 `apps/server/db/init.sql` 菜单种子逐字符一致
- 程序化判断/动态路由过滤：`useAuth()` 组合式函数（`src/composables/useAuth.ts`），由 `vite/plugins/auto-import.ts` 自动导入
- 请求层：`src/composables/useRequest.ts` 单例 axios（token 注入、防重提、信封错误归一）；列表页统一走 `useCrud` 范式

## 自动导入

Element Plus API/组件与 `src/composables/*` 均已配置自动导入，无需手动 import。机制说明见文档站：

- [Element Plus 自动导入](../../docs/admin/element-plus-auto-import.md)
- [useAuth 权限验证](../../docs/admin/useauth.md)

## 项目文档站

开发/部署全量文档在 `apps/docs`（VitePress）：本地开发 `pnpm --filter docs dev` 后访问 http://localhost:6173/manual/ （热更新）；容器栈内由 blog-nginx 托管为 http://localhost:8888/manual/ （静态构建，随 `docker compose up -d --build` 更新）。含在线部署、自动部署密钥配置、开发协作规范与发布记录。
