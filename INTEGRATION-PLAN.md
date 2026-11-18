# 整合方案:nest-acticle 单仓三应用(后端 + 管理端 + 博客)

> 版本:v2(2026-11-17 调整)。v1 基于 2026-11-14 的代码快照;上游随后发布了 v1.1.0(注册体系/邮件)、v1.2.0(文件管理、上传与安全加固),本版已按 2026-11-17 快照(nest-admin @ `09e7fa9`,nuxt3-article @ `9a3c635`)更新,变更点见文末「v1 → v2 变更记录」。
>
> 范围(用户已确认):**纯整合 + 全套 docker-compose 部署**;不做评论/点赞新功能、不抽共享包。**原两个项目目录(nest-admin、nuxt3-article)不做任何改动**,所有工作只发生在 `F:\githubPro\nest-acticle`。

## 一、背景

- `nest-admin/server`:NestJS 10 + TypeORM + MySQL + Redis,RuoYi 移植版后端,端口 8080,pnpm。
- `nest-admin/admin-vue3`:Vue3 + Element Plus + Vite 8 管理端,开发端口 8888,pnpm,v1.1.0 起构建要求 Node ≥ 22。
- `nuxt3-article`:Nuxt 4.4 博客(游戏速递),直调同一后端(信封 `{code, msg, data}`,同一用户表、同一文章/专栏模型),pnpm。
- 博客全部接口按 `/api/...` 调用;后端目前全局前缀为空,靠线上反代。整合的核心之一是把前缀收敛到后端本体。

## 二、目标结构

```
F:\githubPro\nest-acticle\
├── package.json            # 根:packageManager pnpm@9.15.9、volta node 22.22.2、workspaces 脚本、concurrently
├── pnpm-workspace.yaml     # packages: [apps/*]
├── pnpm-lock.yaml          # 根级唯一锁文件(替代三个应用各自的 lockfile)
├── .npmrc                  # shamefully-hoist=true、auto-install-peers=true(不开 engine-strict)
├── .nvmrc                  # 22.22.2
├── .gitignore / .dockerignore / .env.example(含 MAIL_*)
├── docker-compose.yml      # mysql、redis、server、web、blog-nginx、admin 六服务
├── README.md               # 架构、快速开始(dev/docker 两条路径)、端口表、已知问题
├── INTEGRATION-PLAN.md     # 本文档
├── scripts\free-port.mjs   # 自 nest-admin 根目录迁来
├── deploy\nginx\blog.conf  # 新写:博客入口 nginx(8888)
└── apps\
    ├── server\       # ← nest-admin\server,改名 "server"
    ├── admin-web\    # ← nest-admin\admin-vue3,改名 "admin-web"
    └── web\          # ← nuxt3-article 全部,改名 "web"
```

## 三、核心决策

### 1. API 前缀统一为 `/api`(v1 决策,继续有效)

1. `apps/server`:`src/config/env/dev.yml`、`prod.yml` → `prefix: 'api'`。
   ⚠️ **已从 @nestjs/core 源码验证的坑**:`req.route.path` 含全局前缀(路由以完整路径直挂 Express,`route-path-factory.js` 拼接 globalPrefix);而 `/login`、`/register`、`/captchaImage` 未加 `@NotRequireAuth`,全靠 yml `perm.router.whitelist` 放行 → **白名单必须同步改**: `/api/login`、`/api/register`、`/api/captchaImage`(+原有的 `/api/logout` 可保留)。静态/文档路径(`/profile/(.*)`、`/swagger-ui(.*)`、`/docs(.*)`、`/openapi.json`)不经过 Nest 路由,保持原样。新增的 `/register/config`、`/register/emailCode` 已有 `@NotRequireAuth`,无需进白名单。
   `/profile/` 静态资源在 `main.ts` 中于 `setGlobalPrefix` **之前**挂载(useStaticAssets),不受前缀影响(已核实)。
