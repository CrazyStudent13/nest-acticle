# @nest-acticle/editor

Markdown 编辑器共享包：client（Nuxt）与 admin（Vue3）共用的纯编辑组件——textarea + 工具栏 + Ctrl+B/I 快捷键 + 字数/行数统计 + 左写右预览 + 粘贴/按钮图片上传。编辑体验与前台写作完全一致；预览渲染走 `@nest-acticle/markdown`（预览即前台呈现）。

## 使用

```vue
<script setup lang="ts">
import { MarkdownEditor } from '@nest-acticle/editor'
import '@nest-acticle/editor/style.css'
import '@nest-acticle/markdown/style.css' // 预览区的 markdown-body 样式（与文章详情页同源）

// 上传经回调注入：裁剪/上传/地址补全是宿主业务
const uploadImage = (file: File) =>
  cropImage(file).then((cropped) => uploadToServer(cropped, 'article/content')).then((url) => toAbsUrl(url))
</script>

<template>
  <MarkdownEditor v-model="content" :upload-image="uploadImage">
    <template #status-extra>
      <span class="status-hint">附加状态（右对齐）</span>
    </template>
  </MarkdownEditor>
</template>
```

## API

props：

- `modelValue: string` — 正文内容（`v-model`）；
- `uploadImage?: (file: File) => Promise<string>` — 图片上传回调，返回 markdown 可用的 URL；未传时粘贴/按钮上传静默忽略并 `console.warn`。回调内 reject 即取消插入（提示由宿主负责）；
- `placeholder?: string` — 默认 `请输入内容（支持 Markdown 语法）`；
- `height?: string` — 编辑器整体高度，默认 `100%`；
- `preview?: boolean` — 左写右预览开关，默认 `true`（≤900px 窄屏自动隐藏预览）。

emits：`update:modelValue`。

slots：

- `status-extra` — 底部状态栏附加内容（字数/行数右侧，宿主自行控制对齐/显隐）。

expose：

- `insertText(text: string)` — 在当前光标处插入文本（裁剪回填等外部插入用）。

## 样式

`dist/style.css` 为组件自身样式，所有规则收在 `.na-md-editor` 命名空间下；颜色走宿主 CSS 变量（`--color-surface` / `--color-bg` / `--color-text-*` / `--color-border-light` / `--color-primary` / `--radius-sm`）并提供浅色回退默认值——client 主题经 tokens 生效，admin（无该变量体系）直接得到回退浅色。

预览区样式来自 `@nest-acticle/markdown/style.css`，由宿主显式引入（避免包内重复打包一份渲染样式）。

## 打包

vite lib mode（ESM + CJS，`cssFileName: style`）+ vue-tsc 生成 dts。说明：tsup 仅支持 esbuild 插件，`@vitejs/plugin-vue` 是 vite 插件无法挂入 tsup 管线，故 SFC 编译选型为 vite lib mode，产物 exports 形态与 `@nest-acticle/markdown` 对齐（双格式 js + 单一 types 入口 + style.css），两端零消费侧配置。
