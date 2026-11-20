<!-- Markdown 预览壳：渲染器与 client 文章页共用 @nest-acticle/markdown（预览即前台呈现），壳只负责 ClipboardJS 绑定与复制成功反馈与 mermaid 懒加载渲染；编辑组件统一走 @nest-acticle/editor，与本组件无关 -->
<template>
  <div class="markdown-viewer">
    <div ref="containerRef" class="markdown-body">
      <div v-html="resultStr"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createMarkdownRenderer, renderMermaidDiagrams } from '@nest-acticle/markdown';
import '@nest-acticle/markdown/style.css';
import ClipboardJS from 'clipboard';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const renderer = createMarkdownRenderer();

const containerRef = ref<HTMLElement | null>(null);

// mermaid 懒加载渲染：仅在渲染产物含 .mermaid 容器时触发（动态 import，无图表的内容零加载成本）
const tryRenderMermaid = () => {
  if (typeof window === 'undefined') {
    return;
  }
  nextTick(async () => {
    const host = containerRef.value;
    if (!host || !host.querySelector('.mermaid')) {
      return;
    }
    try {
      await renderMermaidDiagrams(host);
    } catch (error) {
      console.warn('mermaid 渲染失败:', error);
    }
  });
};

let clipboard: ClipboardJS | null = null;

onMounted(() => {
  tryRenderMermaid();
  clipboard = new ClipboardJS('.copy-btn');
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
});

watch(() => props.modelValue, tryRenderMermaid);

onBeforeUnmount(() => {
  clipboard?.destroy();
  clipboard = null;
});

const resultStr = computed(() => {
  if (!props.modelValue) {
    return '';
  }

  return renderer.render(props.modelValue);
});
</script>

<style lang="scss" scoped>
.markdown-viewer {
  width: 100%;
  min-height: 200px;
  padding: 16px;
  box-sizing: border-box;
  overflow-x: auto;
}
</style>
