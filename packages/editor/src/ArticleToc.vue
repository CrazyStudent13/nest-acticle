<!-- 文章目录卡片（共享）：提取 Markdown 标题大纲生成目录，支持点击滚动定位、滚动跟随高亮、收起/展开。
     容器/滚动根经 props 参数化：详情页用默认值；预览遮罩传遮罩内的选择器（滚动发生在遮罩自身的
     滚动容器上而非 window）。样式走宿主 CSS 变量并带回退值，client 详情页与两端预览共用。 -->
<template>
  <nav class="na-toc-card">
    <div class="na-toc-head">
      <span class="na-toc-title">目录</span>
      <button class="na-toc-toggle" type="button" @click="collapsed = !collapsed">
        {{ collapsed ? '展开' : '收起' }}
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ flip: collapsed }"
          aria-hidden="true"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </div>

    <div v-show="!collapsed" class="na-toc-list-wrap">
      <button
        v-for="(item, index) in items"
        :key="index"
        class="na-toc-item"
        :class="[`lvl-${item.level}`, { active: index === activeIndex }]"
        :style="{ paddingLeft: `${(item.level - 1) * 14 + 4}px` }"
        type="button"
        @click="scrollTo(index)"
      >
        {{ item.text }}
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { extractMarkdownHeadings } from '@nest-acticle/markdown';

// 先按 Markdown 源码渲染大纲，挂载后以渲染出的 DOM 标题为准做校正
// （引用/列表里的标题等边角情况 Markdown 提取可能漏掉，以实际 DOM 对齐才能保证点击/高亮不错位）
const props = withDefaults(
  defineProps<{
    content?: string;
    /** 标题 DOM 的容器选择器（默认文章详情页正文） */
    containerSelector?: string;
    /** 滚动根选择器：传入时滚动与高亮监听挂在该元素上（如预览遮罩），缺省挂 window */
    scrollRootSelector?: string;
    /** 点击定位时标题距滚动视口顶部的留白（详情页有站头 72，预览遮罩 24） */
    offsetTop?: number;
  }>(),
  {
    content: '',
    containerSelector: '.detail .panel-body',
    scrollRootSelector: '',
    offsetTop: 72
  }
);

const items = ref(extractMarkdownHeadings(props.content));
const collapsed = ref(false);
const activeIndex = ref(0);

let headingEls: HTMLElement[] = [];

const getScrollRoot = (): HTMLElement | null =>
  props.scrollRootSelector ? (document.querySelector(props.scrollRootSelector) as HTMLElement | null) : null;

const collect = () => {
  const body = document.querySelector(props.containerSelector);
  if (!body) {
    return;
  }
  const els = Array.from(body.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
  if (!els.length) {
    return;
  }
  headingEls = els;
  const domItems = els.map((el) => ({
    level: Number(el.tagName.slice(1)),
    text: (el.textContent || '').trim()
  }));
  const mdItems = extractMarkdownHeadings(props.content);
  const mismatch =
    domItems.length !== mdItems.length || domItems.some((d, i) => d.level !== mdItems[i]?.level || d.text !== mdItems[i]?.text);
  if (mismatch) {
    items.value = domItems;
  }
};

const scrollTo = (index: number) => {
  const el = headingEls[index];
  if (!el) {
    return;
  }
  activeIndex.value = index;
  const root = getScrollRoot();
  if (root) {
    // 滚动根为遮罩等容器：按容器相对坐标换算目标 scrollTop
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - props.offsetTop;
    root.scrollTo({ top, behavior: 'smooth' });
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY - props.offsetTop;
    window.scrollTo({ top, behavior: 'smooth' });
  }
};

// 滚动高亮：取视口顶部以上最近的标题；触底时强制点亮最后一项
// 直接在 scroll 回调里算（十几处 getBoundingClientRect 开销可忽略），不依赖 rAF
const onScroll = () => {
  if (!headingEls.length) {
    return;
  }
  // 反向遍历取视口顶部以上最近的标题（ES2021 无 findLastIndex；显式判空兼容 noUncheckedIndexedAccess）
  let idx = -1;
  for (let i = headingEls.length - 1; i >= 0; i -= 1) {
    const el = headingEls[i];
    if (el && el.getBoundingClientRect().top <= 80) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    idx = 0;
  }
  const root = getScrollRoot();
  const atBottom = root
    ? root.scrollTop + root.clientHeight >= root.scrollHeight - 4
    : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  if (atBottom) {
    idx = headingEls.length - 1;
  }
  activeIndex.value = idx;
};

onMounted(() => {
  collect();
  const root = getScrollRoot();
  if (root) {
    root.addEventListener('scroll', onScroll, { passive: true });
  } else {
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  onScroll();
});

onBeforeUnmount(() => {
  const root = getScrollRoot();
  if (root) {
    root.removeEventListener('scroll', onScroll);
  } else {
    window.removeEventListener('scroll', onScroll);
  }
});

// 路由复用同一组件实例（query 变化不重建），内容变了要重新采集
watch(
  () => props.content,
  async () => {
    activeIndex.value = 0;
    await nextTick();
    collect();
    onScroll();
  }
);
</script>

<style lang="less" scoped>
.na-toc-card {
  padding: 14px 16px;
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border-light, #f0f1f3);
  border-radius: var(--radius-md, 12px);
}

.na-toc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  .na-toc-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-1, #1f2329);
  }

  .na-toc-toggle {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 4px;
    border: 0;
    background-color: transparent;
    font-size: 12px;
    color: var(--color-text-3, #86909c);
    cursor: pointer;
    transition: color 0.15s ease;

    &:hover {
      color: var(--color-primary, #4f6bff);
    }

    svg {
      transition: transform 0.2s ease;

      &.flip {
        transform: rotate(180deg);
      }
    }
  }
}

.na-toc-list-wrap {
  max-height: calc(100vh - 150px);
  overflow-y: auto;
}

.na-toc-item {
  display: block;
  width: 100%;
  padding: 5px 4px;
  border: 0;
  border-radius: var(--radius-sm, 4px);
  background-color: transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-2, #4e5969);
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: var(--color-text-1, #1f2329);
  }

  &.active {
    color: var(--color-primary, #4f6bff);
    font-weight: 600;
  }

  &.lvl-1 {
    font-weight: 600;
  }
}
</style>