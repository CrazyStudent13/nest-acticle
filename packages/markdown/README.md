# @nest-acticle/markdown

Markdown 渲染共享包：client（Nuxt）与 admin（Vue3）两端的 `MdViewer` 薄壳共用同一渲染器与样式，保证"同一段 markdown 在 admin 预览与 client 文章页输出完全一致的 HTML"。

## 使用

```ts
import { createMarkdownRenderer } from '@nest-acticle/markdown'
import '@nest-acticle/markdown/style.css'

const renderer = createMarkdownRenderer()
const html = renderer.render(source) // 兼容引号包裹内容与字面 \n
```

组件壳负责：

- 渲染结果 `v-html` 输出（模板根元素挂 `.markdown-body` 类）；
- `ClipboardJS('.copy-btn')` 事件绑定与"已复制"反馈（必须在 onMounted/客户端环境内，包只产出带 `data-clipboard-*` 属性的按钮 HTML）。

## API

- `createMarkdownRenderer(options?)` → `{ render(source): string }`
  - `options.copyButton`（默认 `true`）：是否生成代码块复制按钮 HTML。

## 样式

`dist/style.css` = highlight.js github-dark 主题 + github-markdown 基础样式 + 站点补丁/代码块增强，层叠顺序与原 client 壳一致。所有自定义规则收在 `.markdown-body` 命名空间下；颜色走宿主 CSS 变量（`--color-text-1` / `--color-surface` / `--color-primary`）并提供回退默认值，宿主可在更高层级覆盖。源码 less 在 `src/styles/`，由 `scripts/build-styles.mjs` 编译。
