<!-- 全站默认布局：吸顶站头+内容区+底部页脚；首页与阅读类页面不渲染页脚（首页站点信息在右侧边栏展示，阅读页正文卡片拉满视口，底部不留白色页脚条） -->
<template>
  <div class="app">
    <AppHeader />

    <main class="app-main">
      <slot />
    </main>

    <!-- 首页的页脚信息在右侧边栏展示（掘金式），通知中心与文章/通知详情正文卡片拉满视口，不保留白色页脚条 -->
    <AppFooter v-if="showFooter" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// 阅读类页面（文章/通知/公告详情）不渲染页脚：正文卡片以视口高度铺底，底部只留灰底空隙
const noFooterPaths = ['/', '/notification', '/article/detail', '/notice/detail']
const showFooter = computed(() => !noFooterPaths.includes(route.path))
</script>

<style lang="less" scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-bg);
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: var(--container-width);
  margin: 0 auto;
  padding: 24px 16px 40px;
}
</style>
