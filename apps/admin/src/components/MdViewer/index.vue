<!-- Markdown 预览壳：渲染器与 client 文章页共用 @nest-acticle/markdown（预览即前台呈现），壳只负责 ClipboardJS 绑定与复制成功反馈；MdEditor 编辑组件仍为 md-editor-v3，与本组件无关 -->
<template>
  <div class="markdown-viewer">
    <div class="markdown-body">
      <div v-html="resultStr"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createMarkdownRenderer } from '@nest-acticle/markdown';
import '@nest-acticle/markdown/style.css';
import ClipboardJS from 'clipboard';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const renderer = createMarkdownRenderer();

let clipboard: ClipboardJS | null = null;

onMounted(() => {
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
