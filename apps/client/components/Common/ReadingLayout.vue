<!-- 阅读页通用双栏布局：正文卡片 820 + 右侧信息栏 240（吸顶，窄屏隐藏），文章详情与通知/公告详情共用，
     保证两处版式一致；flush 用于空态（卡片不留内边距） -->
<template>
  <div class="reading-layout">
    <article
      class="reading-panel"
      :class="{ 'reading-panel--flush': flush }"
    >
      <slot />
    </article>
    <aside v-if="$slots.aside" class="reading-aside">
      <slot name="aside" />
    </aside>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 空态等场景去掉卡片内边距 */
    flush?: boolean
  }>(),
  {
    flush: false
  }
)
</script>

<style lang="less" scoped>
.reading-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
}

.reading-panel {
  flex: 1;
  min-width: 0;
  max-width: 820px;
  padding: 36px 44px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);

  &--flush {
    padding: 0;
  }
}

// 短文章也铺到接近满屏：视口高 - 站头 60 - 内容区上下留白 24/40；空态保持紧凑
.reading-panel:not(.reading-panel--flush) {
  min-height: calc(100vh - 124px);
}

// 右侧信息栏：吸顶跟随，窄屏隐藏
.reading-aside {
  position: sticky;
  top: 76px;
  flex-shrink: 0;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1000px) {
  .reading-aside {
    display: none;
  }
}

@media (max-width: 640px) {
  .reading-panel {
    padding: 24px 20px;

    &--flush {
      padding: 0;
    }
  }
}
</style>