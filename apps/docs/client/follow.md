# 关注模块约定

关注（用户对用户）模块的前端契约与现行交互（2026-11 新增）。计数采用**读时 COUNT**：`post_follow` 明细表 + 两方向索引，`fanNum` 无冗余计数列——展示侧每次现查，天然精确、无回减维护。

## 接口契约（/api/post/follow）

| 路由 | 鉴权 | 说明 |
|---|---|---|
| `POST /:userId` | JWT | 关注（幂等；禁止自关注）；返回 `{ followed, fanNum }` |
| `DELETE /:userId` | JWT | 取关（幂等）；返回 `{ followed, fanNum }` |
| `GET /status/:userId` | JWT | `{ followed, mutual, fanNum }`，互关标记只此接口给出 |
| `GET /guest/list?userId=&type=` | 公开 | `type=following\|fans`，关注/粉丝列表（关注时间倒序） |
| `GET /received/list` | JWT | 通知中心「新增粉丝」栏：谁关注了我 |

- **guest/list 可选鉴权**：`NotRequireAuth` 接口对有效 token 仍填充 user——登录态访问时条目回填访问者视角 `followState`，未登录一律 `none`
- **条目批查**：每页粉丝数（GROUP BY）与访问者状态（两方向 IN）各一次查询，无 N+1
- **关注/粉丝列表对访客公开**（同掘金）；用户级「是否公开关注栏」是未来可选项，当前未建

## 三态按钮（Follow/Button.vue）

`followState: none=关注 / following=已关注 / mutual=互相关注`。

- **state 未传**：挂载后自行查 status（作者卡场景，仅登录态查询）；**列表场景由行数据直传**，免查询
- 点击动作成功后**回读 status** 取权威互关态（follow 响应只带 followed+fanNum），`emit('change', { state, fanNum })` 由页面回写行数据（组件不直改 props）
- 未登录点击直接弹登录框（不等 401 统一出口的静默处理）
- 取消关注 hover 变红提示（描边弱化态）

## 挂点

- **空间页**：关注/粉丝两个 tab（公开、guest 接口本人/访客共用，走 usePagedList）；他人空间资料卡带关注按钮；条目按钮动作后页面按 userId 回写行状态
- **文章页**：AuthorCard 统计行下方通栏按钮；作者本人不渲染（登录态水合前先按游客渲染，水合后隐藏）
- **通知中心**：`follower` tab 接 received/list，行尾回关按钮；该栏行构造上 `followState` 只会是 `none`（待回关）/`mutual`（已互关）

## 通知红标

- `NotifyUnreadCount` 含 `follow` 分类，铃铛 total 计入
- 通知中心左侧「新增粉丝」栏独立计 follow 未读，进栏清零（`markRead('follow')`），无轮询——同既有互动红标口径
