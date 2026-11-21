<!-- 写文章页（独立全屏流程）：编辑区为 @nest-acticle/editor 共享 MarkdownEditor（工具栏/快捷键/预览/粘贴上传在包内，与 admin 编辑体验同源）；上传经回调走"先裁剪再上传"，插入时机由组件在回调前捕获的选区决定；草稿箱 localStorage 自动保存（800ms 防抖、按 userId 隔离：新建写草稿箱草稿，编辑线上文章按 articleId 写本地快照并在载入时提示恢复）；发布弹窗：封面 16:9 裁剪/选专栏/简介自动取正文前 100 字；带 ?id= 为编辑模式（按钮变"保存"），未登录原地弹登录框。
     职责拆分：工具栏操作/字数统计/预览 → @nest-acticle/editor；草稿箱 → useDraftBox + EditorDraftPanel；发布弹窗 → usePublish + EditorPublishModal；本页保留主流程编排（初始化/编辑模式加载与快照恢复/图片上传回调）。 -->
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

      <button
        class="preview-btn"
        type="button"
        :disabled="!title.trim() && !content.trim()"
        @click="openPreview"
      >
        预览
      </button>
      <button class="publish-btn" type="button" @click="publish.openPublish">{{ editId ? '保存' : '发布' }}</button>
    </header>
    <p v-if="topTip" class="top-tip">{{ topTip }}</p>

    <!-- 编辑模式：检测到该文章的本地未保存快照时提示恢复/丢弃（新建模式无此语义；开始编辑后自动收起） -->
    <div v-if="restorePending && editDraftItem" class="restore-banner">
      <span class="restore-text">检测到本地未保存的修改（{{ formatDraftTime(editDraftItem.updateTime) }}）</span>
      <button class="restore-btn primary" type="button" @click="restoreEditDraft">恢复修改</button>
      <button class="restore-btn" type="button" @click="discardEditDraft">丢弃</button>
    </div>

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

    <!-- 发布前预览：按详情页版式拼装当前内容（标题/元信息/封面/正文），正文复用 MdViewer——
         与文章详情页同一渲染栈（复制按钮/图片放大/mermaid 全部一致），所见即发布所得 -->
    <Teleport to="body">
      <div v-if="previewOpen" class="preview-overlay">
        <div class="preview-topbar">
          <span class="preview-flag">预览 · 发布后的效果</span>
          <button class="preview-close" type="button" @click="previewOpen = false">关闭预览</button>
        </div>
        <div class="preview-scroll">
          <div class="preview-layout">
            <article class="preview-panel">
              <h1 class="preview-title">{{ title.trim() || '无标题' }}</h1>
              <div class="preview-meta">
                <span class="meta-author">{{ authorName }}</span>
                <span class="meta-item">发布于 {{ previewTime }}</span>
                <span v-if="previewSubjectTitle" class="meta-item">{{ previewSubjectTitle }}</span>
              </div>
              <img v-if="previewCoverUrl" class="preview-cover" :src="previewCoverUrl" :alt="title.trim() || '封面'" />
              <div class="preview-body">
                <MdViewer :value="content" />
              </div>
            </article>
            <!-- 发布后的详情页右栏为作者卡+目录+相关推荐：预览呈现作者卡与目录（相关推荐依赖已发布文章，不预呈现） -->
            <aside class="preview-aside">
              <Suspense>
                <ArticleAuthorCard :author="previewAuthor" />
              </Suspense>
              <ArticleToc
                v-if="previewHasToc"
                :content="content"
                container-selector=".preview-overlay .preview-body"
                scroll-root-selector=".preview-overlay .preview-scroll"
                :offset-top="24"
              />
            </aside>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Article } from '@nest-acticle/shared'
import dayjs from 'dayjs'
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

// 编辑模式恢复横幅：载入线上文章后若存在该文章的本地快照则提示恢复/丢弃；
// 用户一旦开始修改内容（偏离载入时的指纹）自动收起，不干扰正常编辑
const editDraftItem = computed(() => draft.currentEditDraft)
const restorePending = ref(false)
const restoreFingerprint = ref('')

const formatDraftTime = (time: number) => dayjs(time).format('MM-DD HH:mm')

const restoreEditDraft = () => {
  const item = draft.currentEditDraft
  if (!item) {
    return
  }
  title.value = item.title
  content.value = item.content
  draft.markSavedBaseline()
  restorePending.value = false
  setTopTip('已恢复本地未保存的修改')
}

const discardEditDraft = () => {
  const item = draft.currentEditDraft
  if (item) {
    draft.removeDraft(item)
  }
  draft.markSavedBaseline()
  restorePending.value = false
  setTopTip('已丢弃本地修改快照')
}

