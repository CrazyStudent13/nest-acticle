# Client 开发约定

前台经过两轮架构收敛后的现行约定（2026-11 复审与修复批次确立）。新页面/新功能按这些范式写，不要开新岔路。

## 请求与鉴权

- **apiFetch 统一出口**（`composables/api.ts`）：信封解包、401 统一清态+弹登录框（`isOpen` 防重复弹）、登录/登出豁免、过期会话静默恢复例外。页面不要裸 `$fetch`
- **token 单一来源**：`utils/auth.ts`（cookie + 内存镜像），无散落 localStorage
- **auth route middleware**：按 `definePageMeta` 分档——默认未登录回首页；editor/creator 原地弹登录；space 游客旁路
- **SSR 边界**：依赖登录的页面 `routeRules` 设 `ssr:false` + 弹窗 `ClientOnly`；localStorage 只落客户端路径

## 状态管理

- `useState` 组合式全局态：useUser / useAuthModal / useToast / useNotify（红标未读全局单例）/ useDict / useTheme
- 不引入 pinia；跨页共享一律 useState，页面私有状态留在页面

## 列表与分页

- **usePagedList**：翻页替换式列表（请求只由 `load(页码)/reload()` 触发，不 watch 页码——从根上消除「置页码触发 watch + 显式加载」并发两发）
- **useInfiniteList**：「加载更多」追加式（按 keyOf 去重、到底判定用含重复行的累计原始条数）
- 两者都带请求序号：只认最新一发，过期响应不落状态。**新列表一律走这两个 composable，禁止手写 page/total/loading 套件**（历史教训：通知中心曾同时存在 5 套手写分页）

## 领域 composable

接口调用按域收敛，不裸调 URL：useLike / useComment / useCollect / useFollow / useNotify / useSubject / useArticleManage / useNotice / useUpload / useDict（字典 enabled 门控按需拉取）。新端点先进对应域文件，再被页面消费。

## 通知红标

- 未读数 `useNotify` 全局单例，AppHeader 铃铛与通知中心页读写同一份
- 已读水位服务端原子 upsert（毫秒精度），逐栏进栏清零；**无轮询**——刷新时机仅头部挂载 + watch(isLoggedIn)

## 点赞/收藏/评论/关注

- 点赞计数：本地覆盖 ref（`xxNumLocal ?? server`）+ 失败回滚 + 切文重置
- 收藏集：详情页切集先清空再带登录态重拉（Nuxt 新 key 会沿用旧数据）；追加列表走 useInfiniteList
- 评论：CommentSection 自带 listSeq 丢弃过期请求、append 按 id 去重、沿 parentId 链归位
- 关注：三态按钮（Follow/Button.vue）state 未传自行查 status、列表行直传；动作后回读 status 拿互关态，页面回写行数据。详见 [关注模块约定](./follow)