2. `apps/admin-web`:`vite.config.ts` 代理 `/dev-api` 的 rewrite 由「剥空前缀」改为 `p.replace(/^\/dev-api/, '/api')`;`.env.development`(`VITE_APP_BASE_API='/dev-api'`,现为已跟踪文件)与业务代码零改动。
3. `apps/web`:代码零改动,但见决策 3(回落地址处理)。

### 2. Node / pnpm 统一(v2 调整:Node 22)

- 上游现状:admin-vue3 官方要求构建 Node ≥ 22(volta 22.22.2、Dockerfile node:22-alpine);web(nuxt)engines 写 `>=20.18.1 <21`;server 仅 volta 18.12 元数据。三个应用各自的 pnpm 钉版不一(9.0.5 / 10.33.0 / 9.12.3)。
- **决策**:根级 Node **22.22.2**(.nvmrc、volta),pnpm **9.15.9**(满足 web engines `pnpm >=9.12.3 <10`)。workspace 下成员包的 volta/packageManager 无效 → 删除各成员的 `packageManager`/`volta` 字段;`apps/web` 的 `engines.node` 改为 `">=20.19.0"`(去掉 `<21` 上限,Nuxt 4 官方支持 Node 22)。所有 Dockerfile 统一 node:22 + corepack pnpm@9.15.9。

### 3. 博客 apiBase 的回落 IP 中和处理(v2 新增)

`nuxt.config.ts` 的 `runtimeConfig.public.apiBase` 上游已改为:
`process.env.NUXT_PUBLIC_API_BASE || process.env.VITE_BASE_API || 'http://旧服务器IP:8888'`
—— 回落值是**硬编码的他人/原线上 IP**。整合副本中改为:
`process.env.NUXT_PUBLIC_API_BASE || ''`(配置归 env,代码不保留地址);
`apps/web/.env`(入库):`NUXT_PUBLIC_API_BASE=http://localhost:8080`(dev 用,后端 CORS 全开);生产用平台环境变量注入。`.env.example` 同步改,`.env.dev`(上游遗留,VITE_* 变量)原样保留不删。

### 4. server 配置策略(v2 调整:joi 校验、mail 段)

- v1.2.0 起 `config/index.ts` 用 **joi 强校验 `jwt.secretkey` 非空,否则拒绝启动**(fail fast,缺 yml 文件也会明确报错;NODE_ENV=test 有独立映射)。
- **dev.yml(入库,可直接跑)**:`prefix: 'api'`;`jwt.secretkey` 给开发默认值(非空);`app.file.location: './upload'`(原 `../upload`,运行 cwd=apps/server);新增 `mail` 段 `enabled: false`(不配 SMTP 时注册走图形验证码,不影响功能);`allowedExts` 留注释示例;MySQL/Redis 指向 127.0.0.1、凭据给与 compose 一致的默认值(环境变量可覆盖,`config/index.ts` 已支持)。
- **prod.yml(入库,脱敏占位)**:prefix/白名单同改;`storageType` 从写死的 `'rustfs'` 改 `'local'` + `location: './upload'`(docker 栈自包含,不依赖外部对象存储);`jwt.secretkey` 留空,由 compose 注入 `JWT_SECRETKEY`(joi 会兜底拦截缺失)。
- 根 `.env.example` 新增 **MAIL_***:`MAIL_ENABLED/MAIL_HOST/MAIL_PORT/MAIL_SECURE/MAIL_USER/MAIL_PASS/MAIL_FROM`(可选;`enabled:true` 且 host/user/pass 齐全时注册切邮箱验证码)。

### 5. Docker 编排(v2 调整:MAIL_* 透传、apiBase 注意事项)