// 用户开始编辑后收起恢复横幅（载入赋值与指纹一致不触发；快照由自动保存持续更新，无需提示）
watch([title, content], () => {
  if (restorePending.value && `${title.value}\u0000${content.value}` !== restoreFingerprint.value) {
    restorePending.value = false
  }
})

// ---------- 发布弹窗（校验/专栏/封面/提交） ----------
const publish = usePublish({ title, content, editId, setTopTip, clearCurrentDraft: draft.clearCurrentDraft })

// ---------- 发布前预览：按详情页版式拼装当前内容，正文走 MdViewer（与详情页同一渲染栈） ----------
const previewOpen = ref(false)
const previewTime = ref('')
const previewCoverUrl = computed(() => toCoverUrl(config.public.apiBase, publish.publishForm.cover || ''))
const previewSubjectTitle = computed(
  () => publish.subjects.find((s) => String(s.id) === publish.publishForm.subjectId)?.title || ''
)
const authorName = computed(() => user.value?.nickName || user.value?.userName || '佚名')
// 作者卡片入参（组件内自取 guest 列表聚合 文章/阅读/获赞 统计）；Suspense 包裹消化其异步 setup
const previewAuthor = computed(() => ({
  userId: user.value?.userId,
  nickName: user.value?.nickName || user.value?.userName || '佚名',
  avatar: user.value?.avatar || ''
}))
// 与详情页同口径：文章带标题大纲才展示目录
const previewHasToc = computed(() => extractMarkdownHeadings(content.value).length > 0)

const openPreview = () => {
  // 时间按打开时刻定格，模拟发布后的展示
  previewTime.value = dayjs().format('YYYY-MM-DD HH:mm')
  previewOpen.value = true
}

// 预览期间锁正文滚动（遮罩自带滚动容器）
watch(previewOpen, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

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
  // 页面级快捷键：Ctrl/Cmd+S 手动存草稿（仅新建模式生效）；ESC 关闭发布前预览
  document.addEventListener('keydown', handlePageKeydown)
})

const handlePageKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    draft.saveCurrentDraft()
    return
  }
  if (event.key === 'Escape' && previewOpen.value) {
    previewOpen.value = false
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handlePageKeydown)
  // 兜底还原滚动锁（预览开着时直接路由跳走的情况）
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
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
    // 载入完成记录基线（防载入动作本身产生等值快照），有本地快照则亮出恢复横幅
    draft.markSavedBaseline()
    restoreFingerprint.value = `${title.value}\u0000${content.value}`
    restorePending.value = !!draft.currentEditDraft
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

  .preview-btn {
    flex-shrink: 0;
    padding: 6px 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: transparent;
    font-size: 13px;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease;

    &:hover:not(:disabled) {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.top-tip {
  padding: 6px 20px;
  font-size: 12px;
  color: #d1242f;
  background-color: var(--color-surface);
}

// 编辑模式本地快照恢复横幅
.restore-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  font-size: 12px;
  color: var(--color-text-2);

  .restore-text {
    flex: 1;
    min-width: 0;
  }

  .restore-btn {
    flex-shrink: 0;
    padding: 3px 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: transparent;
    font-size: 12px;
    color: var(--color-text-1);
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.8;
    }

    &.primary {
      background-color: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
    }
  }
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

// ---------- 发布前预览遮罩（版式对齐文章详情页；z-index 低于 lightbox，预览里的图片仍可放大） ----------
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 2800;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
}

.preview-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 20px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);

  .preview-flag {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-2);
  }

  .preview-close {
    padding: 5px 14px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: transparent;
    font-size: 13px;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }
  }
}

.preview-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 32px 16px 48px;
}

// 两栏布局对齐详情页：正文卡片 + 右侧目录（窄屏隐藏目录）
.preview-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
}

.preview-panel {
  flex: 1;
  min-width: 0;
  max-width: 820px;
  padding: 36px 44px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
}

.preview-aside {
  position: sticky;
  top: 24px;
  flex-shrink: 0;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1000px) {
  .preview-aside {
    display: none;
  }
}

.preview-title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-1);
  margin-bottom: 16px;
}

.preview-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding-bottom: 18px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 13px;
  color: var(--color-text-3);

  .meta-author {
    font-weight: 600;
    color: var(--color-text-1);
  }
}

.preview-cover {
  width: 100%;
  max-height: 440px;
  object-fit: cover;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .preview-panel {
    padding: 24px 20px;
  }

  .preview-title {
    font-size: 22px;
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
