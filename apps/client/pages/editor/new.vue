<!-- 写文章页（独立全屏流程）：Markdown 左写右预览+工具栏/快捷键/上传粘贴图片（先裁剪再上传）；草稿箱 localStorage 自动保存（800ms 防抖、按 userId 隔离，编辑已有文章不写草稿）；发布弹窗：封面 16:9 裁剪/选专栏/简介自动取正文前 100 字；带 ?id= 为编辑模式（按钮变"保存"），未登录原地弹登录框。
     职责拆分：工具栏操作/字数统计 → useMarkdownEditor；草稿箱 → useDraftBox + EditorDraftPanel；发布弹窗 → usePublish + EditorPublishModal；本页保留主流程编排（初始化/编辑模式加载/图片插入）。 -->
<template>
  <div class="editor-page">
    <!-- 顶栏：返回站点 + 标题 + 草稿箱 + 发布 -->
    <header class="editor-topbar">
      <NuxtLink to="/" class="editor-brand" title="返回首页">
        <span class="brand-logo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
          </svg>
        </span>
        <span class="brand-name">游戏速递</span>
      </NuxtLink>

      <input
        v-model="title"
        class="title-input"
        type="text"
        maxlength="64"
        placeholder="输入文章标题..."
        @input="topTip = ''"
      />

      <span class="save-hint">{{ draft.saveHint }}</span>

      <EditorDraftPanel
        v-if="!editId"
        v-model:open="draft.open"
        :drafts="draft.myDrafts"
        :current-id="draft.currentDraftId"
        @load="draft.loadDraft"
        @remove="draft.removeDraft"
      />

      <button class="publish-btn" type="button" @click="publish.openPublish">{{ editId ? '保存' : '发布' }}</button>
    </header>
    <p v-if="topTip" class="top-tip">{{ topTip }}</p>

    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <button class="tool-btn tool-text" type="button" title="标题" @click="cycleHeading">H</button>
      <button class="tool-btn tool-text" type="button" title="加粗 (Ctrl+B)" @click="wrapInline('**', '**', '加粗文本')"><b>B</b></button>
      <button class="tool-btn tool-text" type="button" title="斜体 (Ctrl+I)" @click="wrapInline('*', '*', '斜体文本')"><i>I</i></button>

      <span class="tool-divider" />

      <button class="tool-btn tool-text" type="button" title="引用" @click="toggleLinePrefix('> ')">”</button>
      <button class="tool-btn" type="button" title="链接" @click="insertLink">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
      <button class="tool-btn" type="button" title="上传图片" :disabled="imgUploading" @click="imgInput?.click()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </button>
      <input ref="imgInput" class="img-input" type="file" accept="image/*" @change="handleImgChange" />

      <span class="tool-divider" />

      <button class="tool-btn tool-text tool-code" type="button" title="行内代码" @click="wrapInline('`', '`', '代码')"><span>&lt;/&gt;</span></button>
      <button class="tool-btn" type="button" title="代码块" @click="insertCodeBlock">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>

      <span class="tool-divider" />

      <button class="tool-btn" type="button" title="无序列表" @click="toggleLinePrefix('- ')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="9" y1="6" x2="21" y2="6" />
          <line x1="9" y1="12" x2="21" y2="12" />
          <line x1="9" y1="18" x2="21" y2="18" />
          <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button class="tool-btn tool-text" type="button" title="有序列表" @click="toggleOrderedList">1.</button>
      <button class="tool-btn" type="button" title="表格" @click="insertTable">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </button>
      <button class="tool-btn tool-text" type="button" title="分割线" @click="insertHr">—</button>
    </div>

    <!-- 左写右预览 -->
    <div class="editor-body">
      <textarea
        ref="taRef"
        v-model="content"
        class="editor-input"
        placeholder="输入文章内容，支持 Markdown 语法，可直接粘贴图片…"
        @keydown="handleShortcut"
        @paste="handlePaste"
      />
      <div class="editor-preview">
        <MdViewer :value="content" />
      </div>
    </div>

    <!-- 底部状态栏 -->
    <footer class="editor-status">
      <span>字数 {{ charCount }}</span>
      <span>行数 {{ lineCount }}</span>
      <span v-if="!editId" class="status-hint">文章将自动保存至草稿箱</span>
    </footer>

    <!-- 发布弹窗（显隐 v-model，状态/动作来自 usePublish store） -->
    <EditorPublishModal v-model="publish.open" :publish="publish" :edit-id="editId" />
  </div>
