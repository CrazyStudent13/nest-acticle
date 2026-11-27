<!-- 文章预览共享组件：按文章详情页版式拼装标题/作者/发布时间/专栏/封面/正文（B 站风格）。
     正文渲染走 @nest-acticle/markdown，与前台文章页同一渲染栈（复制按钮/图片放大/mermaid 一致）。
     右侧栏默认内置作者卡 + 目录（两端同一套组件与版式），aside 插槽可追加宿主自定义内容；
     样式全部走 CSS 变量并带回退值，client 深浅主题与 admin 浅色主题均可直接使用；ESC/锁滚动随组件走。 -->
<template>
  <Teleport to="body">
    <div v-if="open" class="na-article-preview" role="dialog" aria-modal="true" aria-label="文章预览">
      <div class="na-article-preview-topbar">
        <span class="na-article-preview-flag">预览 · 发布后的效果</span>
        <button class="na-article-preview-close" type="button" @click="close">关闭预览</button>
      </div>
      <div class="na-article-preview-scroll">
        <div class="na-article-preview-layout">
          <article class="na-article-preview-panel">
            <h1 class="na-article-preview-title">{{ title.trim() || '无标题' }}</h1>
            <div class="na-article-preview-meta">
              <span class="na-article-preview-author">{{ authorName || '佚名' }}</span>
              <span class="na-article-preview-meta-item">发布于 {{ displayTime }}</span>
              <span v-if="subjectTitle" class="na-article-preview-meta-item">{{ subjectTitle }}</span>
            </div>
            <img v-if="coverUrl" class="na-article-preview-cover" :src="coverUrl" :alt="title.trim() || '封面'" />
            <div ref="bodyRef" class="na-article-preview-body">
              <div class="markdown-body">
                <div v-html="html"></div>
              </div>
            </div>
          </article>
          <aside v-if="showAside" class="na-article-preview-aside">
            <PreviewAuthorCard
              v-if="showAuthorCard"
              :author-name="authorName"
              :avatar-url="authorAvatar"
              :href="authorHref"
              :stats="authorStats"
            />
            <ArticleToc
              v-if="hasToc"
              :content="content"
              container-selector=".na-article-preview-body"
              scroll-root-selector=".na-article-preview-scroll"
              :offset-top="24"
            />
            <slot name="aside" />
          </aside>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import ClipboardJS from 'clipboard';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue';

import {
  bindImageLightbox,
  createMarkdownRenderer,
  extractMarkdownHeadings,
  isImageLightboxOpen,
  renderMermaidDiagrams
} from '@nest-acticle/markdown';

import ArticleToc from './ArticleToc.vue';
import PreviewAuthorCard from './PreviewAuthorCard.vue';
import type { PreviewAuthorStats } from './types';

interface Props {
  /** 遮罩显隐（支持 v-model:open） */
  open?: boolean;
  title?: string;
  content?: string;
  /** 封面地址（相对/绝对由宿主补全，组件直接用于 img src） */
  coverUrl?: string;
  /** 作者昵称（右栏作者卡） */
  authorName?: string;
  /** 作者头像（相对/绝对由宿主补全） */
  authorAvatar?: string;
  /** 作者空间链接（client 传前台路由；admin 不传则作者区仅展示） */
  authorHref?: string;
  /** 作者统计（未传按 0 展示） */
  authorStats?: PreviewAuthorStats | null;
  /** 是否展示右栏作者卡，默认展示 */
  showAuthorCard?: boolean;
  /** 发布时间（如 "2026-11-27 10:30"）；缺省时按打开时刻定格，模拟发布后的展示 */
  publishTime?: string;
  /** 专栏名（有则显示在 meta 行） */
  subjectTitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  title: '',
  content: '',
  coverUrl: '',
  authorName: '',
  authorAvatar: '',
  authorHref: '',
  authorStats: null,
  showAuthorCard: true,
  publishTime: '',
  subjectTitle: ''
});

const slots = useSlots();

// 与详情页同口径：文章带标题大纲才展示目录
const hasToc = computed(() => extractMarkdownHeadings(props.content).length > 0);
const showAside = computed(() => props.showAuthorCard || hasToc.value || !!slots.aside);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const close = () => emit('update:open', false);

// ---------- 时间：有发布时间用发布者的，没有则打开时刻定格 ----------
const frozenTime = ref('');

const pad = (value: number) => String(value).padStart(2, '0');
const formatNow = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const displayTime = computed(() => props.publishTime || frozenTime.value);

// ---------- 正文渲染：与文章详情页同源（宿主需引入 @nest-acticle/markdown/style.css） ----------
const renderer = createMarkdownRenderer();
const html = computed(() => (props.content ? renderer.render(props.content) : ''));

const bodyRef = ref<HTMLElement | null>(null);

