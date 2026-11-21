# nest-acticle 代码结构与质量审查报告

> 日期：2026-11-20（当晚复审更新，见第八节）· 分支：`dev` · 审查基线 `dc0c6bf`，现 HEAD `0a5fadf`（DeepSeek 新增 13 个提交）· 未推送
> 范围：apps/server（NestJS）/ apps/admin（Vue3）/ apps/client（Nuxt4）/ packages/shared、utils、eslint-config / 工程化配置
> 方式：全量结构扫描（文件规模、重复模式量化、依赖与配置核对）+ 关键结论逐条源码实锤。文中标 ✅ 的均已到源码验证。

---

## TL;DR

整体骨架健康（详见第七节），但存在 **5 个已实锤的确定性 bug**（BUG-3 已由 743629b 修复，余约 1 天可修完）和四类结构性债务：Server 的 `@Global()` 模块边界失效 + 双协议错误处理 + 21 处手写分页；Client 的 editor/new.vue 上帝组件 + 5 处复制的登录守卫；Admin 的文章编辑双轨 + 权限串大小写不一致；工程化完全没有质量门禁（CI 只构建镜像）。

**建议**：举报/关注模块动工之前，先做第一、二节（bug 修复 + Server 公共查询层 + 拆 @Global），避免新模块复制现有坏模式。**当晚复审后 BUG-6 升级为最高优先级**：member 角色已获发文权限（e1f1a9c），叠加 DTO 未收敛可写字段，注册用户可绕审核直接发布（详见 BUG-6）。

---

## 一、确定性 Bug（已逐条源码实锤，建议立即修）

### BUG-1 ✅ 审核人硬编码为超管
`apps/server/src/module/post/article/article.controller.ts:109-111`
`const auditUserId = 1;`（带 TODO）。任何人执行审核，`audit_user_id` 都记为 1，审计数据失真。应从当前登录用户（UserTool / req.user）取。

### BUG-2 ✅ 分片合并上传两处失效
`apps/server/src/module/upload/upload.service.ts`
- `:251` `this.uploadLargeFileCos(targetFile, key)` 未 `await`，DB 记录（:254）与响应先于上传完成返回，失败会成为 unhandledRejection；
- `:477` 状态回写条件字段拼错：`filName` 应为 `fileName`，update 永远匹配不到记录；
- onProgress 回调是普通函数，`this` 不指向 service。
- 净效果：COS 大文件上传成功后 status 永不更新，`getChunkUploadResult`（:442-456）永远显示"上传中"。

### BUG-3 ✅ 评论管理列表 replyNickName 恒为 null —— **已修复（743629b）**
`apps/server/src/module/post/comment/comment.service.ts`
原问题：`findAdminList` 只 leftJoin article 和 user 没join replyUser，映射读 `row.reply_user_nick_name` → 恒 null。DeepSeek 已补 join 并把 raw 键对齐为 `replyUser_nick_name`（含注释说明别名大小写约定），guest/admin 两套约定现在一致了。

### BUG-4 ✅ Admin 权限串大小写不一致，非超管按钮被隐藏
- 前端：`apps/admin/src/router/index.ts:69`、`apps/admin/src/views/post/article/index.vue:83,86,129,130` 用 `post:Article:*`（大写 A）；
- 后端种子：`apps/server/db/init.sql:2212/2238/2264` 全小写 `post:article:*`；后端 `@RequirePermission('post:article:audit')` 也是小写；
- `hasPermi`（`src/directive/permission/hasPermi.ts:32-35`）大小写敏感 → 被授权的非超管角色的"新增/修改"按钮会被指令 removeChild，目前全靠超管旁路掩盖。
- 修法：统一小写；顺手把权限串收口为 shared 常量表，杜绝手写。

### BUG-5 ✅ Admin 编辑器插图 Base64 内嵌正文
`apps/admin/src/components/MdEditor/index.vue:96-108`
`handleUploadImg` 把图片 `readAsDataURL` 后直接塞进 markdown 正文，不走上传接口。content 字段会膨胀（Base64 比原图大 33%），且与全站上传体系（useRequest / ImageUploadCover）脱节。应改为调用上传端点回填 URL。

### BUG-6 ✅ 创建文章 DTO 可伪造计数与状态（mass assignment）—— **当晚升级为最高优先级**
`apps/server/src/module/post/article/dto/index.ts:51-74` + `article.service.ts:45-50`
`CreatePostArticleDto`（update 继承之）暴露 `likeNum/readNum/commentNum/publishStatus/auditStatus/publishTime` 且仅 `@IsNumber/@IsEnum`；`create()` 直接 `...createDto` 落库，仅覆盖 userId/subjectId，**publishStatus/auditStatus 完全由客户端指定**。

**严重度升级的原因（与 e1f1a9c 联动）**：member 角色现已获 `post:article:add/edit/remove`（init.sql 菜单 2001/2002/2003），可利用面从管理员扩大到**全体注册用户**。攻击链：注册用户 `POST /api/post/article` 请求体带 `publishStatus: '2'` → 文章直接以"已发布"落库；前台 guest 列表（article.service.ts:212/:294）只过滤 `publishStatus = PUBLISHED`、**不过滤 auditStatus** → **完全绕过审核流程**。此外 likeNum/readNum/commentNum 计数可被请求体直接改写。

**修法**（保留"前台发文免审"现状流程的前提下）：
1. `create()` 服务端强制初始状态：`auditStatus: '0'`、`publishStatus: '2'` 写死（前台发文免审的话）或 `'0'` 草稿（走 submit-audit 流程），不从 DTO 取；
2. `likeNum/readNum/commentNum/publishTime` 从可写 DTO 移除（计数由 like/comment 事务内维护）；
3. update 同理收敛。

### 其他顺手修的小雷（半天内）
- `apps/server/src/module/system/user/user.decorator.ts:18-21`：`UserTool.injectCreate` 在 `data.createBy` 存在时 `return;`（返回 undefined），user.controller.ts:100 会把 undefined 传给 `userService.create()`，目前靠 ValidationPipe whitelist 才没炸。改为 `return data`。
- `apps/server/src/module/system/user/user.service.ts:382-389`：filter 两个分支都 `return true`（恒真），应改 forEach；TODO 已自知。
- `apps/server/src/module/upload/upload.service.ts:88-89`：fileSize 先 `toFixed(2)`（变字符串）再与 maxSize 比较，10.004MB 会被舍入放行。
- `apps/server/src/module/post/like/like.service.ts:120`：任何非 `'ascending'` 值都当 DESC。

---

## 二、Server（NestJS）结构性问题

### P0-1 `@Global()` 泛滥，模块边界全面失效
`app.module.ts`、`system.module.ts:14`、`user.module.ts:14`、`auth.module.ts:14`、`upload.module.ts:8`、`article.module.ts:12` 全标 `@Global()`（且配 exports，完全冗余）。任何 service 无需 import 模块即可注入任何依赖，已出现网状耦合：
- `article.service.ts:19-20` 直接注入 UserEntity repo；
- `user.controller.ts:25-26` 同时注入 AuthService + UploadService。

**举报/关注模块动工前必须先拆**，否则新模块照坏榜样写只会更乱。改法：各业务模块显式 imports/exports；跨模块只 import 模块不 import 实体 repo。

### P0-2 双协议错误处理并存（65 处 vs 9 处）
- `ResultData.fail(...)` 65 处：HTTP 200 + body.code；
- `throw new BadRequestException` 9 处：真实 4xx/5xx。