</template>

<script setup lang="ts">
import type { Article } from '@nest-acticle/shared'

// 写文章是独立全屏流程：ssr 关闭（依赖 token），使用 editor 布局（无站头站脚）
// 登录守卫走 auth middleware：未登录原地弹登录框不跳页（authNoToken: 'stay'，掘金式），恢复失败回首页
definePageMeta({
  layout: 'editor',
  middleware: 'auth',
  authNoToken: 'stay'
})

const config = useRuntimeConfig()
const route = useRoute()
const { user } = useUser()

// 编辑模式：带 ?id= 时载入已有文章，发布改为保存修改（后端 PUT /api/post/article 只允许改自己的文章）
const editId = ref('')

// ---------- 编辑内容 ----------
const title = ref('')
const content = ref('')
const taRef = ref<HTMLTextAreaElement | null>(null)
const topTip = ref('')

let topTipTimer: ReturnType<typeof setTimeout> | null = null
const setTopTip = (message: string) => {
  topTip.value = message
  if (topTipTimer) {
    clearTimeout(topTipTimer)
  }
  topTipTimer = setTimeout(() => (topTip.value = ''), 3000)
}

// ---------- Markdown 编辑器：工具栏动作/Ctrl+B·I 快捷键/字数统计 ----------
const {
  charCount,
  lineCount,
  replaceRange,
  cycleHeading,
  wrapInline,
  toggleLinePrefix,
  toggleOrderedList,
  insertLink,
  insertCodeBlock,
  insertTable,
  insertHr,
  handleShortcut
} = useMarkdownEditor(content, taRef)

// ---------- 图片插入（工具栏按钮 + 粘贴）：跨裁剪弹窗/上传/文件地址补全三域，留在页面编排 ----------
const imgInput = ref<HTMLInputElement | null>(null)
const imgUploading = ref(false)

const { uploadImage } = useUpload()

const insertImage = (file: File) => {
  const el = taRef.value
  if (!el) {
    return Promise.resolve()
  }
  if (!/^image\//.test(file.type)) {
    setTopTip('请选择图片文件')
    return Promise.resolve()
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过 5MB', 'error')
    return Promise.resolve()
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  imgUploading.value = true
  // 先弹裁剪框（自由比例），取消则静默放弃插入
  return cropImage(file, { title: '裁剪图片' })
    .then((cropped) => uploadImage(cropped, 'article/content'))
    .then((url) => {
      if (!url) {
        setTopTip('图片上传失败')
        return
      }
      // 用绝对地址插入，保证编辑器预览与文章详情页都能直接显示
      const abs = toCoverUrl(config.public.apiBase, url)
      replaceRange(start, end, `![${file.name}](${abs})`)
    })
    .catch((error: any) => {
      if (error?.message !== 'cancel') {
        setTopTip(error?.message || '图片上传失败')
      }
    })
    .finally(() => {
      imgUploading.value = false
      if (imgInput.value) {
        imgInput.value.value = ''
      }
    })
}

const handleImgChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    insertImage(file)
  }
}

