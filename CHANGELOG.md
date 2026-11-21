# Changelog

更细粒度的过程记录（审查 → 修复 → 验收全程）见 [CODE-REVIEW-2026-11-20.md](./CODE-REVIEW-2026-11-20.md)。

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