同一个 service 内都分裂（user.service.ts:50 throw vs :315/:439/:684/:688 fail；article.service 全用 fail）。前端被迫同时处理两套信封；`all-exceptions-filter.ts:36-40` 与 `common/utils/result.ts:31-33` 语义不一致。
**改法**：新增 `BusinessException(code, msg)`，service 一律 throw，由 AllExceptionsFilter 统一出信封；`500/403/429/*:*:*` 收口为 shared 常量。

### P1-1 重复模式量化（该抽公共查询层）
| 模式 | 出现次数 | 代表位置 |
|---|---|---|
| `pageSize * (pageNum - 1)` 手写分页 | **21 处** | user/article/subject/notice/dict/role/config/loginlog/operlog/job-log/comment/like… |
| LIKE 模糊拼接 | 17 处 | 同上 |
| `delFlag = '0'` 条件 | 56 处 | 全库 |
| 密码剥离 `map(({ password: _p, ...u }) => u)` | 4 处 | user.service.ts:113/487/523、user.controller.ts:37 |
| 归属校验 `isAdmin = user.roles?.includes('admin')` | 4 处 | article.service.ts:358/405/467/500 |

现成的 `Paginate` 工具（common/utils/index.ts）只有 online.service.ts 在用。
**改法**：`paginate(qb, {pageNum,pageSize})` + `applyLike(qb, [...])` + `attachUserInfo(list)`（IN 批查）+ `assertOwnership(user, entity)`。

### P1-2 N+1 查询
- `article.service.ts:112、:254`：列表逐行 findOne user，且 findAll/findGuestAll 两套 where 构造 + N+1 段整段复制两遍（:60-104 vs :193-246）；
- `subject.service.ts:65-73`：串行 for 循环 count；`:150-155` Promise.all 逐条 count。
应为一次 leftJoin 或 `IN` 批查。

### P1-3 Service 层过大 / 职责混杂
- **user.service.ts（696 行）**混 5 种职责：用户 CRUD、角色绑定（:535-573）、profile/avatar/pwd（:580-694）、Redis 会话踢人 kickUserSessions（:296-305）、缓存清理（:223-226）。其中 `updateUserAvatar`（:620-674）单字段更新却起 queryRunner 显式事务，还有未使用变量（:644、:662-665）与 console.error 带 emoji 日志（:648/667/671）。
- **upload.service.ts（521 行）**混 4 件事：分片文件系统管理（:163-326）、COS SDK 直连（:422-520）、DB 记录、授权签名。file-storage 工厂抽象已存在（:101 用了）但 COS 路径绕开它；`saveFileCos`（:401-414）、`uploadCos`（:422-435）、`getAuthorization`（:509-520）疑似无人调用的双轨遗留。
- **article.service.ts（516 行）**：见 N+1 一节，另需抽归属校验。
- **auth.service.ts（421 行）**：登录、注册、邮箱验证码、4 层限流（:316-354）、登录日志、token 管理全在一个类；发码限流三段 incr/ttl 逻辑高度同构。

**拆法**：user → 用户 CRUD / 角色绑定 / profile / SessionService（与 monitor/online 共用会话逻辑）；upload → ChunkStorageService（纯 fs）+ UploadRecordService（DB），COS 并入 file-storage 工厂或删死代码。

### P1-4 风格不统一 / 机制脆弱
- **事务三种并存**：`dataSource.transaction`（user/role.service）、`repo.manager.transaction`（auth/like/comment.service）、queryRunner 显式（user.service:623-652）。多表写基本都包了事务（好），风格应统一；like 与 comment 的"删除级联回减计数"逻辑是复制品（like.service.ts:204-216 vs comment.service.ts:253-261/276-284），应抽公共。
- **Raw SQL 残留**：role.service.ts:160 裸 SQL 查 `sys_user_with_role`（有实体 repo）；dict.service.ts:154-166 裸 SQL UNION。计数回减用字符串插值 SQL：like.service.ts:213、comment.service.ts:258/281 的 `` GREATEST(like_num - ${count}, 0) ``——count 目前是内部数字，但该模式易被复制出注入，应参数化。
- **缓存机制**：`common/utils/decorator.ts:3-6` 用 `func.toString()` 正则解析参数名生成缓存 key（压缩/改名即静默失效）；`redis.decorator.ts:52` Cacheable 无 TTL 时永不过期、`:49` 把空串当 miss；user.service.ts:298、online.service.ts:12 用 Redis `KEYS` 全库扫描做会话遍历（大库阻塞）。
- **Excel 导出**：10 处 service 方法签名带 `res: Response`（role/dict/config/loginlog/operlog/job/job-log/user-excel），"删分页参数 → findAll → ExportTable"样板重复粘贴。导出应上提 controller + 抽 `exportQuery(serviceFn, columns)`。
- **魔法值散落**：权限串 20+ 处字面量（PERM_PROFILE_* 已收口，其余没跟进）；超管 `userId === 1` 硬编码 4 处（user.service.ts:173/177/314、article.controller.ts:110）；article.service.ts:476 `auditStatus: '1'`、:509 `publishStatus: '2'` 字符串魔法值（枚举已 import 却不用）；`ResultData.fail(500/403/400/429)` 状态码 65 处字面量。
- **console.\* 36 处 / 17 文件**：Logger 已可用（auth.service.ts:42），未推广。
- **会话刷新职责漂移**：同一件事在 controller（user.controller.ts:163-171）和 service（user.service.ts:604-609）各做一处。

### P1-5 鉴权与类型
- 白名单与 `app.prefix` 双源（dev.example.yml:6-7/:117-129 与 :13），改前缀必炸（已知坑，可改为代码里统一拼前缀）；
- `auth.guard.ts:39` 缺 token 抛 ForbiddenException（应 401）；`:54-62` catch 吞异常；
- tsconfig：`strictNullChecks: false`、`noImplicitAny: false`、`strictBindCallApply: false` 主动关严；配合未类型化参数：user.controller.ts:139 `@Query() query`（service 里 `query.roleIds.split(',')`）、upload.controller.ts:18 `query: any` 等。

### P2 清单
- BaseEntity 被绕过：article.entity.ts:19-40 手工重抄 BaseEntity 5 个字段而非继承（entity 与 init.sql 漂移的现实入口）；`@Entity()` 挂在 abstract 类上（base.ts）注册无用元数据。
- 命名：`thunk`→chunk（upload.service.ts:40/266/291）、`user-width-role.entity.ts`（width→with）、`require-premission.decorator.ts`（permission）、user.service.ts:565 `sysDeptEntityEntity`。
- `@NotRequireAuth` 定义错位在 user.decorator.ts:11，其他鉴权装饰器都在 common/decorators/。
- DTO：@IsEmail/@IsPhoneNumber 被注释掉（user/dto/index.ts:14/36）；article title varchar(64) 但 DTO 无 @MaxLength。
- CacheEnum 死键：GZ_TYPE、MA_CODE（common/enum/index.ts:69-73）无使用，GZ_TYPE 注释是复制来的。
- backup.service.ts 全文 14 行占位 stub，模块名与能力不符。

---

## 三、Client（Nuxt4）结构性问题

composables 层（api.ts / useComment / useLike / useUser / useUpload / useImageCrop / useAuthModal）质量很高，token 与类型都走统一来源——问题集中在页面层没跟上范式。

