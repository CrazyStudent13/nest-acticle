# Changelog

更细粒度的过程记录（审查 → 修复 → 验收全程）见 [CODE-REVIEW-2026-11-20.md](./CODE-REVIEW-2026-11-20.md)。

## v1.2.1（2026-11-23）

收藏集标签枚举接入数据字典，管理端新增「自建」类型标签。

> 升级提示：本版本含字典种子数据——`sys_dict_type` 增 16 收藏集可见性（`sys_collection_visibility`）/ 17 收藏集类型（`sys_collection_type`），`sys_dict_data` 增 50~53 四项（详见 `apps/server/db/init.sql` 字典区末尾）。存量环境手工执行 INSERT 后需清理 Redis `sys_dict:all` 缓存，并 touch 字典行（`update sys_dict_data set update_time = now()`）推进版本号，前端才会重新拉取。

### 新增

- **数据字典**：收藏集可见性（0 公开 success / 1 私密 info）与收藏集类型（1 默认 warning / 0 自建 primary）建立字典，文案与标签颜色可在管理端「字典管理」维护，不再硬编码
- **admin**：收藏管理页可见性列与名称列标签改 `DictTag` 按字典渲染；非默认收藏集新增「自建」类型标签（与「默认」同字典同口径）

### 修复

- admin 收藏管理操作列过窄导致「文章/删除」竖排换行：加宽至 160px 并右固定；收藏文章抽屉分页组件沉底右下角

## v1.2.0（2026-11-23）

收藏集与收藏功能全链路（前台交互 + 通知中心 + 管理端），对齐掘金收藏集形态。

> 升级提示：本版本含数据库变更，存量环境需执行增量 DDL——新增 `post_collection` / `post_collection_article` / `post_collection_sub` 三表（含 `uk_user_default` 唯一索引），`post_article` 增 `collect_num` 列与 `post_collection.is_default` 列（详见 `apps/server/db/init.sql` 24~26 号表）。

### 新增

- **收藏集**：前台创建/编辑/删除（公开/私密可见性，私密仅创建者可见，管理员例外）；个人空间「收藏集」tab（我创建的/我订阅的子栏 + 行内悬浮编辑/删除）；收藏集详情页（品牌渐变横幅 + 「N篇文章 · N订阅」统计行 + 加载更多）
- **收藏动作**：文章详情收藏弹窗（勾选收藏集 / 行内新建 / 星标高亮与计数角标）；收藏与移出幂等（唯一索引 + INSERT IGNORE，同点赞模式），事务维护集内文章数与文章 `collect_num` 双计数
- **默认收藏夹**：注册事务内与用户同建（原子防半成功），存量用户惰性补建；`uk_user_default` 唯一索引利用 NULL 不参与唯一约束保证一人至多一个；置顶展示，前台与管理端删除均拦截/跳过
- **订阅**：公开收藏集可订阅/退订（幂等 + 订阅数维护），空间页「我订阅的」列表
- **通知中心**：「赞和收藏」栏拆收到的赞/收到的收藏双子栏；未读计数扩 `collect` 分类（铃铛合计），进入栏目一次推平 like+collect 已读水位；收到的收藏仅统计公开收藏集
- **管理端**：交互管理下新增收藏管理页（名称/创建者模糊搜索 + 时间范围过滤 + 公开私密/默认标签），「文章」抽屉分页查看集内文章（管理员可看私密集），勾选批量删除联动清理收藏/订阅关系并回减文章收藏数
- **契约与数据**：`packages/shared` 增 `types/collection.ts`；`apps/server` 新增 `post/collection` 模块（guest/写路径/管理端三层鉴权口径）；init.sql 增 24~26 号表

### 修复

- 私密集本人访问时文章列表为空：SSR 无 token 被可见性拒绝，登录态恢复后检测详情计数与列表不一致即补拉首屏
- 管理列表漏 `addSelect` 导致创建者昵称恒空
- notify 已读 DTO 未放行新分类 `collect`

## v1.1.0（2026-11-22）

首个正式功能版本：monorepo 整合收官 + 全量代码审查修复 + 编辑器/渲染层统一。

### 新增

- **共享包四件套**：`@nest-acticle/shared`（契约）/ `utils`（纯函数）/ `markdown`（渲染器 + KaTeX + mermaid）/ `editor`（Markdown 编辑器组件，vite lib mode + vue-tsc dts）
- **编辑器统一**：client/admin 共用同一 MarkdownEditor——工具栏/快捷键（Ctrl+B·I / Tab 缩进 / Ctrl+S）/撤销栈保栈/链接插入弹窗/粘贴+拖拽上传/滚动同步/字数·阅读时长；md-editor-v3 全仓移除
- **展示增强**：KaTeX 数学公式、mermaid 图表懒加载（无图表零加载成本）、lightbox 图片放大（三消费方同源）、外链新窗口、图片懒加载
- **client**：发布前全屏预览遮罩（目录/作者卡/与详情页同构）、编辑模式本地草稿快照与恢复横幅、Ctrl+S 存草稿、通知中心"收到的赞"
- **admin**：ArticleForm 收敛为元数据快速编辑（editor.vue 唯一内容编辑链路）

### 安全

- 修复存储型 XSS：markdown-it 关闭 raw HTML 透传（`html:false`）+ 围栏外 HTML 注释剥离
- mermaid `securityLevel: 'strict'` 显式声明
- 封堵文章 DTO mass assignment（计数可伪造/审核可绕过）

### 修复

- 审核人 auditUserId 硬编码、分片上传 COS 状态回写失效、评论管理列表被回复人昵称恒空、admin 权限串大小写不一致、loginlog 导出仅 10 行、层叠弹窗 ESC 连退

### 架构与工程

- 拆除 16 处 `@Global` 恢复模块边界（断除 Role⇄User / Menu⇄User 循环）
- 错误协议统一：`ResultData.fail` 全迁 `BusinessException`（HTTP 状态真实化，信封形状不变）
- 公共查询层 `paginate / applyLike / attachUserInfo / assertOwnership`，消列表 N+1
- CI 质量门禁（lint / typecheck / test / build 五项）+ apiBase 同源化（Nitro 代理，换网络零配置）

## v1.0.0（2026-11-19）

monorepo 整合基线：`nest-admin`（v1.2.0）+ `nuxt3-article`（2026-11-17 快照）并入单仓，shared/utils 契约层建立，阶段一~三完成（注册审计、点赞模块全链路、评论模块全链路）。
