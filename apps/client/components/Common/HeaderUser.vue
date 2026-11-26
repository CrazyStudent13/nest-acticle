<!-- 顶栏右侧用户区（主站头部 / 创作者中心共用）：通知铃铛（点击进 /notification、悬停下拉四分类、未读红标在挂载/登录成功时刷新，不做轮询）+ 头像昵称 + 退出；未登录不渲染 -->
<template>
  <div v-if="isLoggedIn" class="header-user">
    <!-- 通知入口：仿掘金——铃铛点击进通知中心，悬停展开分类面板 -->
    <div class="notice-entry" @mouseenter="openNoticePanel" @mouseleave="closeNoticePanelSoon">
      <button class="notice-btn" type="button" aria-label="通知" @click="goNotification">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <!-- 未读红标：别人赞/评了我的文章时的传统数字提示，99+ 封顶 -->
        <span v-if="unread.total > 0" class="notice-dot">{{ unread.total > 99 ? '99+' : unread.total }}</span>
      </button>

      <div class="notice-panel" :class="{ open: noticeOpen }">
        <a
          v-for="cat in noticeCats"
          :key="cat.key"
          class="notice-cat"
          :href="catRoute(cat)"
          @click.stop="noticeOpen = false"
        >
          {{ cat.label }}
          <i v-if="catUnread(cat.key) > 0" class="notice-cat-count">{{ catUnread(cat.key) > 99 ? '99+' : catUnread(cat.key) }}</i>
        </a>
      </div>
    </div>

    <span class="user-area">
      <NuxtLink to="/user/space" class="user-link" title="进入个人中心">
        <img v-if="avatarUrl" class="user-avatar" :src="avatarUrl" alt="头像" />
        <span v-else class="user-avatar user-avatar-fallback">{{ avatarFallback }}</span>
        <span class="user-name">{{ user?.nickName || user?.userName }}</span>
        <!-- 悬停展示完整信息：昵称被截断时能看到全文 -->
        <span class="user-tip" role="tooltip">
          <span class="user-tip-name">{{ user?.nickName || user?.userName }}</span>
          <span v-if="user?.email && user.email !== user.nickName" class="user-tip-email">{{ user.email }}</span>
        </span>
      </NuxtLink>
      <button class="logout-btn" type="button" @click="handleLogout">退出</button>
    </span>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const { user, isLoggedIn, ensureUserRestored, logout } = useUser()

// 通知入口：铃铛点击进通知中心，悬停出分类面板（与创作者中心面板同套交互；私信工作量大暂缓）
// 分类清单与通知中心左侧竖栏同源（useNotice 的 NOTICE_CATS），铃铛下拉只取 key/label
const noticeCats = NOTICE_CATS

type NoticeCat = (typeof noticeCats)[number]

// 分类直达：系统通知是默认 tab 不带参数，其余带 ?tab=
const catRoute = (cat: NoticeCat) => {
  return cat.key === 'system' ? '/notification' : `/notification?tab=${cat.key}`
}

const goNotification = () => {
  return navigateTo('/notification')
}

// ---------- 铃铛红标：未读计数全局共享（useNotify）。刷新时机刻意克制——
// 组件挂载与登录成功各拉一次即可，不做轮询/路由监听（低频辅助信息不值得常驻开销） ----------
const { unread, refreshBadge } = useNotify()

const catUnread = (key: NoticeCat['key']) => {
  // 赞和收藏栏合并展示赞+收藏未读（通知中心同款口径）
  if (key === 'comment') {
    return unread.value.comment
  }
  if (key === 'like') {
    return unread.value.like + unread.value.collect
  }
  if (key === 'follower') {
    return unread.value.follow
  }
  if (key === 'system') {
    return unread.value.system
  }
  return 0
}

// 登录成功瞬间拉一次（页面刷新场景由 onMounted 覆盖；退出由 refreshBadge 自清）
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    refreshBadge()
  }
})

const noticeOpen = ref(false)
let noticeCloseTimer: ReturnType<typeof setTimeout> | null = null

