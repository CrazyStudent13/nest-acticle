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
  - `options.math`（默认 `true`）：渲染行内 $...$ 与块级 $$...$$ 数学公式（katex）。插件对"$ 后紧跟数字"的计价文案做了规避（如 `价格 $5 和 $10` 保持字面）。
  - `options.mermaid`（默认 `true`）：```mermaid 代码块输出为待渲染的 `.mermaid` 容器（不产出普通代码块）。

渲染器内置两条通用规则：站外 http(s) 链接 `target=_blank` + `rel=noopener noreferrer`（站内相对链接保持当前页跳转）；正文图片 `loading=lazy` + `decoding=async`。
- `openImageLightbox(src)` / `bindImageLightbox(container)`：图片点击放大。bind 以事件委托挂在壳容器上（返回解绑函数，卸载时调用），v-html 重渲染无需重绑；遮罩样式随包 style.css（`.na-markdown-lightbox`）。
- `renderMermaidDiagrams(root: Element)` → `Promise<number>`：把 root 下所有 `.mermaid` 容器渲染为 SVG。内部动态 import mermaid（约 3MB 依赖闭包独立分包），宿主在挂载/内容更新后按需调用；重复调用幂等（`data-processed` 跳过）。典型用法见两端 MdViewer 壳。
- `extractMarkdownHeadings(content?)` → `TocHeading[]`：从 Markdown 源码提取 ATX 标题大纲（剔除围栏代码块与行内标记），供 `@nest-acticle/editor` 的共享目录组件使用。

## 样式

`dist/style.css` = highlight.js github-dark 主题 + github-markdown 基础样式 + 站点补丁/代码块增强 + katex 公式样式（字体随包 `dist/fonts/`，打包器按 url() 引用自动发射），层叠顺序与原 client 壳一致。所有自定义规则收在 `.markdown-body` 命名空间下；颜色走宿主 CSS 变量（`--color-text-1` / `--color-surface` / `--color-primary`）并提供回退默认值，宿主可在更高层级覆盖。源码 less 在 `src/styles/`，由 `scripts/build-styles.mjs` 编译。