### P0-1 editor/new.vue 上帝组件（1282 行）
全项目唯一真正阻碍维护的文件。单文件混 10 种职责：
- 登录守卫（:241-255）、登录后自动初始化 watch（:258-262）
- Markdown 工具栏 10+ 操作函数（:303-446，纯 textarea 选区操作）
- 图片插入+裁剪+粘贴上传（:448-509）
- 草稿箱 localStorage 读写/防抖/删除/点击外关闭（:511-608）
- 发布弹窗+专栏拉取+封面裁剪上传+提交（:610-742）
- `:267` 一处 `$fetch<any>` 直连 URL 绕过 apiFetch

**拆法**：`useMarkdownEditor()` / `useDraftBox()` / `usePublish()` 三个 composable + `DraftPanel.vue`、`PublishModal.vue` 两个子组件，可降到 ~400 行。

### P0-2 登录守卫抄了 5 处 + 恢复逻辑抄 2 处
- `if (!getToken()) { openLogin(); navigateTo('/') }`：editor/new.vue:241-245、user/space.vue:174-176、user/settings.vue:182-184、notification/index.vue:331-333、layouts/creator.vue:84-87；
- "有 token 无用户则静默 fetchUserInfo"：AppHeader.vue:235-239、article/detail.vue:213-215。

**改法**：一条 `defineNuxtRouteMiddleware('auth')` 替换 5 处守卫；恢复逻辑进 plugin；apiFetch（composables/api.ts:17-24）加 401 → 清态+弹登录的统一出口（目前 401 只抛错，各页 catch 行为不一）。

### P1-1 API 调用未按域收敛
- `/api/post/article/list` 在 pages/creator/article.vue:93/140/143/153 出现 4 次；`/api/post/subject/list` 两处各写一遍；
- space.vue:249/309、editor/new.vue:637/725、notification/index.vue:191/221、ColumnEditModal.vue:159/165 全是页内裸调；
- 缺 `useSubject` / `useArticleManage` / `useNotice` 三个同构模块（对齐 useComment/useLike 范式）。

### P1-2 AppHeader（722 行）内部自我复制
- 创作者面板 250ms 延迟关闭计时器（:171-189）与通知面板（:210-228）逐行同构，只差变量名 → `useHoverPanel(delay)` 一行消掉；
- 通知分类清单 `noticeCats`（:192-197）与 pages/notification/index.vue:128-149 重复定义，改一处必忘另一处 → 收口到 shared 常量或 useNotice。

### P1-3 Auth/Modal.vue（893 行）
登录验证码状态机（:320-347）与注册验证码（:353-372）是两份几乎相同的 reactive + refresh 逻辑，resetForm 各清一遍（:426-443）。同文件还混表单校验 computed、输入实时过滤、密码强度 UI、60s 冷却（:384-424）、模式切换/ESC/滚动锁。
**拆法**：`useCaptcha(scene)` 合并两份、`useCooldown` 独立、`useAuthForm()` 收校验+过滤，弹窗回归纯视图。

### P1-4 分页/列表逻辑 4 套并存（当晚复审后恶化：通知中心单文件已有 3 套）
- notification/index.vue 同文件手写**三份**分页块（通知、我的评论、当晚新增的"收到的赞"第三套 page/total/loading/error + 3 个 watch）；
- CommentSection.vue:201-232 又一套追加式分页（当晚加了按 id 去重，逻辑正确）；
- user/space.vue 三个 tab 各一套 `pageSize: 50` 一次性拉取（:242-278/:302-319/:325-344）；
- 全项目只有 creator/article.vue:41 用了 Common/Pagination.vue。
→ 缺一个 `usePagedList()` / `useInfiniteList()` composable。每新增一个 tab 就复制一套，正是这条债的活样本。

### P1-5 死代码
- **`components/Game/ListCard.vue`**：用 el-card/el-image（Element Plus），client 未装该依赖，全仓无引用——从 admin 抄来忘删；文件内还有 `阅读量：{{ props.cardInfo.read || '暂无作者' }}` 回退文案错误、`dayjs(...).format(...) || '-'` 永不触发的坏代码。连同孤儿目录 Game/ 一起删。
- `assets/style/login.less` 无引用（nuxt.config.ts:26 只注册 tokens/base）。
- user/settings.vue:323-332 `registerTime` computed 写完即 `void registerTime`——删，git 能找回。

### P1-6 小重复（一次清理包）
- 日期格式化：packages/utils 的 formatRelativeTime 已接入 CommentSection 与 notification 评论栏（当晚批次），但 notification 系统通知栏 formatTime（dayjs）、user/space.vue:214-221、user/settings.vue:324-332 仍手写 dayjs + Invalid Date 判断；
- 邮箱正则两份：Auth/Modal.vue:216 与 user/settings.vue:159（一模一样）；
- "图片类型+5MB 校验"四份：editor/new.vue:459-465/675-680、user/settings.vue:254-258、ColumnEditModal.vue:116-121 → useUpload 加 `validateImage()`；
- 头像地址补全+首字回退三份：AppHeader.vue:231-232、settings.vue:196-197、space.vue:200-204；
- `toCoverUrl + useRuntimeConfig` 样板约 10 个组件重复 → 包成 `useFileUrl()`。

### P2
- 类型：shared 用得不错（24 处 import），但仍有 6 个手写重复 interface（useUser.ts:2-30 的 AuthUser/CaptchaInfo/RegisterConfig、notification 的 NoticeItem、AuthorCard 的 AuthorInfo、RelatedCard 的 RelatedItem），数据引用处 any[]：editor/new.vue:614/267、space.vue:234；useUser.ts:71 `const raw: any`。openapi.d.ts 已有对应 schema 可对接。
- MdViewer 与 admin 是两套实现（见第四节 P2-5）。
- app.vue 弹窗挂载不一致：AuthModal/ConfirmModal/Toast 包 ClientOnly，ImageCropModal 裸挂。
- user/space.vue（647 行）资料卡+三 tab+三套 loader，可拆三个 tab 子组件；settings.vue 三面板同理，优先级低于 editor/new.vue。

---

## 四、Admin（Vue3）结构性问题

整体改造质量不错：请求封装统一（useRequest.ts 一个 axios 单例，token/防重提/信封错误/blob 解包全有）、80/81 个 vue 全 `<script setup>`、useCrud 抽象 14 个页面在用。主要问题是"三套并行抽象"与死资产。

### P1-1 文章编辑双轨
- 抽屉表单 `views/post/article/components/ArticleForm.vue:87` 直接 import addArticle/updateArticle（:226/:233），自维护手写 formData（:116-133）；
- 全页编辑器 `views/post/article/editor.vue:90` 走 useArticleEditor → useArticle.saveArticle，又手写字段几乎相同的 articleData（composables/post/useArticleEditor.ts:32-49）。

同一实体的表单模型、校验、保存语义重复两份，字段增改必然漂移。**改法**：二选一保留，或抽共享 `useArticleForm`（类型取 shared 的 Article），删掉重复模型与直调 api 分支。

### P1-2 列表页双轨
comment/like/file 三页（views/post/comment/index.vue:63-104、like/index.vue:45-85、file/index.vue:47+）手写 loading/list/selected/total/dateRange/requestSeq/getList/reset/remove 全套，绕开 useCrud；且 comment 与 like 两页近乎逐行复制（只差标签文案）。收编 useCrud 可删约 200 行。另 `useSubject.ts:9` 的 subjectListRef 是无人用的死变量；`useRequest()` 伪 composable（useRequest.ts:268-273）无消费方。

