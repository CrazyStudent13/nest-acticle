<!-- 发布前预览遮罩（写作页）：按文章详情页版式拼装当前内容（标题/作者/定格时间/专栏/封面/正文），
     正文复用 MdViewer——与文章详情页同一渲染栈（复制按钮/图片放大/mermaid 全部一致），所见即发布所得。
     右栏与详情页同构（作者卡+目录，相关推荐依赖已发布文章不预呈现）；ESC 或关闭按钮退出，
     预览期间锁正文滚动，遮罩 z-index 低于 lightbox 使预览内图片仍可放大。 -->
<template>
  <Teleport to="body">
    <div v-if="open" class="preview-overlay">
      <div class="preview-topbar">
        <span class="preview-flag">预览 · 发布后的效果</span>
        <button class="preview-close" type="button" @click="close">关闭预览</button>
      </div>
      <div class="preview-scroll">
        <div class="preview-layout">
          <article class="preview-panel">
            <h1 class="preview-title">{{ title.trim() || '无标题' }}</h1>
            <div class="preview-meta">
              <span class="meta-author">{{ authorName }}</span>
              <span class="meta-item">发布于 {{ previewTime }}</span>
              <span v-if="subjectTitle" class="meta-item">{{ subjectTitle }}</span>
            </div>
            <img v-if="coverUrl" class="preview-cover" :src="coverUrl" :alt="title.trim() || '封面'" />
            <div class="preview-body">
              <MdViewer :value="content" />
            </div>
          </article>
          <aside class="preview-aside">
            <Suspense>
              <ArticleAuthorCard :author="author" />
            </Suspense>
            <ArticleToc
              v-if="hasToc"
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
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { isImageLightboxOpen } from '@nest-acticle/markdown'
// 预览区的 markdown-body 样式与文章详情页同源（组件包不重复打包渲染样式，由宿主引入）
import '@nest-acticle/markdown/style.css'

interface AuthorInfo {
  userId?: number
  nickName?: string
  avatar?: string
}

const props = withDefaults(
  defineProps<{
    /** 遮罩显隐（支持 v-model:open） */
    open?: boolean
    title?: string
    content?: string
    /** 封面绝对地址（宿主经 toCoverUrl 补全后传入） */
    coverUrl?: string
    /** 专栏名（发布表单已选专栏时展示） */
    subjectTitle?: string
    /** 作者卡入参（组件内自取 guest 列表聚合统计） */
    author?: AuthorInfo
  }>(),
  {
    open: false,
    title: '',
    content: '',
    coverUrl: '',
    subjectTitle: '',
    author: () => ({})
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const close = () => emit('update:open', false)

const authorName = computed(() => props.author.nickName || '佚名')

// 时间按打开时刻定格，模拟发布后的展示
const previewTime = ref('')
watch(
  () => props.open,
  (open) => {
    if (open) {
      previewTime.value = dayjs().format('YYYY-MM-DD HH:mm')
    }
  },
  { immediate: true }
)

// 与详情页同口径：文章带标题大纲才展示目录
const hasToc = computed(() => extractMarkdownHeadings(props.content).length > 0)

// 预览期间锁正文滚动（遮罩自带滚动容器），卸载兜底还原（预览开着直接路由跳走的情况）
watch(
  () => props.open,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  }
)

// ESC 关闭预览（document 级监听与原页面实现同口径，仅 open 时生效）；
// lightbox 开着时让位：一次 ESC 只关 lightbox，再按一次才关预览（否则层叠弹窗被一次全退）
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open && !isImageLightboxOpen()) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<style lang="less" scoped>
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
  // 顶部留白用 layout 的 margin 而非容器的 padding：Chrome 的 sticky 约束线从滚动容器内容边起算，
  // padding-top + sticky top 会叠加把右栏在初始状态推低（右栏与正文卡片顶部错位）
  padding: 0 16px 48px;
}

// 两栏布局对齐详情页：正文卡片 + 右侧目录（窄屏隐藏目录）
.preview-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
  margin-top: 32px;
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
</style>