// 粘贴截图直接上传
const handlePaste = (event: ClipboardEvent) => {
  const file = Array.from(event.clipboardData?.files || []).find((f) => /^image\//.test(f.type))
  if (file) {
    event.preventDefault()
    insertImage(file)
  }
}

// ---------- 草稿箱（localStorage 自动保存） ----------
const draft = useDraftBox({ title, content, editId })

// ---------- 发布弹窗（校验/专栏/封面/提交） ----------
const publish = usePublish({ title, content, editId, setTopTip, clearCurrentDraft: draft.clearCurrentDraft })

// ---------- 初始化：登录守卫已由 auth middleware 先行（未登录会原地弹登录框、token 失效已回首页） ----------
const initEditor = () => {
  if (route.query.id) {
    editId.value = String(route.query.id)
    loadArticle(editId.value)
  } else {
    draft.loadDrafts()
    // 头部创作者中心「草稿箱」入口直达：带 ?drafts=1 时载入后自动展开面板
    if (route.query.drafts) {
      draft.open = true
    }
  }
}

onMounted(() => {
  // 未登录时 middleware 已原地弹登录框，这里不初始化，等登录成功由下方 watch 续起
  if (user.value) {
    initEditor()
  }
})

// 弹窗登录成功 → user state 填充 → 触发初始化
watch(user, (val, old) => {
  if (val && !old) {
    initEditor()
  }
})

// 编辑模式预填：guest detail 只放行已发布文章，草稿走本地草稿箱
// （useArticleManage 只有列表/上下架/删除接口，无单篇详情，语义不吻合故保留 apiFetch<Article> 直调）
const loadArticle = async (id: string) => {
  try {
    const res = await apiFetch<Article>('/api/post/article/guest/detail', {
      query: { id }
    })
    const model = res.data
    if (!model) {
      throw new Error(res.msg || '文章不存在或已下架')
    }
    title.value = model.title || ''
    content.value = model.content || ''
    publish.publishForm.subjectId = model.subjectId ? String(model.subjectId) : ''
    publish.publishForm.cover = model.cover || ''
    publish.publishForm.desc = model.desc || ''
  } catch (error: any) {
    setTopTip(error?.message || '文章加载失败')
    return navigateTo('/')
  }
}
</script>

<style lang="less" scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
}

// ---------- 顶栏 ----------
.editor-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 60px;
  padding: 0 20px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);

  .editor-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .brand-logo {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      background-image: var(--gradient-brand);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-1);
      white-space: nowrap;
    }
  }

  .title-input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background-color: transparent;
    font-size: 22px;
    font-weight: 600;
    color: var(--color-text-1);

    &::placeholder {
      color: var(--color-text-3);
    }
  }

  .save-hint {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-text-3);
    white-space: nowrap;
  }

  .publish-btn {
    flex-shrink: 0;
    padding: 6px 20px;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    font-size: 13px;
    color: #fff;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }
}

.top-tip {
  padding: 6px 20px;
  font-size: 12px;
  color: #d1242f;
  background-color: var(--color-surface);
}

// ---------- 工具栏 ----------
.editor-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 44px;
  padding: 0 12px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  overflow-x: auto;

  .tool-btn {
    flex-shrink: 0;
    width: 34px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    &:hover:not(:disabled) {
      background-color: var(--color-bg);
      color: var(--color-text-1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.tool-text {
      font-size: 14px;
      font-weight: 600;
      font-family: Georgia, serif;

      i {
        font-weight: 400;
      }
    }

    &.tool-code {
      font-size: 11px;
      font-family: Consolas, Monaco, monospace;
      font-weight: 400;
    }
  }

  .tool-divider {
    flex-shrink: 0;
    width: 1px;
    height: 16px;
    margin: 0 6px;
    background-color: var(--color-border-light);
  }
}

// 隐藏原生文件选择框（发布弹窗封面上传的 .img-input 在 PublishModal scoped 内单独声明）
.img-input {
  display: none;
}

// ---------- 编辑区 ----------
.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;

  .editor-input {
    flex: 1;
    min-width: 0;
    padding: 24px 32px;
    border: 0;
    outline: none;
    resize: none;
    background-color: var(--color-surface);
    font-size: 15px;
    line-height: 1.9;
    font-family: inherit;
    color: var(--color-text-1);
    caret-color: var(--color-primary);

    &::placeholder {
      color: var(--color-text-3);
    }
  }

  .editor-preview {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 24px 40px;
    background-color: var(--color-surface);
    border-left: 1px solid var(--color-border-light);
  }
}

// ---------- 状态栏 ----------
.editor-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 28px;
  padding: 0 20px;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  font-size: 12px;
  color: var(--color-text-3);

  .status-hint {
    margin-left: auto;
  }
}

@media (max-width: 900px) {
  .editor-body .editor-preview {
    display: none;
  }
}

@media (max-width: 640px) {
  .editor-topbar .title-input {
    font-size: 17px;
  }

  .editor-topbar .save-hint {
    display: none;
  }
}
</style>