### P1-3 useArticle"示例型"composable
composables/post/useArticle.ts:64-268 全是 try/console.error/throw 薄包装（大量 @example 教学注释），仅 useArticleEditor 一个消费方；文章列表页反而用 useCrud 包原始 api。三层抽象（useCrud/useArticle/裸 api）并存，各自承担"列表页状态机"职责的一部分——收敛为 useCrud 为主。

### P1-4 api 层零类型
src/api 下 21 个文件全 .js 无类型标注；shared 类型全 admin 仅 2 处消费（useArticle.ts:20、useArticleEditor.ts:12）；页面里 `res.data.list` 全裸取。中期应 api 层 TS 化并消费 shared 类型。

### P2 清理清单
- **死组件**：ImageUpload（233 行）/ FileUpload / ImagePreview 在 main.ts:31-33 全局注册但无任何 view 引用；ImageUpload 与实际在用的 ImageUploadCover（808 行）在上传/token/URL 逻辑上重叠；userAvatar.vue:7/51 第三次重写 vue-cropper 裁切逻辑。
- **死页面**：views/monitor/druid（指向 `${VITE_APP_BASE_API}/druid/login.html`，Nest 后端根本没有 druid，进即 404）；views/index.vue:18-19 的"码云/若依"营销外链；views/tool/swagger 做成了 cloudconvert 等外链导航；package.json description/author 仍是"若依管理系统/若依"。
- **MdViewer 两套渲染栈**：admin 用 md-editor-v3 MdPreview（30 行），client 用 markdown-it+highlight.js（235 行，带复制按钮/行号）——同一条内容后台预览与前台呈现效果不同，"预览"失去意义。统一渲染栈（建议 admin 侧复用 client 方案）。
- **孤儿测试**：tests/useValidator.test.ts、test-standalone.html 存在，但 package.json 无 test script、无框架。
- api/post/file.js 命名与 URL 不一致：模块挂 post 下、权限 `post:file:*`，URL 却是 `/common/upload/*`。

---

## 五、工程化 / Monorepo

### P0-1 没有任何质量门禁
- CI（.github/workflows/docker.yml）只在 **release** 分支构建推送镜像；dev/master 推送连 lint/typecheck/test 都不跑；
- root `typecheck` 只 filter client；server/admin 无统一入口；admin 连 lint script 都没有（eslint.config.js 躺着没人调）；client 有 typecheck 无 lint；shared/utils 只有 build/dev。

**改法**：root 加 `lint` / `typecheck` / `test` 聚合 script；CI 加一个 `quality` job（pnpm lint + typecheck + test）挂在 dev/master 的 push 上，release 的镜像构建前先过门禁。

### P0-2 测试覆盖
- server 全仓 13759 行只有 2 个 spec（process-guard、database-health）+ 1 个壳 e2e；
- 最值得补的是**计数事务逻辑**的单测：like/comment 的点赞回减、删除级联聚合回减（是复制品且涉及 GREATEST 边界）、评论 parentId 校验——这些是数据一致性核心；
- admin 孤儿测试目录要么接框架要么删。

