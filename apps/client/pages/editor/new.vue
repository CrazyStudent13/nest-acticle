<!-- 写文章页（独立全屏流程）：编辑区为 @nest-acticle/editor 共享 MarkdownEditor（工具栏/快捷键/预览/粘贴上传在包内，与 admin 编辑体验同源）；上传经回调走"先裁剪再上传"，插入时机由组件在回调前捕获的选区决定；草稿箱 localStorage 自动保存（800ms 防抖、按 userId 隔离，编辑已有文章不写草稿）；发布弹窗：封面 16:9 裁剪/选专栏/简介自动取正文前 100 字；带 ?id= 为编辑模式（按钮变"保存"），未登录原地弹登录框。
     职责拆分：工具栏操作/字数统计/预览 → @nest-acticle/editor；草稿箱 → useDraftBox + EditorDraftPanel；发布弹窗 → usePublish + EditorPublishModal；本页保留主流程编排（初始化/编辑模式加载/图片上传回调）。 -->
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

    <!-- 编辑区（共享 MarkdownEditor：左写右预览 + 状态栏字数/行数；草稿提示经 status-extra 插槽并入同一条状态栏） -->
    <div class="editor-surface">
      <MarkdownEditor
        v-model="content"
        :upload-image="handleUploadImage"
        placeholder="输入文章内容，支持 Markdown 语法，可直接粘贴图片…"
      >
        <template v-if="!editId" #status-extra>
          <span class="status-hint">文章将自动保存至草稿箱</span>
        </template>
      </MarkdownEditor>
    </div>

    <!-- 发布弹窗（显隐 v-model，状态/动作来自 usePublish store） -->
    <EditorPublishModal v-model="publish.open" :publish="publish" :edit-id="editId" />
  </div>
</template>

<script setup lang="ts">
import type { Article } from '@nest-acticle/shared'
import { MarkdownEditor } from '@nest-acticle/editor'
import '@nest-acticle/editor/style.css'
// 预览区的 markdown-body 样式与文章详情页同源（组件包不重复打包渲染样式，由宿主引入）
import '@nest-acticle/markdown/style.css'

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
const topTip = ref('')

let topTipTimer: ReturnType<typeof setTimeout> | null = null
const setTopTip = (message: string) => {
  topTip.value = message
  if (topTipTimer) {
    clearTimeout(topTipTimer)
  }
  topTipTimer = setTimeout(() => (topTip.value = ''), 3000)
}

// ---------- 图片上传回调（工具栏按钮 + 粘贴共用）：跨裁剪弹窗/上传/文件地址补全三域，留在页面编排 ----------
const { uploadImage } = useUpload()

// 先校验类型/大小，再弹裁剪框（自由比例，取消则静默放弃），成功返回 markdown 可用的绝对地址；
// 失败/取消以 reject 收场，共享组件据此保证不插入残缺内容
const handleUploadImage = (file: File): Promise<string> => {
  if (!/^image\//.test(file.type)) {
    setTopTip('请选择图片文件')
    return Promise.reject(new Error('invalid-image'))
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过 5MB', 'error')
    return Promise.reject(new Error('oversize-image'))
  }
  return cropImage(file, { title: '裁剪图片' })
    .then((cropped) => uploadImage(cropped, 'article/content'))
    .then((url) => {
      if (!url) {
        setTopTip('图片上传失败')
        return Promise.reject(new Error('upload-empty'))
      }
      // 用绝对地址返回，保证编辑器预览与文章详情页都能直接显示
      return toCoverUrl(config.public.apiBase, url)
    })
    .catch((error: any) => {
      if (error?.message !== 'cancel') {
        setTopTip(error?.message || '图片上传失败')
      }
      return Promise.reject(error)
    })
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
  // Ctrl/Cmd+S 手动存草稿：仅新建模式生效（编辑模式不写本地草稿，与自动保存同一语义）
  document.addEventListener('keydown', handleSaveShortcut)
})

const handleSaveShortcut = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    draft.saveCurrentDraft()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleSaveShortcut)
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

// ---------- 编辑区容器（共享编辑器内部自带工具栏/预览/状态栏样式） ----------
.editor-surface {
  flex: 1;
  min-height: 0;
}

// 草稿提示并入共享编辑器状态栏（插槽内容在页面作用域，可被页面样式覆盖对齐）
.status-hint {
  margin-left: auto;
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
