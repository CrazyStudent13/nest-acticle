<!-- Markdown 渲染壳：HTML 由 @nest-acticle/markdown 共享包产出（与 admin 预览两端同构），壳只负责 ClipboardJS 绑定与复制成功反馈（成功后 1.5s 显示"已复制"）、mermaid 懒加载渲染与图片点击放大；入参兼容引号包裹内容与字面 \n 由包的 render 处理 -->
<template>
  <div ref="containerRef" class="markdown-body">
    <div v-html="resultStr"></div>
  </div>
</template>

<script setup lang="ts">
import ClipboardJS from 'clipboard'
import { bindImageLightbox, createMarkdownRenderer, renderMermaidDiagrams } from '@nest-acticle/markdown'
import '@nest-acticle/markdown/style.css'

const props = withDefaults(
  defineProps<{
    value?: string
  }>(),
  {
    value: ''
  }
)

const renderer = createMarkdownRenderer()

const containerRef = ref<HTMLElement | null>(null)

// mermaid 懒加载渲染：仅在渲染产物含 .mermaid 容器时触发（动态 import，无图表的文章零加载成本）
const tryRenderMermaid = () => {
  if (import.meta.server) {
    return
  }
  nextTick(async () => {
    const host = containerRef.value
    if (!host || !host.querySelector('.mermaid')) {
      return
    }
    try {
      await renderMermaidDiagrams(host)
    } catch (error) {
      console.warn('mermaid 渲染失败:', error)
    }
  })
}

let clipboard: ClipboardJS | null = null
let unbindLightbox: (() => void) | null = null

onMounted(() => {
  tryRenderMermaid()
  // 图片点击放大（事件委托，v-html 重渲染无需重绑）
  if (containerRef.value) {
    unbindLightbox = bindImageLightbox(containerRef.value)
  }
  clipboard = new ClipboardJS('.copy-btn')
  clipboard.on('success', (event) => {
    event.clearSelection()
    const trigger = event.trigger as HTMLElement | undefined
    if (trigger) {
      trigger.textContent = '已复制'
      trigger.classList.add('copied')
      setTimeout(() => {
        trigger.textContent = '复制'
        trigger.classList.remove('copied')
      }, 1500)
    }
  })
  clipboard.on('error', (event) => {
    console.error('Action:', event.action)
    console.error('Trigger:', event.trigger)
  })
})

onBeforeUnmount(() => {
  unbindLightbox?.()
  unbindLightbox = null
  clipboard?.destroy()
  clipboard = null
})

watch(() => props.value, tryRenderMermaid)

const resultStr = computed(() => {
  if (!props.value) {
    return ''
  }

  return renderer.render(props.value)
})
</script>
