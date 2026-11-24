# Admin 端概览

Vue3 + Element Plus + Vite 单页管理后台，monorepo 三应用之一（后端 `apps/server`、前台 `apps/client`）。基于 RuoYi-Vue3 模板深度改造：权限/菜单/字典体系保留，业务层重写为 monorepo 契约驱动。

## 技术栈

- Vue 3（`<script setup>` 全覆盖）+ TypeScript（composables 层）
- Element Plus + unplugin 自动导入（API 与组件）
- Vite（插件在 `vite/plugins/`：auto-import / compression / svg-icon 等）
- 状态与请求：`useCrud` 列表范式 + `useRequest` 单例 axios（token 注入、防重提、信封错误归一）

## 本地开发

```bash
# 仓库根目录
pnpm install
pnpm --filter admin dev        # 端口 8888；被占用用 dev:clean 先释放
pnpm --filter admin build:prod # 生产构建
```

容器栈内入口为 `http://localhost:8081`（blog-nginx 反代），API 统一 `/api` 前缀。

## 权限体系两件套

| 层 | 机制 | 说明 |
|---|---|---|
| 页面/按钮 | `v-hasPermi` / `v-hasRole` 指令 | 全仓 18+ 处消费；权限串与 `apps/server/db/init.sql` 菜单种子逐字符一致（大小写敏感，曾有惨案） |
| 程序化判断 | `useAuth()` 组合式函数 | 动态路由过滤（`store/modules/permission.ts` 的 `filterDynamicRoutes`）与非模板场景 |

## 本目录文档

- [Element Plus 自动导入](./element-plus-auto-import)
- [useAuth 权限验证](./useauth)

入口文档：`apps/admin/README.md`。
