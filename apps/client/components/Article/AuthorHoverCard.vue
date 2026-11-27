<!-- 信息流作者名悬浮卡：悬浮昵称弹出作者卡（复用详情页 AuthorCard），点击卡片在新窗口打开作者空间 -->
<template>
  <span ref="triggerWrapRef" class="author-hover" @mouseenter="scheduleShow" @mouseleave="scheduleHide">
    <NuxtLink
      v-if="userId"
      class="author-trigger"
      :to="{ path: '/user/space', query: { id: String(userId) } }"
      :title="`查看 ${displayName} 的空间`"
      @click.stop
    >
      {{ displayName }}
    </NuxtLink>
    <span v-else class="author-trigger is-static">{{ displayName }}</span>

    <Teleport to="body">
      <span
        v-if="rendered"
        ref="popoverRef"
        class="author-hover-card"
        :class="{ 'is-open': open }"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        title="点击卡片在新窗口打开 TA 的空间"
        @mouseenter="cancelHide"
        @mouseleave="scheduleHide"
        @click="onCardClick"
      >
        <ArticleAuthorCard :author="authorInfo" link-target="_blank" />
      </span>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    userId?: number
    nickName?: string
    avatar?: string
  }>(),
  {
    userId: 0,
    nickName: '',
    avatar: ''
  }
)

const displayName = computed(() => props.nickName || `用户 ${props.userId}`)
const spacePath = computed(() => `/user/space?id=${props.userId}`)
const authorInfo = computed(() => ({ userId: props.userId, nickName: displayName.value, avatar: props.avatar }))

// 悬浮卡：延迟出现/消失避免鼠标掠过每行都弹卡；首次打开后常驻 DOM 只切可见性，作者统计不重复请求
const rendered = ref(false)
const open = ref(false)
const triggerWrapRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const position = reactive({ top: 0, left: 0 })

let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

// 卡片宽度与视口留白：宽度需与样式保持一致，用于右/下越界时翻转定位
const CARD_WIDTH = 300
const VIEWPORT_GAP = 8

// 浮层挂在 body 上，位置按触发元素实时计算；空间不足时先向上翻，仍不足则贴着视口底
const updatePosition = () => {
  const trigger = triggerWrapRef.value
  if (!trigger) {
    return
  }
  const rect = trigger.getBoundingClientRect()
  const width = popoverRef.value?.offsetWidth || CARD_WIDTH
  const height = popoverRef.value?.offsetHeight || 220
  let left = rect.left
  if (left + width > window.innerWidth - VIEWPORT_GAP) {
    left = Math.max(VIEWPORT_GAP, window.innerWidth - width - VIEWPORT_GAP)
  }
  let top = rect.bottom + VIEWPORT_GAP
  if (top + height > window.innerHeight - VIEWPORT_GAP) {
    const above = rect.top - VIEWPORT_GAP - height
    top = above >= VIEWPORT_GAP ? above : Math.max(VIEWPORT_GAP, window.innerHeight - height - VIEWPORT_GAP)
  }
  position.top = top
  position.left = left
}

const onViewportChange = () => updatePosition()

const bindViewport = () => {
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
}

const unbindViewport = () => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
}

const scheduleShow = () => {
  if (!props.userId) {
    return
  }
  if (showTimer) {
    clearTimeout(showTimer)
  }
  cancelHide()
  showTimer = setTimeout(() => {
    showTimer = null
    rendered.value = true
    nextTick(() => {
      updatePosition()
      open.value = true
      bindViewport()
    })
  }, 120)
}

const cancelHide = () => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const scheduleHide = () => {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  cancelHide()
  hideTimer = setTimeout(() => {
    hideTimer = null
    open.value = false
    unbindViewport()
  }, 180)
}

// 卡片空白区点击即进作者空间（链接/按钮自行处理，避免关注按钮与名字链接被连带触发）
const onCardClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('a, button')) {
    return
  }
  window.open(spacePath.value, '_blank', 'noopener,noreferrer')
}

onBeforeUnmount(() => {
  if (showTimer) {
    clearTimeout(showTimer)
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  unbindViewport()
})
</script>

<style lang="less" scoped>
.author-hover {
  position: relative;
  display: inline-flex;
  min-width: 0;

  .author-trigger {
    color: inherit;
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-primary);
    }

    &.is-static {
      cursor: default;

      &:hover {
        color: inherit;
      }
    }
  }
}

// 悬浮卡（Teleport 到 body）：白底 + 投影，复用 AuthorCard 的内容与留白
.author-hover-card {
  position: fixed;
  z-index: 90;
  display: block;
  width: 300px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    visibility 0.16s;

  &.is-open {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: none;
  }
}
</style>