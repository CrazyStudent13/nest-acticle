# @nest-acticle/shared

monorepo 契约共享包：响应信封、分页契约、状态枚举、文章/专栏线格式类型与业务常量。

- **零运行时依赖**，tsup 输出 ESM + CJS 双格式，server(CJS)/admin/client(ESM) 通用。
- 类型全部是 server 实体/DTO 的**手工镜像**，每个文件头部标注了契约来源；
  改 server 侧字段时必须同步这里（后续阶段可引入 openapi-typescript 自动生成替代）。

## 内容

| 模块 | 内容 |
| --- | --- |
| `enums.ts` | PublishStatusEnum / AuditStatusEnum / ArticleSourceEnum / SortRuleEnum |
| `constants.ts` | SUCCESS_CODE 等业务码、`*:*:*`/`admin` 权限字面量、DICT_TYPE 字典类型 |
| `types/api.ts` | ApiResponse（信封）、PageResult、PageQuery、PagingParams |
| `types/article.ts` | Article、ArticleUserInfo、ArticleQueryParams、ArticleAuditParams |
| `types/subject.ts` | Subject |

## 使用

```ts
import { ApiResponse, PublishStatusEnum, SUCCESS_CODE } from '@nest-acticle/shared';
```

开发期改共享包后运行 `pnpm --filter @nest-acticle/shared build`（根目录 `pnpm dev` 已内置 watch）。
