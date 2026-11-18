# @nest-acticle/utils

monorepo 纯函数工具包：校验、树构建、日期格式化、查询串序列化、文件 URL 拼接。

- 唯一运行时依赖 **dayjs**（三端均已使用，解析到同一份）。
- tsup 双格式（ESM + CJS）输出，server(CJS)/admin/client(ESM) 通用。

## 内容

| 模块 | 内容 | 来源 |
| --- | --- | --- |
| `validate.ts` | isExternal/isHttp/validURL/validEmail/isString/isArray/validAlphabets/中英文/数字/空白等 16 个纯函数 | client validate.ts（已删）+ admin useValidator 正则等价部分 |
| `tree.ts` | `buildTree`（扁平列表 → 树，可配 id/parent/children 字段名） | admin handleTree |
| `date.ts` | `formatDateTime`/`formatDate`/`nowDateTime`/`formatObjectDate`（Invalid Date 回退空串） | client 各组件重复模式 |
| `query-string.ts` | `serializeQuery`（嵌套参数 → `a[b][c]=v` 查询串） | admin useRequest.paramsToQueryString |
| `url.ts` | `isExternalUrl`/`joinFileUrl`（相对上传路径拼服务地址） | admin image.ts + client cover.ts |

## 明确不迁的（避免语义漂移）

- server `ListToTree`：输出新 `{id,label,children}` 节点的映射语义，与 `buildTree` 不同，保留在 server。
- server `FormatDate/GetNowDate/FormatObjectDate`：耦合 server 的 dayjs 时区插件设置（Asia/Beijing）。
- admin zod 校验：原 useValidator 的 zod 部分已随死码删除（零消费者），zod 依赖一并移除。

## 使用

```ts
import { buildTree, formatDateTime, joinFileUrl } from '@nest-acticle/utils';
```