### P1 shared 包的 openapi.d.ts 是死资产
`packages/shared/src/generated/openapi.d.ts`（5724 行）未被 index.ts 导出（index 只导 enums/constants/types/*），全仓 grep 无任何 import。实际契约靠手写 types（article.ts:2-4 注释"修改任一侧时必须同步"）维持，无 drift 校验。
**二选一**：① index.ts 导出生成物，api 层 TS 化消费它（client/admin 双端受益）；② 删掉生成物只留手写。当前"生成了但没人用"是最差状态。

### P2 小项
- `apps/client/.env` 被 git 跟踪（内容仅 localhost 默认值，无泄漏；但建议规矩上 .env 一律不入库，生产由部署平台注入的注释已经写对了）；
- .nvmrc（22.22.2）与 volta（22.22.2）一致，engines >=20.19.0 略宽但无害；
- root package.json 无 `lint` script；`typecheck` 建议扩成 `-r` 递归。

---

## 六、实施路线图（结合举报/关注模块）

| 顺序 | 内容 | 预估 | 说明 |
|---|---|---|---|
| 1 | **fix 包**：BUG-6（**最高优先级，审核绕过**）+ BUG-1/2/4/5 + 小雷 4 条（BUG-3 已由 743629b 修复） | ~1 天 | BUG-6 因 e1f1a9c member 发文权限开放升级为权限绕过，建议单独先行 |
| 2 | **Server 公共查询层**：paginate / applyLike / attachUserInfo / assertOwnership | ~2 天 | 替换 21 处分页、17 处 LIKE、article+subject 的 N+1；**举报/关注动工前必做** |
| 3 | **拆 @Global + 统一错误协议**：BusinessException + filter 出信封 | ~2 天 | 新模块从第一行就按显式边界 + 单协议写 |
| 4 | **Client 三件套**：auth middleware（消 5 处守卫）、useSubject/useArticleManage/useNotice、拆 editor/new.vue | ~3 天 | |
| 5 | **Admin 清理**：权限串大小写（可提前并入 fix 包）、合并文章编辑双轨、comment/like 收编 useCrud、删 druid 等死资产 | ~2 天 | |
| 6 | **工程化**：root 聚合 script + CI 质量门禁；like/comment 计数单测；shared openapi.d.ts 接线或删除 | ~1 天 | |

---

## 七、审查过、无需修改的方面（避免重复劳动）

- **token 管理**：client 单一来源 utils/auth.ts（cookie + 内存镜像），无散落 localStorage；
- **client 状态管理**：useState 组合式全局状态（useUser/useAuthModal/useToast/useTheme/useDict/useImageCrop），符合 Nuxt 惯例，无 pinia 也没必要；
- **SSR 安全**：依赖登录的页面 routeRules `ssr:false` + 全局弹窗 ClientOnly + localStorage 全落在客户端路径，无裸奔访问；
- **CommentSection 拆分质量**：commit 019349d 从 detail.vue 拆出后无遗留重复，detail.vue 只持计数与滚动定位，拆得干净；
- **admin 请求封装**：useRequest.ts 单例质量好（防重提、blob 错误解包、双路错误归一）；80/81 个 vue 全 `<script setup>`（唯一例外 ParentView 是 RuoYi 动态路由必需）；
- **DTO 校验**：全局 ValidationPipe + whitelist 统一，controller 手写校验仅 1 处；上传路径/文件名白名单正则（upload/dto/index.ts:6-16）质量高；
- **密码强度**：前后端已贯通（IsPasswordComplexEnough），口径一致；
- **依赖卫生**：admin（echarts/vue-cropper/radash/fuse.js）均有消费方，无闲置依赖；i18n 无残留。

---

## 八、DeepSeek 批次复审（2026-11-20 晚，`dc0c6bf..0a5fadf`，13 提交 / 23 文件 / +441 -118）

针对"前端展示点赞和回复功能细节"批次的全量 diff 审查。**总评：质量良好**，契约同步纪律、并发安全处理、init.sql 单一基准原则都执行到位；未提交报告中的结构性问题没有恶化方向性偏差（分页复制除外）。以下为逐项结论。

### 做得好的（点名表扬）

1. **BUG-3 修复干净**（743629b）：`findAdminList` 补 join replyUser，raw 键对齐 `replyUser_nick_name` 并留注释说明别名大小写约定，guest/admin 两套 key 约定统一。
2. **点赞并发幂等重写正确**（9a2d0e2）：check-then-insert 竞态改为参数化 `INSERT IGNORE` + 唯一索引兜底 + affectedRows 判断 + 回读最新计数，事务包裹完整；取消赞用 `set({ likeNum: () => 'GREATEST(like_num - 1, 0)' })` 的参数化安全写法（并保留防负数下限）。注释还解释了为何不用 orIgnore（TypeORM 0.3 自增 id 回写问题），质量高。
3. **契约同步纪律好**：新端点 `GET /post/like/received/list` 与 `subjectId` 可选化同步进了 openapi.d.ts；`shared/types/like.ts` 新增 `ReceivedLikeItem` 与 service 返回形状逐字段一致；废弃的 `/my/list` 在 controller、openapi、前端三处同步移除。
4. **init.sql 遵循单一基准**：member 角色发文权限（菜单 2001/2002/2003）与通知列表读取（107）直接改 init.sql，未写迁移 SQL；菜单行均存在（:2200/:2226/:2252），与 role 2 的既有授权对齐。
5. **删除评论回抛实际条数**：server 返回 `{ removed: ids.length }`（含未加载级联后代），前端 useComment 返回 `removed`，CommentSection 优先服务端条数、无回抛时回退本地统计——前后端契约成对改动。
6. **X-Real-IP 信任链处理周到**（0ab3fbe）：nginx 所有代理 location 都 `proxy_set_header X-Real-IP $remote_addr`（覆盖客户端伪造值），外层 1Panel 链路用 realip 模块且 `set_real_ip_from` 仅信内网网段；docker-compose 中 server 容器无公网端口映射（仅 nginx 暴露 8888）→ 直连伪造不可行，注册/发码限流按 IP 计数仍然有效。
7. **细节**：评论 content `@Transform` trim 后再校验（纯空白拦截）；注册撞唯一索引返回可读文案 + 前端 `ACCOUNT_EXISTS_HINTS` 登录引导；通知中心首屏加载移到登录守卫后（消除未登录必 401 的请求）；CommentSection 翻页按 id 去重（处理了"本地插头部后翻页 offset 重叠"的真实边界）；Toast z-index 提到 2000 高于登录遮罩并配 Element 实心底配色（深色模式单独覆盖）；他人空间不展示性别。

### 新引入 / 需跟进的问题

| 级别 | 问题 | 位置 |
|---|---|---|
| **P1** | `create()` 回复时新增一次 `findOne(UserEntity)` 查被回复人昵称——单请求一条查询可接受，但与 `parent` 查询可合并为一次 join；更重要的是** BUG-6 与本批次的联动**（见 BUG-6 节，已升级） | comment.service.ts create() |
| P2 | `.andWhere('like.userId <> :userId')` 未显式传参，依赖 where 子句注册的同名参数（TypeORM 参数为 builder 级共享，能跑）；跨子句复用同名参数是脆弱写法，建议换独立参数名（如 `:likerId`）显式传值 | like.service.ts findReceivedList |
| P2 | `INSERT IGNORE` 会吞掉**所有**插入错误（不只重复键，数据截断等也静默）；`inserted: any` 类型缺失。可改 `orIgnore` + 处理 TypeORM 自增问题的方案，或至少 `inserted: { affectedRows?: number }` 类型化 | like.service.ts like() |
| P2 | `ACCOUNT_EXISTS_HINTS` 用**字符串 includes 匹配后端文案**决定是否引导登录——文案一改引导即失效，是双协议错误处理债的又一实证（后端给业务错误码即可根治，见 Server P0-2） | client Auth/Modal.vue |
| P2 | Toast 硬编码 Element 色值两套（浅色/深色），脱离原 `--color-*` token 体系——可接受但属样式债 | client Toast.vue |
| P2 | `console.log('📝 [创建文章]', JSON.stringify(createDto))` 把**文章全文 content 打进生产日志**（article.service.ts:34/48），日志膨胀 + 与 Logger 未统一问题叠加，建议删除或降为 debug 且不含 body | article.service.ts |

### 对主报告的状态影响

- BUG-3 → 已修复；日期收敛残留、通知中心 noticeCats 双定义 → 部分推进（评论栏）/未动（noticeCats 仍两处）；分页复制 → 恶化（+1 套）；其余条目状态不变。
- fix 包建议顺序调整：**BUG-6 单独先行**（权限绕过），其余 bug 合并处理。

---

## 九、实施进度记录（2026-11-21 凌晨，按本报告路线图推进）

本会话做总览调度，实施开新对话并行执行，产出均经逐行 diff 复审 + 构建验证 + 运行时冒烟。**共 11 个提交（f25a37e..773b87d），未 push，待确认后推送备份。**

### 已完成

| 项 | 提交 | 复审结论 |
|---|---|---|
| fix 包·服务端（BUG-6/1/2 + 小雷×4 + 全文日志删除） | 5f7161f..f25a37e 共 6 个 | ✅ BUG-6 实现超预期：DTO 删 6 个可写字段 + create 服务端写死（PUBLISHED/NOT_SUBMITTED/计数 0/publishTime）+ update 解构剥离双层兜底；openapi.d.ts 同步重生成 |
| fix 包·管理端（BUG-4 权限串 + BUG-5 插图上传） | 6a5c7b4、a9d731e | ✅ 全仓清扫无其他大小写漂移；插图走 /common/upload 带类型/大小校验与禁用态 |
| 路线图 2-①：公共查询层工具 | 7e221ac | ✅ `common/query`：paginate（保留缺参不分页语义）/applyLike（参数名按字段派生防覆盖）/attachUserInfo（保真"不带 delFlag 过滤 + 假值跳过 + null 回填"）/assertOwnership（返回布尔，403 文案留调用方） |
| 路线图 2-②：article.service 消重消 N+1 | 56a100c | ✅ buildListQuery 合并两套 where（admin 无默认排序/guest publishTime DESC 的差异保留）；attachUserInfo 批查；4 处归属校验收口（文案原样） |
| 路线图 2-③：subject.service 消 N+1 | 773b87d | ✅ GROUP BY 聚合 + Map 缺键回填 0，与逐条 count 口径逐字段一致；admin 就地覆盖/guest spread 两种形态保留 |

### 验证方式

- `pnpm --filter server build` ✅、`pnpm --filter admin build:prod` ✅
- 运行时冒烟：起 dev server 实测 `GET /post/article/guest/list`（userInfo 正确回填、`author` 为实体真实列非改名）、中文 title LIKE 命中、`GET /post/subject/guest/list`（表本身 0 行，返回 0 正确；聚合口径与 countGuestArticles 逐字段核对一致）

### 遗留提醒

- ~~前端 editor/new.vue 仍发 `publishStatus:'2'`~~ → 已删（2c362f7）
- ~~第 2 步剩余迁移~~ → 已完成（见第十节）；第 3 步拆 @Global + 统一错误协议、第 4 步 editor 拆分、第 6 步工程化未动
- 实施会话会撞权限审批（B/C/D/E/F 均至少一次），无人值守时会暂停等批准

---

## 十、实施进度记录 II（2026-11-21 凌晨第二批）

第二批 10 个提交（7b01c61..2c362f7），至此 dev 共 **21 个提交未 push**。

| 项 | 提交 | 复审结论 |
|---|---|---|
| 第2步收尾：system/monitor/post 三批 service 迁移 paginate/applyLike | 65b7ddd、539eaaa、7b01c61 | ✅ 净删 89 行；语义分歧点正确保守：loginlog 的 else 兜底 skip(0).take(10)、user 的 allocatedList/unallocatedList 与 notice findAll 无条件分页均保持原样仅迁 LIKE；comment/like 的 raw 键映射逐字未动 |
| 第4步前两项：auth route middleware + API 域补齐 | f960891、278b6e2、2c362f7 | ✅ middleware 按 definePageMeta 分档（默认回首页/editor·creator stay 原地弹登录/space guest 旁路保序），ensureUserRestored 抽公共；apiFetch 401 统一出口（login/logout 豁免、isOpen 防重复弹、信封+HTTP 两形态都覆盖）；useSubject/useArticleManage/useNotice 三域收敛，$fetch\<any\> 消除；editor publishStatus 死字段删除 |
| 第5步保守清理：ArticleForm 失效字段 + 三页收编 useCrud + 死资产 + 营销外链 | 6f8a41a、b2f7f0e、5a9860b、e17faf3 | ✅ READONLY_FIELDS 统一剔除保编辑链路完整；顺带修复两个既有缺陷（comment/like 表格未绑 selection-change 致批量删除永久禁用、删除确认"undefined 条"）——属行为修复已在提交信息声明；druid/三死组件/若依外链清除 |

**验证**：server build ✅、client `nuxt build` ✅（exit 0）、admin build:prod ✅（三次独立构建）。

**新发现（预存问题，归入第 6 步）**：`pnpm --filter client typecheck` 在任何提交上都挂——vue-router 被历史提交 7b6626d 钉在 4.5.0，而 Nuxt 生成的 tsconfig 引用 4.6+ 才导出的 `vue-router/volar/sfc-route-blocks` 子路径（ERR_PACKAGE_PATH_NOT_EXPORTED）。修法：升 vue-router 或让 .nuxt tsconfig 不引该插件。CI 门禁接入 typecheck 前必须先修。

**需用户决策（本次未动）**：admin 文章编辑双轨（ArticleForm vs editor.vue）保留哪条；admin/client MdViewer 统一到哪个栈。

---

## 十一、实施进度记录 III（2026-11-21，推送备份 + 第 3 步第一阶段）

**推送**：推送前对全部 90 个未推送提交做了敏感信息扫描（密钥赋值/私钥块/公网 IP/邮箱/新增 .env·.pem·.log 文件/yml 凭据/appid 硬编码 7 类模式）——全部干净；`3d92193..2c362f7` 已推 origin/dev。

**会话 G（第 3 步第一阶段，3 commits `2c362f7..eaa99e5`，只动 apps/server）**：

| 提交 | 内容 | 复审结论 |
|---|---|---|
| 78f7395 | BusinessException 基建 + filter 统一：信封与 ResultData.fail 同形 `{code,msg,data}`，HTTP 状态按业务码白名单映射（400/401/403/404/429/500 直接用其余归 500）；其余 HttpException（guard/ValidationPipe）与未知异常行为逐字未动 | ✅ |
| 1b88485 | post 模块 19 处 fail→throw 迁移示范（article/comment/like，含事务内失败路径 throw 回滚；subject 6 处留待第二阶段双轨过渡） | ✅ |
| eaa99e5 | loginlog 导出 10 行 bug 修复：findAll 加内部 `opts.paginate` 参数，export 走全量，对外语义不变 | ✅ |

**总览会话独立运行时验证**（8080 watch 实例已带新代码，Redis db2 读验证码答案登录实测）：
- 已迁移路径：`POST /api/post/comment`（不存在文章）→ **HTTP 500** + `{"code":500,"msg":"文章不存在或未发布","data":null}`（真实状态码 + 同形信封）✅
- 未迁移路径：重复注册（auth 模块）→ **HTTP 200** + `{"code":500,...}`（旧协议原样）✅
- Guard 行为未变（无权限 403 Forbidden resource）✅
- 双轨并存对前端不可见差异，符合设计预期

**会话 H（第 4 步收尾：editor 拆分，2 commits `8a943fc`、`b92cb7e`，只动 apps/client）**：
- 三个领域 composable：useMarkdownEditor（工具栏选区操作/快捷键/字数统计，textarea 引用入参）、useDraftBox（localStorage 草稿箱，**key 'article-drafts' 与 DraftItem[] 存档格式逐字保留防用户丢草稿**，新增 clearCurrentDraft）、usePublish（专栏/封面裁剪上传/校验提交，body 与 URL 逐字保留）；
- 两个子组件：EditorDraftPanel（153 行）、EditorPublishModal（312 行，Teleport 整体迁入）；
- **editor/new.vue 1282 → 521 行**（script+模板 289 行），页面回归主流程编排（初始化/?id= 编辑模式/图片插入三域留页面）；刻意不用 useState，状态生命周期仍随页面挂载。
- 复审：client build ✅，组装结构抽查干净。审查报告第三节 P0-1（全项目唯一阻碍维护的文件）至此关闭。

**第 3 步剩余（第二阶段，待派发）**：system/monitor/upload/common 约 50 处 fail→throw 迁移 + 拆 6 处 @Global 恢复模块边界。

**冒烟环境备注**：本地 Redis 用 **db 2**（dev.yml），验证码答案在 `captcha_codes:<uuid>`（值带 JSON 引号需剥掉）；注册验证码走 `GET /api/captchaImage?type=register` 无条件生成；登录验证码按 IP 失败次数动态触发。

---

## 十二、实施进度记录 IV（2026-11-21，第 3 步第二阶段 + 第 6 步收官）

第二批 9 个提交（`b92cb7e..45e141d`），**已连同前批推送 origin/dev（`2c362f7..45e141d`）**。

| 项 | 提交 | 复审结论 |
|---|---|---|
| 第3步第二阶段：system/auth/user/config+captcha 装饰器 34 处迁移 | daf8618 | ✅ 含 auth 的 429 限流路径（迁移后真实 HTTP 429，前端两套非 200 处理均兼容） |
| operlog 拦截器双协议兼容 | c0f5772 | ✅ 高质量：BusinessException.response 是对象会致 errorMsg varchar 落库失败丢日志——extractErrorMsg 归一为字符串，顺带修了 ValidationPipe 同类潜在丢日志 |
| upload 6 处 + subject 6 处迁移 | 63f2f5f、a549f5b | ✅ 全仓 ResultData.fail **调用清零**（剩 4 处均为注释）——**Server P0-2 关闭** |
| 第6步：vue-router 4.5.0→^5.4.0 修 typecheck 断裂 | b445a90 | ✅ client+admin 双包对齐单一副本；报告原判"4.6+ 可用"不准（实为 5.0+，最低满足 ^5.4.0） |
| root lint/test 聚合 script + admin lint script | 170ede4 | ✅ |
| quality-gate CI 门禁（push dev/master + PR master） | 45e141d | ✅ pnpm-setup 先于 setup-node、shared/utils dist 前置构建、frozen lockfile，步骤顺序正确 |
| client：删死样式 login.less | 9c43000 | ✅ 报告遗留死代码项；base/tokens 逐一核对有引用保留 |
| client：未登录隐藏创作者中心入口 | 9c9e282 | ⚠️ **非派发范围的行为变更**（SSR 首屏不再输出该按钮）——实现干净（同 useUser 源），对齐掘金，复审认可；如非你授意可说一声 revert |

### 总览会话独立复验（quality-gate 四项全绿）

- shared/utils build ✅、lint ✅（0 errors，9 warnings 不阻断）、**client typecheck EXIT=0 / 0 错误**（断裂修复实锤）、server test **8/8** ✅
- 运行时冒烟（8080 watch 实例）：注册成功 HTTP 200 ✅；**重复注册（auth 已迁移）→ HTTP 500 + `{"code":500,"msg":"该账号已注册，请直接登录"}`**（旧协议为 HTTP 200）✅；冒烟账号已清理

### 剩余路线图

- ~~第 3 步收尾：拆 @Global~~（J 完成，见十三节，路线图全部收官）
- 过时注释两处待改：~~server query/index.ts:96~~（J 已改）；client api.ts"HTTP 恒 200"（client 包范围外）
- 需产品决策：admin 双轨二选一 / MdViewer 统一栈
- 预存小项：nuxt.config css 入口 NUXT_B5026 警告

---

## 十三、实施进度记录 V（2026-11-21，会话 J：拆 @Global 收官，路线图全部完成）

**2 个提交（`f53561e` 拆 @Global 25 文件 +264/-186、`3f9e998` 注释清理 1 文件），未 push，只动 apps/server。**

### @Global 拆除清单

grep 实际 **16 处**（报告第二节记 6 处不全——monitor loginlog/operlog、system config/menu/role、common redis/axios/minio 也标了），全部拆除：

| 模块 | 去 @Global | 新增 imports |
|---|---|---|
| app.module | ✅ | +AuthModule（JwtAuthGuard 以 APP_GUARD 注册在根模块） |
| auth.module | ✅ | +RedisModule/CommonModule/AxiosModule/**SysConfigModule**/UserModule/MenuModule/LoginlogModule |
| user.module | ✅ | +RoleModule/RedisModule/UploadModule/**OperlogModule** |
| role.module | ✅ | +MenuModule/RedisModule；forFeature +UserEntity/SysUserWithRoleEntity |
| menu.module | ✅ | +RedisModule；forFeature +SysUserWithRoleEntity |
| config.module | ✅ | +RedisModule |
| dict/cache/online.module（本就非 Global） | — | +RedisModule（被 RedisModule 收口暴露的隐式依赖） |
| operlog.module | ✅ | +AxiosModule（IP 归属地） |
| article/subject/loginlog/upload/common/redis/axios/minio/system.module | ✅ | 无需新增（原有边界自洽） |

底层连接注入保持全局（刻意不动）：ConfigModule isGlobal、TypeOrmModule.forRoot、redis 客户端 token（`forRoot(options, true)`，与 DataSource 同级的连接注入）——只收口 RedisService 等服务包装层。

### 拆除暴露的三个循环，全部断除

1. **RoleModule⇄UserModule**：5 个角色↔用户绑定方法（allocatedList/unallocatedList/authUserCancel/authUserCancelAll/authUserSelectAll）user.service→role.service 原样迁入——端点 URL 域本就是 `/system/role/authUser/*`，方法零重复；RoleModule forFeature 声明式注册 UserEntity/SysUserWithRoleEntity。
2. **MenuModule⇄UserModule**：menu.service 弃 `UserService.getRoleIds`（唯一用途）改 SysUserWithRoleEntity 仓储直查（同表同条件同字段同 Uniq，逐字段等价），连带删除了预存的 `forwardRef`。
3. **AppModule→AuthModule**：根模块直连（guard 所需），语义合理。

### 网状耦合消解（报告第二节 P0-1 点名两处）

- `article.service → UserEntity repo`：维持 forFeature 方案（article.module 原本已注册，拆 @Global 后即显式化）。
- `user.controller → AuthService + UploadService` 双注入清零：
  - `updateRedisUserRolesAndPermissions` **下沉 user.service**（仅依赖 user.service 已有的 getUserinfo/getUserPermissions/redisService；auth.service 删除原方法，updateRedisToken 留守 login 流程）——会话刷新统一收口 user.service（对齐报告 P1-4"会话刷新职责漂移"）；
  - 头像上传链路收口 `user.service.uploadAvatar(userId, file, authorName, token)`（singleFileUpload 落地 + updateUserAvatar 落库/刷会话）——评估结论：头像链路确需 UploadService 的存储+落库能力，重写即复制；UserModule 显式 import UploadModule 为单向声明边，无环。

### 运行时冒烟实录（18081 临时实例，`NODE_ENV=development SERVER_PORT=18081 node dist/main.js`）

- 启动 **零 DI 报错**，全部路由映射完成（MinIO 初始化失败为预存配置噪音，RustFS 才是启用存储）
- `GET /post/article/guest/list` → **200**（公开链路，total 3）
- `POST /login`（冒烟账号 member 角色）→ **200**（AuthModule 七 imports 全链路）
- `GET /system/user/profile` → **200**（需权限端点，UserController→UserService→RedisService 链）
- `GET /getRouters` → **200**（menu.service 新仓储查询路径；member 返回 0 路由为预存数据形态：其仅授 C 型 107 通知公告但父目录 1 未授，非回归）
- `GET /system/user/list` → **403**（member 无 system:user:list，PermissionGuard 行为不变）
- 冒烟账号已清理（sys_user+sys_user_role 删除、Redis 会话键踢除）；18081 实例已杀，8080 watch 未动（其随 src 编辑自动重编译，事后验证 200 健康）

### 注释清理（3f9e998）

- `common/query/index.ts:96`：删"未迁移模块暂用 ResultData.fail（统一错误协议迁移中）"，改为"调用方 throw BusinessException，由 AllExceptionsFilter 统一出信封"；
- 全仓 grep 暂用/迁移中/TODO：server src 仅剩 user.service filter→forEach TODO（其要求的优化早已实施，标记随 f53561e 删除）；operlog 拦截器"兼容双协议"注释仍准确（BusinessException 对象 vs HttpException 字符串至今并存）不动；
- client api.ts"HTTP 恒 200"在 client 包（本批次只允许动 apps/server），未动。

### 验证与工程细节

- `pnpm --filter server build` ✅、eslint（全部改动文件）0 错误 ✅
- **并行会话坑（重要）**：`git commit` 会把暂存区里他人已 staged 的改动一并扫进——J 首提扫进 2 个 client MdViewer 样式 staged 删除，soft reset 剥离重提（`git diff --cached --name-only` 核对后确认 25 文件纯净），并用 `git rm --cached`/`git add` 恢复并行会话暂存态；commit ② 用 `git commit -- <path>` pathspec 形式。并行期提交纪律升级：**显式 add 之外，commit 前必须核对暂存区**。
- 易漏点备忘：@Captcha 装饰器按名注入的是 system/config 的系统 ConfigService（非 @nestjs/config）；@Operlog 拦截器在被装饰控制器所属模块的上下文实例化，故 UserModule 须 import OperlogModule。
- MinioModule 全仓零消费方（无 import、MinioService 零注入），仅去 @Global 未删——死模块候选，留待后续清理。

**至此报告路线图第 1~6 步全部收官。**

---

## 十四、实施进度记录 VI（2026-11-21，会话 L：渲染栈统一 + 总览复审收口）

**会话 L（4 commits `208a16d..e215b00`）**：
- 新建 `packages/markdown`（@nest-acticle/markdown，tsup 双格式 exports，渲染配置与 .markdown-body 样式自 client MdViewer 逐字迁入，copy 的 ClipboardJS 事件留组件壳）；
- client MdViewer 234→58 行薄壳（SSR 场景 ClipboardJS 绑定保持客户端守卫模式）；admin MdViewer 弃 MdPreview 换共享渲染器——**后台预览与前台呈现从此同源**（MdEditor 编辑组件仍用 md-editor-v3 不动）；
- **16 样本（多语言代码块/表格/引用/图片/链接）HTML 等价性 diff 为空**；
- quality.yml 共享包构建步骤补 markdown filter；client api.ts 过时注释"HTTP 恒 200"顺改。

**总览会话复审确认（全部独立复验）**：
- `@Global` 装饰器清零（grep 剩 14 处全为改造说明注释）；
- quality-gate 五项复跑全绿：server build ✅、client typecheck EXIT=0/0 错误 ✅、server test 8/8 ✅、client build ✅、admin build:prod ✅、lint 0 errors ✅；
- 运行时冒烟（8080 watch 已带新代码）：guest/list 200、注册+登录 200、getInfo/getRouters 200（MenuModule⇄UserModule 解环路径实测）、allocatedList 403（member 无权限的正确表现，DI 链健康至权限层）；冒烟账号已清理；
- 用户格式化的 index.vue 已代提交（`dddb80a`，纯格式化 -35/+9）；
- **`45e141d..dddb80a` 7 commits（J 2 + L 4 + 格式化 1）已推 origin/dev，分支同步**。

**审查报告全部 P0/P1 架构项至此关闭**：错误协议双轨（P0-2）、模块边界（P0-1）、公共查询层与 N+1（P1-1/2）、editor 上帝组件（client P0-1）、渲染栈两套（P2-5）。遗留：会话 M（编辑器统一：client 编辑器抽共享包、admin 弃 md-editor-v3，用户已拍板方向；落地后收敛 admin 双轨）、MinioModule 死模块候选、NUXT_B5026 css 警告、ACCOUNT_EXISTS_HINTS 文案匹配小债。

---

## 十五、实施进度记录 VII（2026-11-21，会话 M：编辑器统一，审查报告全项闭环）

**5 commits（`11f573a..9be1475`），已推 origin/dev（`dddb80a..9be1475`），分支同步。**

- **`11f573a` 新建 packages/editor（@nest-acticle/editor）**：MarkdownEditor 组件（374 行，工具栏/快捷键/字数行数/预览/粘贴上传）；`uploadImage` 回调注入（不绑死任何 app 的上传体系，未传时粘贴静默忽略）；expose `insertText` 供裁剪回调定插位；预览复用 @nest-acticle/markdown 渲染栈；打包选型 **vite lib mode + vue-tsc dts**（tsup 仅支持 esbuild 插件无法挂 vue 插件——选型结论已写入包 README）。
- **`20f9771` client 接入**：editor/new.vue 工具栏/textarea/预览/状态栏整体移交共享包（-290 行），草稿提示经 `status-extra` 插槽并入共享状态栏；useDraftBox/usePublish/DraftPanel/PublishModal 不动；行为保真：草稿 key/格式/800ms 防抖、快捷键集合、发布校验顺序、先裁剪再上传链路与文案逐字。
- **`cb94ee6` admin editor.vue + 公告抽屉替换**：文章编辑体验与前台写作对齐（同工具栏/快捷键/字数统计/同源预览）；uploadImage 走 useRequest + POST /common/upload（10MB 上限、放宽超时沿用原口径，失败 throw 防残缺内容插入）；**公告页顺带受益统一**（MdEditor 本就需替换）。
- **`e76da5e` ArticleForm 收敛为元数据快速编辑**：移除 content 表单字段与预览页签，正文位放"请在编辑器中维护"引导（跳 /post/article-editor?id=）；payload 剥离 content（**repo.update 跳过 undefined 不动正文 + 避免列表快照回写旧正文**）；列表页"修改"入口不变。**admin 双轨正式收敛为单一内容编辑链路。**
- **`9be1475` 清理**：admin 删 components/MdEditor + md-editor-v3 依赖（**全仓 grep 为 0**），client 依赖收敛到 markdown+editor 两包；vite chunkSizeWarningLimit 收紧；quality.yml 补 editor filter。

**总览会话复审（独立复验）**：typecheck EXIT=0 ✅、client build EXIT=0 ✅（grep 命中的 2 处 "error" 为错误页 chunk 文件名误报）、admin build:prod ✅、lint 0 errors ✅、server test 8/8 ✅、server build ✅。dev 累计 **40 commits 全部已推 origin/dev**。

**待人工视觉回归清单**（curl 无法覆盖的交互层）：①client 工具栏 10 按钮与快捷键（Ctrl+B/I）②粘贴图片上传（先裁剪再上传、取消静默）③admin editor.vue 编辑/保存/发布全流程 ④公告抽屉内容编辑 ⑤ArticleForm"打开编辑器"跳转带 id ⑥admin 深浅色下编辑器样式。

**审查报告全部条目（P0/P1/P2 架构与质量项）至此全部闭环。** 剩余仅预存小项：NUXT_B5026 css 警告（需视觉验证）、MinioModule 死模块候选、ACCOUNT_EXISTS_HINTS 文案匹配小债——均为独立小改，可随日常迭代处理。

---

## 十六、专项复审：编辑器 & MD 展示层（2026-11-21，追加交互批次 + 修复会话 N）

**追加交互批次复审**（15 commits 5c99f3c..042670e，用户已部署验收）：实现质量高——KaTeX 字体按需分发（style.css 67KB，字体独立文件）、lightbox 单例+委托+解绑+焦点还原、mermaid 懒加载 data-processed 幂等+壳有 catch、滚动同步单向守卫、escapeTextarea 防 </textarea> 注入、katex 未开 trust。**发现 1 个 P0 + 1 个 P1 + 2 个 P2，会话 N 已全部修复（4 commits 604cd38/b03a9b4/3cd3573/d75fa8d）**：

| 级别 | 问题 | 修复 |
|---|---|---|
| P0 | `html:true` 无清洗 = 存储型 XSS（member 免审直发 + admin 预览同源，admin 会话在暴露面；实测 4 篇文章 0 篇用裸 HTML，收口零兼容成本） | `html:false`（实体引用由独立 entity 规则处理不受影响），理由注释写明升级路径（未来要 raw HTML 则接 DOMPurify） |
| P1 | mermaid securityLevel 靠库默认值，升级即漂移 | 显式 `securityLevel:'strict'` + initialize 提升模块级单次 |
| P2 | lightbox 点图即关遮罩；缺 aria-modal | target 判断点图不关 + aria-modal 基础 a11y |
| P2 | editor/new.vue 因发布前预览遮罩内联回涨至 637 行 | 抽 Editor/PreviewOverlay.vue（262 行），页面回落 452 行 |

**复审验证**：markdown 包 build ✅、typecheck EXIT=0 ✅、client/admin build ✅、lint 0 errors ✅、test 8/8 ✅。**`042670e..b03a9b4`（含交互批次 15 + 修复 4 = 19 commits）已推 origin/dev，分支同步。**

**待人工视觉回归追加项**：预览遮罩（目录/作者卡/sticky 对齐/lightbox 层级）、mermaid 与数学公式观感、lightbox 点图不关交互、编辑器拖拽上传。

*审查报告至此全部条目闭环且专项复审清零；dev 累计约 66 commits 全部已备份。*
