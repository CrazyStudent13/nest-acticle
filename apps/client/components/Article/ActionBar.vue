<!-- 文章详情页左侧悬浮工具栏：点赞/评论/收藏接真实交互（由父组件处理登录态与请求），举报为占位，分享=复制链接，回顶部按滚动距离显现 -->
<template>
  <div class="action-bar">
    <!-- 点赞：已点赞高亮，点击由父组件切换 -->
    <button :class="{ liked }" class="action-btn" type="button" title="点赞" @click="emit('like')">
      <AppIcon name="thumbs-up" :size="20" :filled="liked" />
      <span v-if="likeNum > 0" class="action-badge">{{ likeNum }}</span>
    </button>

    <!-- 评论：点击滚动到评论区（由父组件定位） -->
    <button class="action-btn" type="button" title="评论" @click="emit('comment')">
      <AppIcon name="comment" :size="20" />
      <span v-if="commentNum > 0" class="action-badge">{{ commentNum }}</span>
    </button>

    <!-- 收藏：已收藏（任一收藏集）星星填充高亮，点击由父组件打开收藏弹窗 -->
    <button :class="{ collected }" class="action-btn" type="button" title="收藏" @click="emit('collect')">
      <AppIcon name="star" :size="20" :filled="collected" />
      <span v-if="collectNum > 0" class="action-badge">{{ collectNum }}</span>
    </button>

    <!-- 分享：复制文章链接 -->
    <button class="action-btn" type="button" title="分享" @click="shareLink">
      <AppIcon name="share" :size="20" />
    </button>

    <!-- 举报：文章作者本人不显示（服务端亦拒绝自查举报），已举报（存在待处理举报）置灰，点击由父组件开举报弹窗 -->
    <button
      v-if="canReport"
      class="action-btn"
      :class="{ 'is-reported': reported }"
      type="button"
      :disabled="reported"
      :title="reported ? '已举报，等待处理' : '举报'"
      @click="emit('report')"
    >
      <AppIcon name="report" :size="20" />
    </button>

    <!-- 回顶部：滚动超过一屏才出现 -->
    <button v-show="showTop" class="action-btn top-btn" type="button" title="回顶部" @click="backTop">
      <AppIcon name="arrow-up" :size="20" />
    </button>

    <span v-if="tip" class="action-tip">{{ tip }}</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    likeNum?: number
    commentNum?: number
    /** 当前用户是否已点赞（点赞高亮由父组件依据登录态与接口结果传入） */
    liked?: boolean
    /** 当前用户是否已收藏（收藏高亮由父组件依据登录态与收藏弹窗结果传入） */
    collected?: boolean
    /** 文章收藏总数（被收进收藏集次数） */
    collectNum?: number
    /** 是否展示举报入口（文章作者本人为 false，游客/其他用户可见，登录拦截由父组件处理） */
    canReport?: boolean
    /** 当前用户是否已举报过该文章（置灰态，由父组件登录后补查传入） */
    reported?: boolean
  }>(),
  {
    likeNum: 0,
    commentNum: 0,
    liked: false,
    collected: false,
    collectNum: 0,
    canReport: true,
    reported: false
  }
)

const emit = defineEmits<{
  (e: 'like'): void
  (e: 'comment'): void
  (e: 'collect'): void
  (e: 'report'): void
}>()

// 占位功能的轻提示，2 秒自动消失
const tip = ref('')
let tipTimer: ReturnType<typeof setTimeout> | null = null
const showTip = (message: string) => {
  tip.value = message
  if (tipTimer) {
    clearTimeout(tipTimer)
  }
  tipTimer = setTimeout(() => (tip.value = ''), 2000)
}

// 分享：复制当前文章链接；clipboard 失败（页面未聚焦等）时降级 execCommand
const shareLink = async () => {
  const url = window.location.href
  const copyViaExec = () => {
    const temp = document.createElement('textarea')
    temp.value = url
    temp.style.position = 'fixed'
    temp.style.opacity = '0'
    document.body.appendChild(temp)
    temp.select()
    const ok = document.execCommand('copy')
    temp.remove()
    return ok
  }
  let copied = false
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      copied = true
    } catch {
      copied = false
    }
  }
  if (!copied) {
    copied = copyViaExec()
  }
  showTip(copied ? '链接已复制，快去分享吧' : '复制失败，请手动复制地址栏链接')
}

// 滚动超过一屏显示回顶部；直接在 scroll 回调里算（同目录高亮逻辑，不依赖 rAF）
const showTop = ref(false)
const onScroll = () => {
  showTop.value = window.scrollY > window.innerHeight
}
const backTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (tipTimer) {
    clearTimeout(tipTimer)
  }
})
</script>

<style lang="less" scoped>
// 固定定位挂在正文列左侧空白区，不占布局宽度；视口不够宽时整体隐藏
.action-bar {
  position: fixed;
  left: calc(50% - 596px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;

  .action-btn {
    position: relative;
    width: 46px;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      color 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      color: var(--color-primary);
      box-shadow: 0 2px 10px rgba(79, 107, 255, 0.25);
    }

    .action-badge {
      position: absolute;
      top: -7px;
      right: -7px;
      min-width: 19px;
      height: 19px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
      border: 1px solid var(--color-border-light);
      font-size: 11px;
      line-height: 1;
      color: var(--color-text-3);
    }

    // 已点赞态：主题色高亮
    &.liked {
      color: var(--color-primary);
      box-shadow: 0 2px 10px rgba(79, 107, 255, 0.25);
    }

    // 已收藏态：主题色高亮（同点赞）
    &.collected {
      color: var(--color-primary);
      box-shadow: 0 2px 10px rgba(79, 107, 255, 0.25);
    }

    // 已举报态（有待处理举报）：置灰禁点，处理完成后恢复可点
    &.is-reported {
      color: var(--color-text-3);
      cursor: not-allowed;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

      &:hover {
        color: var(--color-text-3);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
    }
  }

  .top-btn {
    margin-top: 6px;
  }

  .action-tip {
    position: absolute;
    left: 50%;
    bottom: -34px;
    transform: translateX(-50%);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    background-color: rgba(0, 0, 0, 0.75);
    font-size: 12px;
    color: #fff;
    white-space: nowrap;
    z-index: 10;
  }
}

@media (max-width: 1200px) {
  .action-bar {
    display: none;
  }
}
</style>
