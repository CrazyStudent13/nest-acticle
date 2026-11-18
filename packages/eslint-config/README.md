# @nest-acticle/eslint-config

monorepo 共享 ESLint flat config 预设（eslint ≥9）。

| 导出 | 用途 | 消费方 |
| --- | --- | --- |
| `tsPreset` | typescript-eslint flat recommended + node/jest globals + prettier 让位 | `apps/server` |
| `vuePreset(options?)` | vue flat essential + vue-ts recommended + prettier 让位 + perfectionist 排序 | `apps/admin` |

## 用法

```js
// eslint.config.mjs
import { tsPreset } from '@nest-acticle/eslint-config';

export default [
  { files: ['src/**/*.ts'] },
  ...tsPreset
];
```

规则调整统一改本包；应用特有规则写在各应用自己的 `eslint.config.*` 里。
