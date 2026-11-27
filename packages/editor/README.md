# @nest-acticle/editor

Markdown 编辑器共享包：client（Nuxt）与 admin（Vue3）共用的编辑与预览组件——`MarkdownEditor`（textarea + 工具栏 + Ctrl+B/I 快捷键 + 字数/行数统计 + 左写右预览 + 粘贴/按钮/拖拽图片上传 + 拖入 .md 导入）与 `ArticlePreview`（发布前整页预览：详情页版式 + 正文渲染 + ESC/锁滚动）。编辑体验与前台写作完全一致；预览渲染走 `@nest-acticle/markdown`（预览即前台呈现）。

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

emits：

- `update:modelValue`；
- `markdown-import` — 拖入 `.md` / `.markdown` 文件并插入后触发，载荷 `{ title: string; fileName: string }`。正文已按光标位置插入（YAML front matter 已剥离，不进入正文），`title` 取自 front matter，宿主可在标题为空时回填。

拖入文件时编辑器高亮并显示「松开导入 Markdown 文件或图片」：图片走 `uploadImage` 上传链路，`.md` 文件读取后按当前光标插入正文，不覆盖已有内容。`.md` 单文件上限 1MB，超限不导入并在状态栏提示文件名。

slots：

- `status-extra` — 底部状态栏附加内容（字数/行数右侧，宿主自行控制对齐/显隐）。

expose：

- `insertText(text: string)` — 在当前光标处插入文本（裁剪回填等外部插入用）。

## ArticlePreview（发布前预览）

按文章详情页版式拼装标题/作者/发布时间/专栏/封面/正文，正文复用 `@nest-acticle/markdown` 渲染（复制按钮/图片放大/mermaid 与详情页一致）。右栏内置作者卡（头像/昵称/文章/阅读/获赞）与目录（标题大纲、点击定位、滚动高亮），client 与 admin 看到同一套版式；`aside` 插槽可继续追加宿主自定义内容。

```vue
<script setup lang="ts">
import { ArticlePreview } from '@nest-acticle/editor'
import '@nest-acticle/editor/style.css'
import '@nest-acticle/markdown/style.css' // 正文 markdown-body 样式（与文章详情页同源）

const previewOpen = ref(false)
</script>

<template>
  <ArticlePreview
    v-model:open="previewOpen"
    :title="title"
    :content="content"
    :cover-url="coverUrl"
    :author-name="authorName"
    :author-avatar="authorAvatar"
    :author-href="authorHref"
    :author-stats="authorStats"
    :publish-time="publishTime"
    :subject-title="subjectTitle"
  >
</template>
```

props：

- `open?: boolean` — 遮罩显隐（支持 `v-model:open`），默认 `false`；
- `title?: string` — 文章标题，缺省显示「无标题」；
- `content?: string` — 正文 markdown；
- `coverUrl?: string` — 封面地址（相对/绝对由宿主补全）；
- `authorName?: string` — 作者昵称，缺省显示「佚名」；
- `authorAvatar?: string` — 作者头像（相对/绝对由宿主补全）；
- `authorHref?: string` — 作者空间链接；不传则作者区仅展示不可跳转；
- `authorStats?: { total; reads; likes } | null` — 作者统计，未传按 0 展示；
- `showAuthorCard?: boolean` — 是否展示右栏作者卡，默认 `true`；
- `publishTime?: string` — 发布时间；缺省时按打开时刻定格；
- `subjectTitle?: string` — 专栏名，有值才显示。

emits：`update:open`。slots：`aside`（追加到右栏作者卡/目录之后，≤1000px 整体隐藏）。目录在正文存在标题时自动展示（含点击定位与滚动高亮）。ESC 关闭（lightbox 打开时先关 lightbox），预览期间锁 body 滚动，退出时只还原自身加上的锁。

## 样式

`dist/style.css` 为组件自身样式，规则分别收在 `.na-md-editor`、`.na-article-preview`、`.na-preview-author*` 与 `.na-toc-*` 命名空间下；颜色走宿主 CSS 变量（`--color-surface` / `--color-bg` / `--color-text-*` / `--color-border-light` / `--color-primary` / `--radius-sm`）并提供浅色回退默认值——client 主题经 tokens 生效，admin（无该变量体系）直接得到回退浅色。

预览区样式来自 `@nest-acticle/markdown/style.css`，由宿主显式引入（避免包内重复打包一份渲染样式）。

## 打包

vite lib mode（ESM + CJS，`cssFileName: style`）+ vue-tsc 生成 dts。说明：tsup 仅支持 esbuild 插件，`@vitejs/plugin-vue` 是 vite 插件无法挂入 tsup 管线，故 SFC 编译选型为 vite lib mode，产物 exports 形态与 `@nest-acticle/markdown` 对齐（双格式 js + 单一 types 入口 + style.css），两端零消费侧配置。