六服务:`mysql:8`、`redis:7`、`server`、`web`、`blog-nginx`(8888:80)、`admin`(8081:80)。
- MySQL 挂 `apps/server/db/init.sql` 自动建库+种子(20 张表,含 v1.2.0 新增的文件管理菜单 202/203);`server` 透传全部 `MAIL_*` 与 `JWT_SECRETKEY`(必填)。
- `web` 服务运行时注入 `NUXT_PUBLIC_API_BASE` → **必须是浏览器与 SSR 容器都能访问的公网地址**(如 `http://SERVER_IP:8888`),**不能用 localhost**(SSR 容器内 localhost 指向自身,接口会打空)。沿用上游绝对地址模式。
- `deploy/nginx/blog.conf`(新写):`/` → web:3000(SSR);`/api/`、`/profile/`、`/uploads/`、`/swagger-ui/`、`/docs`、`/openapi.json` → server:8080(**保留路径**,后端已带 /api 前缀);`client_max_body_size 12m`。
- `admin-web/nginx.conf`:`/api/` 的 `proxy_pass http://server:8080/` 改为 `http://server:8080`(保留路径);`/profile/` 从代理 rustfs 改为代理 server(local 存储)。
- 三个 Dockerfile 全部改为 workspace 感知(先拷根 manifest + 对应应用 manifest → `pnpm install --frozen-lockfile --filter <name>` → 拷源码 → 构建);server 的 `.dockerignore` 上游已自带(dev.yml 不进镜像,prod.yml 保留),根级 .dockerignore 兜底。
- MySQL/Redis 端口绑 `127.0.0.1` 暴露,供本机开发三件套直连复用。

## 四、实施步骤

1. **骨架**:git init + 根文件(package.json、pnpm-workspace.yaml、.npmrc、.nvmrc、.gitignore、.dockerignore、.env.example)。
2. **迁移**(robocopy,排除 `node_modules`、`dist`、`.output`、`.nuxt`、`logs`、`ormlogs.log`、`server/.env`、`upload` 内容、各 `pnpm-lock.yaml`):server、admin-vue3→admin-web、nuxt3-article→web。**不迁移**:nest-admin 的 `docs/`(VitePress)、`bin/`、`.github/`、`.workflow/`。改名:`nest-v10`→`server`、`ruoyi`→`admin-web`、`nuxt-app`→`web`。
   微调:两处 `dev:clean` 的 `../scripts/free-port.mjs` → `../../scripts/free-port.mjs`;删除 admin-web `prepare` 脚本(上游 `cd .. && husky` 在 workspace 下路径必错,虽有 `|| true` 兜底但无意义);删除成员 `packageManager`/`volta`;web engines 放宽(决策 2)。
3. **server 配置**:按决策 1/4 写 dev.yml、改 prod.yml(上游模板已是 yml 键齐全的版本,直接改键值)。
4. **前端接线**:vite rewrite → `/api`(决策 1.2);nuxt apiBase 中和 + `.env`(决策 3)。
5. **Docker**:按决策 5 写 Dockerfile×3、blog.conf、改 admin nginx.conf、docker-compose.yml、根 .dockerignore。
6. **README + 初始提交**:架构图、快速开始、端口表(dev: 8080/8888/3000;docker: 博客 8888、管理端 8081)、默认账号(admin,init.sql 种子)、已知问题、后续事项。

## 五、验证(两条路径各跑一遍冒烟)

**本机路径**:本机 MySQL 导入 `apps/server/db/init.sql`、Redis 起好 → `pnpm install`(生成根锁文件)→ `pnpm dev` →
① 管理端 :8888 admin 登录成功(**直接验证前缀+白名单改动**);② 博客 :3000 首页 SSR 拉到文章列表;③ 博客注册/登录(未配 SMTP 时走图形验证码;`GET /api/register/config` 应返回 `emailRegisterEnabled:false`);④ 博客编辑器发文 → 管理端审核发布 → 博客可见;⑤ 管理端文件管理页(新功能)列表正常、上传 `.svg` 被拒(上游 v1.2.0 预期行为);⑥ 上传的图片可正常显示(`/profile/` 通路)。
**Docker 路径**:`docker compose up -d --build` → 对 8888/8081 重复 ①②③⑤⑥ → `docker compose down`。
另:`pnpm -r build` 三应用构建通过;`pnpm --filter web typecheck` 通过。

