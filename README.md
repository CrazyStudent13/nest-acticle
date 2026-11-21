# nest-acticle · 博客平台 monorepo

> 当前版本 **v1.1.0** · 更新记录见 [CHANGELOG.md](./CHANGELOG.md)

一个仓库包含完整的博客平台三件套，共用同一套 NestJS 后端接口与用户体系：

| 应用 | 目录 | 技术 | 说明 |
|---|---|---|---|
| `server` | `apps/server` | NestJS 10 + TypeORM + MySQL + Redis | 后端 API（RuoYi 移植版），全局限流/helmet/Swagger |
| `admin` | `apps/admin` | Vue 3 + Element Plus + Vite 8 | 后台管理系统（内容审核、RBAC、文件管理、监控等） |
| `client` | `apps/client` | Nuxt 4 + 自绘 Less 设计系统 | 面向用户的博客前台（SSR/SEO、创作者中心、通知中心） |

共享包（各应用经 `workspace:*` 引用）：

| 包 | 目录 | 内容 |
|---|---|---|
| `@nest-acticle/shared` | `packages/shared` | 契约层：响应信封/分页/状态枚举/文章·专栏类型/业务码/权限字面量，零运行时依赖 |
| `@nest-acticle/utils` | `packages/utils` | 纯函数：validation/tree/date/query-string/url（仅 dayjs 依赖） |
| `@nest-acticle/markdown` | `packages/markdown` | Markdown 渲染器（client/admin 同源）：代码块复制/highlight.js/KaTeX/mermaid 懒加载/lightbox |
| `@nest-acticle/editor` | `packages/editor` | 共享 Markdown 编辑器组件（工具栏/快捷键/预览/粘贴与拖拽上传，上传经回调注入） |
| `@nest-acticle/eslint-config` | `packages/eslint-config` | ESLint flat config 预设：`tsPreset`（server）/`vuePreset`（admin） |

> 整合方案与全部决策细节见 [INTEGRATION-PLAN.md](./INTEGRATION-PLAN.md)。
> 上游来源：`nest-admin`（v1.2.0）与 `nuxt3-article`（2026-11-17 快照）。

## 架构与端口

```
浏览器 ──> 博客入口 nginx :8888 ──> /            → client (Nuxt SSR :3000)
                                └─> /api /profile → server (:8080)
浏览器 ──> 管理端 nginx  :8081 ──> /            → admin 静态资源
                                └─> /api /profile → server (:8080)
```

