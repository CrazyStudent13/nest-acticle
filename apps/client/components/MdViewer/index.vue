<!-- Markdown 渲染壳：HTML 由 @nest-acticle/markdown 共享包产出（与 admin 预览两端同构），壳只负责 ClipboardJS 绑定与复制成功反馈（成功后 1.5s 显示"已复制"）；入参兼容引号包裹内容与字面 \n 由包的 render 处理 -->
<template>
  <div class="markdown-body">
    <div v-html="resultStr"></div>
  </div>
</template>

<script setup lang="ts">
import ClipboardJS from 'clipboard'
import { createMarkdownRenderer } from '@nest-acticle/markdown'
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

let clipboard: ClipboardJS | null = null

onMounted(() => {
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
  clipboard?.destroy()
  clipboard = null
})

const resultStr = computed(() => {
  if (!props.value) {
    return ''
  }

  return renderer.render(props.value)
})
</script>