## 六、范围外(README 中列为后续事项)

评论/点赞模块、packages/shared 共享包、docs 文档站与 CI 迁移(上游已加 quality-gate,可作将来参考)、管理端登录的 RSA 加密(jsencrypt 已被上游移除,无需处理)。

## 七、v1 → v2 变更记录(依据上游 v1.1.0 / v1.2.0)

| # | 上游变动 | 对方案的影响 |
|---|---|---|
| 1 | **`module/main` 已删除**,9 个认证路由并入 `system/auth/auth.controller.ts`,新增 `GET /register/config`、`POST /register/emailCode` | 模块清单更新;新接口带 `@NotRequireAuth`,白名单无需扩充 |
| 2 | **joi 强校验 `jwt.secretkey` 非空**(全环境,缺失拒启);缺 yml 明确报错;NODE_ENV=test 映射修复 | dev.yml 必须带非空 secretkey;prod 由 `JWT_SECRETKEY` 注入(v1 只说"给默认值",v2 明确为硬性要求) |
| 3 | **注册体系**:SMTP 已配置→邮箱验证码必填;未配置→图形验证码(功能不缺) | dev.yml 加 `mail` 段;根 .env.example / compose 加 MAIL_*;验证步骤加注册冒烟 |
| 4 | **上传加固**:扩展名白名单(`app.file.allowedExts` 可覆盖,默认拒 svg/html)、Multer 10MB 限制、非位图静态文件强制 `Content-Disposition: attachment` | dev/prod.yml 预留 allowedExts;验证步骤加 svg 拒收;无结构影响 |
| 5 | **文件管理功能**(server 路由挂在既有 upload 模块 + 管理端新页 `views/post/file`,init.sql 加 2 行菜单) | 迁移即自带;验证步骤补一条;无新表 |
| 6 | **密码哈希泄漏已在服务端收口**(profile/findOne/allocatedList/unallocatedList/getInfo 响应层剥离) | 从「已知问题」中移除 |
| 7 | **admin-vue3 升级**:Vite 8(rolldown,`codeSplitting.groups`)、eslint 10、vueuse 15、**Node ≥ 22**、`.env.development` 转为已跟踪文件 | Node 统一决策改为 22.22.2;vite rewrite 改动点仍在(行号略移) |
| 8 | **nuxt apiBase 回落值硬编码为 `http://旧服务器IP:8888`**(新提交 9a3c635) | 新增决策 3:副本中中和回落值,配置归 env |
| 9 | 上游各自 Dockerfile 的 pnpm 钉版分裂(9.0.5 / 10.33.0)、server pnpm-lock 转为入库 | Dockerfile 全部重写为 workspace 感知 + 统一 pnpm 9.15.9;成员 lockfile 一律不迁 |
| 10 | CI(deploy.yml quality-gate)、bin/dev.sh、docs/ 均有更新 | 仍不迁移;README 注明可参考 |

## 八、v2.1 实施修订(2026-11-17 凌晨实施时确定)