| 环境 | server | 管理端 | 博客 | MySQL | Redis |
|---|---|---|---|---|---|
| 本地开发 | `:8080`（接口带 `/api` 前缀，[Swagger](http://localhost:8080/api/swagger-ui/)） | `:8888` | `:3000` | compose 容器 `127.0.0.1:3306` | compose 容器 `127.0.0.1:6379` |
| docker 全套 | 容器内（经 nginx 代理） | `:8081` | `:8888` | 容器（`127.0.0.1:3306`） | 容器（`127.0.0.1:6379`） |

## 快速开始

前置：**Node ≥ 20.19（推荐 22.22.2，见 `.nvmrc`）**、pnpm 10.x（`packageManager` 已钉 10.33.0）、Docker（提供 MySQL/Redis）。

```bash
pnpm install                      # 根目录一次安装三个应用
cp .env.example .env              # 按需修改（密码/JWT 密钥/MAIL_*）
```

### 方式 A：docker 全套（一键起完整平台）

```bash
docker compose up -d --build      # mysql/redis/server/client/blog-nginx/admin 六个服务
```

- 博客前台：<http://localhost:8888>　- 管理端：<http://localhost:8081>
- MySQL 数据首次启动自动导入 `apps/server/db/init.sql`（20 张表 + 种子数据）
- 上传文件持久化在 `server_upload` 卷；`docker compose down` 不丢数据，`down -v` 才会清库

> 局域网/公网访问博客时，请在 `.env` 把 `NUXT_PUBLIC_API_BASE` 设为实际访问地址
> （如 `http://192.168.x.x:8888`）。默认 `http://localhost:8888` 只适合本机浏览器——
> SSR 容器内无法用 localhost 回源到宿主机端口。

### 方式 B：本地开发（前后端热更新）

```bash
docker compose up -d mysql redis  # 只起数据库
pnpm dev                          # 同时起 server(:8080) + admin(:8888) + client(:3000) + docs(:6173)
```

也可单独启动：`pnpm dev:server` / `pnpm dev:admin` / `pnpm dev:client` / `pnpm dev:docs`。
**项目说明文档**（VitePress）随 `pnpm dev` 一起启动：直访 <http://localhost:6173/manual/>，
或经管理端代理访问 <http://localhost:8888/manual/>。
> 端口说明：本机 Windows 将 5173 划入 Hyper-V 保留端口段（`netsh interface ipv4 show excludedportrange protocol=tcp` 可查），故文档站改用 6173。
后端配置在 `apps/server/src/config/env/dev.yml`——**含真实凭据，不入库**；新环境复制
`dev.example.yml` 为 `dev.yml` 后填写（本地 compose 起步用模板默认值即可），也可全部用
环境变量覆盖。注意模板中 `prefix: 'api'` 与带 `/api` 的白名单是 monorepo 约定，勿改。

### 方式 C：服务器部署（GitHub Actions + ghcr，小内存机器专用）

目标机器为 2核/2G 内存（首尔节点）：**镜像全部在 GitHub Actions 上构建，服务器只 pull，绝不在机构建**
（Nuxt 构建峰值 1G+ 内存，在机 build 会 OOM）。

```
开发汇总 master / dev（推送不触发构建）
        │ 合并发布
        ▼
git push release → Actions 构建三镜像推 ghcr.io → 服务器 git pull + bash deploy/update.sh
```

首次部署（服务器上执行）：

1. 加 2G swap（必做，兜底防 OOM）
2. `git clone` 本仓库并进入目录，`cp .env.example .env`
3. 改 `.env`：`JWT_SECRETKEY`、MySQL 密码、`NUXT_PUBLIC_API_BASE=http://<服务器IP>:8888`、`IMAGE_PREFIX`（与 GitHub 仓库名一致）
4. `docker login ghcr.io -u <GitHub用户名>`，密码填 classic PAT（只勾 `read:packages` 权限）——ghcr 包默认私有，拉取需登录；也可在 GitHub 网页把三个包改为 public 免登录
5. `docker compose up -d --no-build`（MySQL 首次启动自动导入 init.sql）

日常更新：`git pull && bash deploy/update.sh`（拉新镜像 → 重建容器 → 清旧镜像）。

注意事项：

- **实测内存（docker stats，空闲态）**：全套 6 容器合计约 **290MB**（mysql 128M / server 100M / client 29M / nginx 15M / admin 16M / redis 4M），2G 内存 + 2G swap 非常充裕；compose 已为每个容器设 `mem_limit` 上限（合计 ~1.75G）兜底防失控
- 镜像体积：admin 105MB / client 250MB / server 1.09GB（未压缩）；ghcr 私有包免费存储仅 500MB，三个镜像压缩后可能逼近上限——**建议在 GitHub 网页把三个包设为 public**（公开包不限量），或后续用 `pnpm deploy` 进一步瘦身 server 镜像
- 工作流只在 **release** 分支触发（master/dev 推送不构建）；发版时：master 合并到 release 并推送 → Actions 构建三镜像推 ghcr → 服务器 `git pull && bash deploy/update.sh`，同时打版本标签、在 PR 说明里写清本版改动
- compose 挂载了仓库内的 `deploy/nginx/blog.conf` 与 `apps/server/db/init.sql`，所以服务器需要保留仓库目录，不能只拷 compose 文件

### 构建与检查

```bash
pnpm build                        # 三个应用全部构建
pnpm typecheck                    # 博客 nuxt typecheck
docker compose down               # 停止全部容器
```

## 默认账号

管理端/博客共用 `sys_user` 用户表。种子账号：**admin / 123456**（bcrypt 实测校验过，见 `apps/server/db/init.sql`）。
博客前台可自行注册（未配置 SMTP 时使用图形验证码；配置 `MAIL_*` 后切换邮箱验证码）。

## 环境变量

见 [.env.example](./.env.example)，要点：

- `JWT_SECRETKEY`：生产必填（后端 joi 强校验，缺失拒绝启动）
- `MAIL_*`：可选；`MAIL_ENABLED=true` 且 host/user/pass 齐全时注册启用邮箱验证码
- `NUXT_PUBLIC_API_BASE`：博客后端入口，默认留空走同源相对路径（nginx 反代 + Nitro 代理）；
  仅无 nginx 反代的特殊部署才需要填绝对地址
- `BLOG_PORT` / `ADMIN_PORT`：两个入口 nginx 的对外端口（默认 8888 / 8081）

## 整合时做过的关键调整

1. **API 前缀统一 `/api`**：后端 `dev.yml`/`prod.yml` 设 `prefix: 'api'`，鉴权白名单同步带 `/api`
   （守卫用 `req.route.path` 匹配，含全局前缀）；管理端 vite 代理改写 `/dev-api` → `/api`；
   博客代码本就按 `/api/...` 调用，无需改动。
2. **博客 `apiBase` 同源化**：上游曾硬编码一台服务器 IP，现默认空串走同源相对路径——浏览器经
   nginx 反代 `/api`、`/profile`，SSR 相对请求由 Nitro 代理路由转发到 `NUXT_API_PROXY_TARGET`
   （docker 默认 `http://server:8080`），换网络/换部署机零配置。
3. **后端配置两份分工**：`dev.example.yml`（入库，compose 本地起步模板）+ `dev.yml`
   （不入库，套用旧项目真实凭据：远程 MySQL/Redis/RustFS/SMTP）；`prod.yml` 存储从 rustfs
   改为 local（docker 全家桶自包含，上传落 `/app/apps/server/upload` 持久卷）。
4. **工程统一**：Node 22.22.2 / pnpm 10.33.0，根级唯一 lockfile；三应用改名 `server`/`admin`/`client`；
   根脚本 `pnpm dev|build|docker:*`；Dockerfile 全部改为 workspace 感知（根目录构建上下文 + `--filter` 安装）。
5. **清理阻塞干净构建的 2025-05 遗留死代码**（仅删本仓库副本，上游原项目未动）：
   `apps/client/composables/request.ts`（引未安装的 element-plus、硬编码失效 IP）、
   `composables/user.ts`（依赖未安装的 pinia）、`api/`、`hooks/useAuthCode.ts`、
   `components/Login/`（无任何引用，现行登录为 `components/Auth/Modal.vue`）、
   `pages/archive/`（调用后端不存在的 `/game/*` 接口且无导航入口）。
   这批文件会让独立安装的 `pnpm build` 直接失败（上游长期未重新干净构建所以未暴露）。

## 已知事项 / 后续计划

- 博客详情页的评论、点赞为占位（后端尚无 comment 表），属上游未实现功能
- 上传默认拒绝 `.svg`/`.html`（防存储型 XSS）、非图片静态文件强制 `attachment` 下载头，均为上游 v1.2.0 安全设计
- 未迁移上游的 VitePress 文档站与 CI 流水线（上游 deploy.yml 的 quality-gate 可作后续参考）
- 生产部署建议：`server` 容器不要对公网暴露端口，仅暴露两个 nginx 入口