const openNoticePanel = () => {
  if (noticeCloseTimer) {
    clearTimeout(noticeCloseTimer)
    noticeCloseTimer = null
  }
  noticeOpen.value = true
}

const closeNoticePanelSoon = () => {
  if (noticeCloseTimer) {
    clearTimeout(noticeCloseTimer)
  }
  noticeCloseTimer = setTimeout(() => {
    noticeOpen.value = false
  }, 250)
}

// 头像地址：后端返回相对路径（/profile/...）时补全服务器前缀
const avatarUrl = computed(() => toCoverUrl(config.public.apiBase, user.value?.avatar))
const avatarFallback = computed(() => (user.value?.nickName || user.value?.userName || '用户').slice(0, 1))

// 页面刷新后恢复登录态：有 token 但还没有用户信息时静默拉取（逻辑在 useUser.ensureUserRestored，与 auth middleware 共用）
onMounted(() => {
  ensureUserRestored()
  // 已登录即拉取红标（token 存在但用户信息未恢复时，watch(isLoggedIn) 会在恢复完成后触发）
  if (isLoggedIn.value) {
    refreshBadge()
  }
})

const handleLogout = async () => {
  await logout()
}
</script>

<style lang="less" scoped>
.header-user {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

// 通知入口：铃铛圆角钮 + 悬停下拉分类面板（交互与创作者中心面板一致）
.notice-entry {
  position: relative;

  .notice-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      background-color: var(--color-bg);
      color: var(--color-text-1);
    }

    // 未读红标：铃铛右上角数字角标（传统提示样式），99+ 封顶防止撑破
    .notice-dot {
      position: absolute;
      top: -1px;
      right: -7px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background-color: #f04142;
      font-size: 11px;
      line-height: 16px;
      font-weight: 500;
      color: #fff;
      text-align: center;
      box-sizing: border-box;
    }
  }

  .notice-panel {
    position: absolute;
    top: calc(100% + 12px);
    left: 50%;
    min-width: 132px;
    padding: 6px 0;
    border-radius: var(--radius-md);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border-light);
    box-shadow: var(--shadow-2);
    z-index: 101;
    opacity: 0;
    visibility: hidden;
    transform: translate(-50%, -4px);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease,
      visibility 0.15s;
    pointer-events: none;

    // 透明桥：盖住按钮与面板之间的空隙，鼠标划过不脱离悬停链
    &::before {
      content: '';
      position: absolute;
      top: -12px;
      left: 0;
      right: 0;
      height: 12px;
    }

    &.open {
      opacity: 1;
      visibility: visible;
      transform: translate(-50%, 0);
      pointer-events: auto;
    }

    .notice-cat {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 9px 20px;
      text-align: left;
      font-size: 14px;
      color: var(--color-text-2);
      white-space: nowrap;
      text-decoration: none;
      transition:
        color 0.2s ease,
        background-color 0.2s ease;

      &:hover {
        color: var(--color-primary);
        background-color: var(--color-bg);
      }

      // 分类未读数：右对齐小红标（与铃铛主红标同色，字号略小）
      .notice-cat-count {
        margin-left: auto;
        padding-left: 12px;
        font-style: normal;
        font-size: 11px;
        font-weight: 500;
        color: #f04142;
      }
    }
  }
}

.user-area {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;

  .user-link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    cursor: pointer;
  }

  .user-avatar {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-full);
    object-fit: cover;
    background-color: var(--color-bg);

    &.user-avatar-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background-image: var(--gradient-brand);
      color: #fff;
      font-size: 14px;
    }
  }

  .user-name {
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--color-text-1);
  }

  .logout-btn {
    padding: 0;
    border: 0;
    background-color: transparent;
    font-size: 13px;
    color: var(--color-text-3);
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-primary);
    }
  }

  // 悬停浮层：展示完整昵称与邮箱
  .user-tip {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background-color: var(--color-text-1);
    color: #fff;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
    box-shadow: var(--shadow-2);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease,
      visibility 0.15s;
    pointer-events: none;
    z-index: 101;
  }

  &:hover .user-tip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .user-tip-email {
    color: rgba(255, 255, 255, 0.65);
  }
}
</style>