1. **pnpm 统一为 10.33.0**(非 v2 计划的 9.15.9):本机已装 10.33.0,且与上游 admin Dockerfile 钉版一致。构建脚本白名单落在 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies`;`apps/web` 的 engines 放宽为 `node >=20.19.0`(去掉 pnpm 上限)。根 packageManager 同步钉 10.33.0。
2. **删除阻塞干净构建的 web 遗留死代码**(上游 2025-05 旧版残留,详见 README 整合调整第 5 条):`composables/request.ts`、`composables/user.ts`、`api/`、`hooks/useAuthCode.ts`、`components/Login/`、`pages/archive/`——独立安装下 `pnpm build` 必失败(本地此前靠 shamefully-hoist 意外解析了 element-plus 才侥幸通过)。
3. **init.sql 兼容 MySQL 8 修复**:187 处 `sysdate ()` → `sysdate()`(函数名与括号间空格在 MySQL 8 会报 ERROR 1630,导致 docker-entrypoint 种子导入中断、mysql 容器永远不 healthy)。
4. **种子密码实测确认:`admin / 123456`**(bcrypt compare 验证;README 已按此写)。
5. **实施期端口说明**:实施时本机 8080/8888 被上游项目自身进程占用,故本地 dev 冒烟改用 18080(server)/18888(admin vite)/3000(web),docker 冒烟用 8889——**均为测试临时端口,仓库默认值不变(dev 8080/8888/3000;docker 8888/8081)**。
6. **冒烟结论(全过)**:docker 路径——admin 登录(验证前缀+白名单)、register/config、captchaImage、guest 列表、发文→首页 SSR→详情 SSR→sitemap、svg 拒收、png 上传 + `/profile` 通路、管理端 :8081 静态;本地 dev 路径——server dev(dev.yml+joi+DB)、nuxt dev SSR、vite 代理 rewrite(借旧进程回显重写路径实证)。`NUXT_PUBLIC_API_BASE` 需为浏览器与 SSR 都可达的地址(局域网 IP/域名),SSR 数据通路已实证。

## 九、v2.2 实施记录(2026-11-18 第二轮:精简 + 推送 + 资源审计)

1. **配置切换**:dev.yml 套用旧项目真实凭据(远程 MySQL/Redis/RustFS/SMTP,邮箱注册已启用)并移出 git 跟踪;曾因拆分提交误将真实 dev.yml 入史,已用 filter-branch 重写本地历史清除(未推送前发现,远端无痕);入库模板 dev.example.yml 同步更新为集成版。
2. **目录改名**:`apps/admin-web → apps/admin`、`apps/web → apps/client`(git mv 保历史),包名/脚本/compose/Dockerfile/workflow/README 全同步;后续修复了两处改名遗漏(Dockerfile COPY 目标路径、blog.conf 上游名 web→client)。
3. **功能裁剪**:移除 admin 端注册模块(5 文件 + 路由/白名单/API);移除部门(dept)与岗位(post 岗位)模块——server 删 2 模块 + user/role/auth 手术 + init.sql 删 4 表/菜单 103/104/按钮/授权(5241→4504 行),admin 删页面 + 用户/角色/个人中心/在线用户的部门岗位 UI;数据权限机制整体下线;真实库(4 用户/3 角色)实测登录、用户列表、角色接口、getInfo 全正常。
4. **推送**:远端 `github.com/CrazyStudent13/nest-acticle`;分支模型 master(汇总)/dev(开发)/release(发布,未推送);CI(workflow docker.yml)已改为仅 release + 手动触发。推送前全量凭据/IP 扫描通过。
5. **资源审计(千问方案 + 实测)**:方向靠谱(Actions 构建、服务器只拉镜像、MySQL 关 performance-schema、镜像瘦身);修正 CI 触发分支;compose 补每容器 mem_limit(合计 ~1.75G);**实测空闲全栈内存 ~290MB**(mysql 128M/server 100M/client 29M/admin 16M/nginx 15M/redis 4M),2核/2G+2G swap 充裕;镜像 admin 105M/client 250M/server 1.09G(未压缩),ghcr 私有 500MB 配额偏紧→建议包设 public;server 镜像 590MB node_modules 中混有 dev 依赖(typescript/faker 等,--prod 过滤不彻底),可后续用 `pnpm deploy` 瘦身(不影响内存,仅影响镜像体积/拉取时间)。

## 十、v2.3 实施记录(2026-11-19:packages/shared 契约包,阶段一)

第六节遗留的「packages/shared 共享包」正式落地第一阶段(UI 聚合不可行——admin 绑 Element Plus、client 是 Nuxt、Vue 版本分叉,契约层先行,服务简版论坛方向:评论/点赞模块落地时前后端从第一天共享契约)。

1. **新建 `packages/shared`(包名 `@nest-acticle/shared`)**:响应信封 `ApiResponse`/`PageResult`/`PageQuery`/`PagingParams`;状态枚举 `PublishStatusEnum`/`AuditStatusEnum`/`ArticleSourceEnum`/`SortRuleEnum`(普通 TS string enum,兼容 server `@IsEnum`/`@ApiProperty`);业务码常量(200/401/403/404/500/601);权限字面量 `ALL_PERMISSION`(`*:*:*`)/`SUPER_ADMIN_ROLE`(`admin`);`DICT_TYPE` 字典类型字符串;`Article`/`ArticleUserInfo`/`ArticleQueryParams`/`ArticleAuditParams`/`Subject` 线格式类型。tsup 双格式(ESM+CJS)+dts,**零运行时依赖**(server 生产镜像只需 dist);字段全部可选以兼容表单模型,状态字段用 string 承载(枚举仅作取值常量,与 server DTO 的 string 类型声明一致);每个文件头部标注契约来源(server 实体/DTO 路径),server 改字段必须同步。
2. **三端接入**:server——article/subject 两个 dto 各自重复声明的枚举改为 `import + export`(原 `from './dto/index'` 引用零改动),`result.ts` 的 SUCCESS_CODE 改从 shared 导入(保持导出名);admin——`types/api.d.ts` 改为 `export * from shared` + admin 专属类型(UserAuthInfo 等,既有 `@/types/api` 导入零改动),修正 Article 漂移(删幻影 `articleId`、`userInfo` 改为 `{userId,nickName,avatar}`、状态注释从错误的 2 态换成 4 态枚举事实),`*:*:*`/`admin` 字面量 4 处(utils/permission.ts、useAuth.ts、hasPermi/hasRole 指令)收敛为 shared 常量;client——信封(api.ts ApiEnvelope)、分页(useArticleFeed)、Article/Subject 手抄类型(首页/文章详情/专栏列表/专栏详情/创作者中心文章页与专栏页/ArticleRow/ColumnRow/ColumnEditModal/ColumnCard/ArticleCard/用户空间页)全部收敛到 shared,防御性联合类型清理(`articleNum`→`articleCount`、`read`/`readNum` 二选一、`name`/`content` 死分支删除),顺带删除死码 `utils/jsencrypt.ts`(内嵌 RSA 私钥、零引用、缺依赖且阻塞 typecheck)。
3. **基础设施适配**:pnpm-workspace.yaml 加 `packages/*`;三个 Dockerfile 补 `COPY packages/shared/package.json`(frozen-lockfile 解析新 importer 必需)+源码拷贝,构建统一改为仓库根 `pnpm -r build`(pnpm 递归脚本天然拓扑序,shared 先建);server 生产镜像补 `COPY --from=builder packages/shared/{package.json,dist}`(node_modules 符号链接指向 packages/shared);CI `docker.yml` paths 过滤器加 `packages/**`;根 `pnpm dev` 前置 shared 构建 + concurrently 增加 shared 的 `tsup --watch`。
4. **顺带修复 v2.2 改名遗漏**:admin/client Dockerfile 残留的 `WORKDIR /app/apps/admin-web`、`/app/apps/web` 错误路径(此前靠 pnpm 向上回溯根 package.json 侥幸可用),统一改为根目录显式构建。
5. **Nuxt 类型注意点**:useFetch 泛型喂完整信封类型(必需的 code/msg)会触发 Nuxt `PickFrom` 重载解析失败,useFetch 调用点保留历史上可行的"部分信封"形状(`{ data?: { list?: T[]; total?: number } }`)仅收紧条目类型;client 对 shared 目前全部为 `import type`(编译期擦除,零运行时代码进 bundle),故 nuxt.config 暂无需 transpile/inline 配置,client 引入运行时常量时再评估。
6. **验证**:`pnpm build` 四端全绿;`pnpm --filter client typecheck` 零错误;server dist 运行时 require shared 链路实证(枚举取值正确);docker compose build 三镜像通过。