// ---------- 复制按钮 / 图片放大 / mermaid：绑定在预览正文根上，避免误伤遮罩后的编辑器 ----------
let clipboard: ClipboardJS | null = null;
let unbindLightbox: (() => void) | null = null;

const teardownBindings = () => {
  clipboard?.destroy();
  clipboard = null;
  unbindLightbox?.();
  unbindLightbox = null;
};

const renderMermaid = async () => {
  const body = bodyRef.value;
  if (!body || !body.querySelector('.mermaid')) {
    return;
  }
  try {
    await renderMermaidDiagrams(body);
  } catch (error) {
    console.warn('[ArticlePreview] mermaid 渲染失败:', error);
  }
};

const bindBody = async () => {
  await nextTick();
  const body = bodyRef.value;
  if (!body) {
    return;
  }
  unbindLightbox = bindImageLightbox(body);
  clipboard = new ClipboardJS('.copy-btn', { container: body });
  clipboard.on('success', (event) => {
    event.clearSelection();
    const trigger = event.trigger as HTMLElement | undefined;
    if (trigger) {
      trigger.textContent = '已复制';
      trigger.classList.add('copied');
      setTimeout(() => {
        trigger.textContent = '复制';
        trigger.classList.remove('copied');
      }, 1500);
    }
  });
  clipboard.on('error', (event) => {
    console.error('Action:', event.action);
    console.error('Trigger:', event.trigger);
  });
  await renderMermaid();
};

// ---------- 显隐副作用：定格时间、锁 body 滚动、绑定/解绑正文交互 ----------
// 只还原自己加上的锁，避免退出预览时误清掉其他弹窗（如 Element Dialog）的滚动锁
let scrollLocked = false;

const unlockScroll = () => {
  if (scrollLocked && typeof document !== 'undefined') {
    document.body.style.overflow = '';
    scrollLocked = false;
  }
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
        scrollLocked = true;
      }
      frozenTime.value = formatNow();
      void bindBody();
    } else {
      unlockScroll();
      teardownBindings();
    }
  },
  { immediate: true }
);

// 预览开着时内容理论上不变，兜底处理外部异步回填（如编辑模式详情加载完成）
watch(
  () => props.content,
  () => {
    if (props.open) {
      void nextTick().then(renderMermaid);
    }
  }
);

// ---------- ESC 关闭（lightbox 开着时让位：一次 ESC 只关一层） ----------
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open && !isImageLightboxOpen()) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  teardownBindings();
  unlockScroll();
});
</script>

<style lang="less" scoped>
// ---------- 文章预览遮罩：版式对齐详情页；颜色/圆角走宿主变量并带 client 浅色主题回退值 ----------
.na-article-preview {
  position: fixed;
  inset: 0;
  z-index: 2800; // 低于 markdown lightbox（3000），预览内图片仍可放大
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg, #f7f8fa);
}

.na-article-preview-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 20px;
  background-color: var(--color-surface, #ffffff);
  border-bottom: 1px solid var(--color-border-light, #f0f1f3);

  .na-article-preview-flag {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-2, #4e5969);
  }

  .na-article-preview-close {
    padding: 5px 14px;
    border: 1px solid var(--color-border-light, #f0f1f3);
    border-radius: var(--radius-sm, 4px);
    background-color: transparent;
    font-size: 13px;
    color: var(--color-text-2, #4e5969);
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      color: var(--color-primary, #4f6bff);
      border-color: var(--color-primary, #4f6bff);
    }
  }
}

.na-article-preview-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  // 顶部留白用 layout 的 margin 而非容器 padding：Chrome 的 sticky 约束线从滚动容器内容边起算，
  // padding-top + sticky top 会叠加把右栏在初始状态推低（右栏与正文卡片顶部错位）
  padding: 0 16px 48px;
}

// 两栏布局对齐详情页：正文卡片 + 右栏插槽（窄屏隐藏右栏）
.na-article-preview-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
  margin-top: 32px;
}

.na-article-preview-panel {
  flex: 1;
  min-width: 0;
  max-width: 820px;
  padding: 36px 44px;
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border-light, #f0f1f3);
  border-radius: var(--radius-md, 12px);
}

.na-article-preview-aside {
  position: sticky;
  top: 24px;
  flex-shrink: 0;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1000px) {
  .na-article-preview-aside {
    display: none;
  }
}

.na-article-preview-title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-1, #1f2329);
  margin-bottom: 16px;
}

.na-article-preview-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding-bottom: 18px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-border-light, #f0f1f3);
  font-size: 13px;
  color: var(--color-text-3, #86909c);

  .na-article-preview-author {
    font-weight: 600;
    color: var(--color-text-1, #1f2329);
  }
}

.na-article-preview-cover {
  width: 100%;
  max-height: 440px;
  object-fit: cover;
  border-radius: var(--radius-md, 12px);
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .na-article-preview-panel {
    padding: 24px 20px;
  }

  .na-article-preview-title {
    font-size: 22px;
  }
}
</style>