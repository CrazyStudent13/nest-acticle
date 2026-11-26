<!-- 首页（即文章列表）：掘金式信息流——最新（SSR 直出，createTime 倒序）与关注（登录后懒加载，publishTime 倒序）双 tab，无限滚动；?title= 标题搜索；被拦下的关注 tab 在登录成功后自动切入 -->
<template>
  <div class="home-layout">
    <div class="feed-panel">
      <div class="feed-header">
        <!-- 掘金式 feed tabs：推荐待文章量大后再加 -->
        <div class="feed-tabs">
          <button class="feed-tab" :class="{ active: feedTab === 'new' }" type="button" @click="switchTab('new')">最新</button>
          <button class="feed-tab" :class="{ active: feedTab === 'follow' }" type="button" @click="switchTab('follow')">关注</button>
        </div>
        <NuxtLink v-if="searchTitle && feedTab === 'new'" to="/" class="feed-more">清除搜索</NuxtLink>
        <span v-else-if="currentTotal" class="feed-more">共 {{ currentTotal }} 篇</span>
      </div>

      <!-- 列表：两个 tab 共用卡片渲染；关注流首次切 tab 时由客户端拉取 -->
      <template v-if="currentArticles.length">
        <article-card v-for="item in currentArticles" :key="item.id || item.title" :card-info="item" @click="handleRowClick(item)" />
      </template>

      <!-- 关注 tab 的加载/错误/空态 -->
      <template v-else-if="feedTab === 'follow'">
        <CommonEmptyState v-if="followPageLoading">加载中…</CommonEmptyState>
        <CommonEmptyState v-else-if="currentError">
          关注流加载失败
          <button class="btn primary empty-action" type="button" @click="retryCurrent">重试</button>
        </CommonEmptyState>
        <CommonEmptyState v-else>
          关注流暂无内容，去最新发现喜欢的作者吧
          <button class="btn primary empty-action" type="button" @click="switchTab('new')">去看看最新文章</button>
        </CommonEmptyState>
      </template>

      <!-- 最新 tab 空态 -->
      <CommonEmptyState v-else>
        {{ searchTitle ? `未找到与“${searchTitle}”相关的文章` : '暂无文章，敬请期待' }}
      </CommonEmptyState>

      <!-- 无限滚动：哨兵进入视口自动追加；出错时显示手动重试 -->
      <div v-show="currentArticles.length" ref="sentinelRef" class="feed-sentinel" />
      <div v-if="currentError && currentArticles.length" class="feed-loadmore">
        <button class="loadmore-btn" type="button" :disabled="currentLoading" @click="retryCurrent">
          {{ currentLoading ? '加载中…' : '加载失败，点击重试' }}
        </button>
      </div>
      <p v-if="currentArticles.length && currentFinished && currentLoadedMore" class="feed-end">已经到底了</p>
    </div>

    <!-- 右侧信息栏：页脚信息块（掘金式） -->
    <aside class="home-aside">
      <div class="info-card">
        <CommonFooterInfo />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { Article, PageResult } from '@nest-acticle/shared'

const route = useRoute()
const config = useRuntimeConfig()
const searchTitle = computed(() => ((route.query.title as string) || '').trim())

useSeoMeta({
  title: () => (searchTitle.value ? `“${searchTitle.value}” 的搜索结果 - 游戏速递` : '游戏速递 - 专注分享游戏资讯与玩家攻略'),
  ogTitle: '游戏速递',
  description: '专注分享游戏资讯，玩家攻略，游戏存档的快乐小站，希望为玩家们提供更好的游戏体验。',
  ogDescription: '专注分享游戏资讯，玩家攻略，游戏存档的快乐小站'
})

// feed tab：最新（默认）/ 关注（登录后按需加载）
const feedTab = ref<'new' | 'follow'>('new')

const queryParams = computed(() => ({
  pageNum: 1,
  pageSize: 10,
  // 最新按创建时间倒序（publishTime 多为 null 会沉底，不用后端默认排序）
  orderByColumn: 'createTime',
  isAsc: 'descending',
  ...(searchTitle.value ? { title: searchTitle.value } : {})
}))

const { data } = await useFetch<{ data?: { list?: Article[]; total?: number } }>(`${config.public.apiBase}/api/post/article/guest/list`, {
  query: queryParams,
  default: () => ({ data: { list: [], total: 0 } })
})

const {
  articles: newArticles,
  total: newTotal,
  loading: newLoading,
  loadError: newError,
  finished: newFinished,
  loadedMore: newLoadedMore,
  loadMore: newLoadMore
} = useArticleFeed(data, queryParams)

// 关注流：首页是公开页，不参与 SSR 取数；首次切到关注 tab（且已登录）时拉第 1 页，
// 之后的分页交给 useArticleFeed 追加
const followInitial = ref<{ data?: { list?: Article[]; total?: number } } | null>(null)
const followLoaded = ref(false)
const followPageLoading = ref(false)
const followPageError = ref('')
const followFilters = computed(() => ({}))

const {
  articles: followArticles,
  total: followTotal,
  loading: followLoading,
  loadError: followError,
  finished: followFinished,
  loadedMore: followLoadedMore,
  loadMore: followLoadMore,
  reset: followReset
} = useArticleFeed(followInitial, followFilters, 10, '/api/post/article/follow/list')

const { isLoggedIn, ensureUserRestored } = useUser()
const { isOpen: authModalOpen, openLogin } = useAuthModal()

const ensureFollowLoaded = async () => {
  if (followLoaded.value || followPageLoading.value) {
    return
  }
  followPageLoading.value = true
  followPageError.value = ''
  try {
    const res = await apiFetch<PageResult<Article>>('/api/post/article/follow/list', {
      query: { pageNum: 1, pageSize: 10 }
    })
    followInitial.value = {
      data: { list: res.data?.list || [], total: res.data?.total || 0 }
    }
    followLoaded.value = true
  } catch (error: any) {
    followPageError.value = error?.message || '加载失败'
  } finally {
    followPageLoading.value = false
  }
}

// 当前 tab 的统一视图：两个 feed 实例按 tab 转发，模板只消费 current*
const currentArticles = computed(() => (feedTab.value === 'new' ? newArticles.value : followArticles.value))
const currentTotal = computed(() => (feedTab.value === 'new' ? newTotal.value : followTotal.value))
const currentLoading = computed(() =>
  feedTab.value === 'new' ? newLoading.value : followPageLoading.value || followLoading.value
)
const currentError = computed(() =>
  feedTab.value === 'new' ? newError.value : followPageError.value || followError.value
)
const currentFinished = computed(() => (feedTab.value === 'new' ? newFinished.value : followFinished.value))
const currentLoadedMore = computed(() => (feedTab.value === 'new' ? newLoadedMore.value : followLoadedMore.value))

// ---------- 无限滚动：哨兵进入视口自动加载下一页，追加后若仍在视口内继续加载 ----------
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const maybeLoadMore = () => {
  if (currentLoading.value || currentFinished.value || currentError.value || !currentArticles.value.length) {
    return
  }
  const el = sentinelRef.value
  if (el && el.getBoundingClientRect().top < window.innerHeight + 200) {
    const next = feedTab.value === 'new' ? newLoadMore() : followLoadMore()
    next.then(() => maybeLoadMore())
  }
}

// 切 tab：关注 tab 先静默恢复登录态（token 可能在、用户信息未拉），未登录则弹登录框，
// 并记住这次意图——登录成功后自动切入关注流，不用刷新页面
const pendingFollow = ref(false)

const enterFollowTab = async () => {
  feedTab.value = 'follow'
  await ensureFollowLoaded()
  await nextTick()
  maybeLoadMore()
}

const switchTab = async (tab: 'new' | 'follow') => {
  if (feedTab.value === tab) {
    return
  }
  if (tab === 'follow') {
    await ensureUserRestored()
    if (!isLoggedIn.value) {
      pendingFollow.value = true
      openLogin()
      return
    }
    await enterFollowTab()
    return
  }
  feedTab.value = 'new'
  await nextTick()
  maybeLoadMore()
}

// 登录态切换：登录成功接住之前被拦下的关注意图；退出登录作废关注流数据（换账号也不能看到上一个人的列表）
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    if (pendingFollow.value) {
      pendingFollow.value = false
      enterFollowTab()
    }
    return
  }
  pendingFollow.value = false
  followReset()
  followInitial.value = null
  followLoaded.value = false
  followPageError.value = ''
  if (feedTab.value === 'follow') {
    feedTab.value = 'new'
  }
})

// 关掉登录弹窗但没登录：放弃关注意图，避免之后在别处登录被连带切到关注流
watch(authModalOpen, (open) => {
  if (!open && !isLoggedIn.value) {
    pendingFollow.value = false
  }
})

// 失败重试：第 1 页失败走 ensureFollowLoaded，后续分页失败走各自 feed 的 loadMore
const retryCurrent = async () => {
  if (feedTab.value === 'follow' && !followLoaded.value) {
    await ensureFollowLoaded()
  } else {
    await (feedTab.value === 'new' ? newLoadMore() : followLoadMore())
  }
  await nextTick()
  maybeLoadMore()
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        maybeLoadMore()
      }
    },
    { rootMargin: '200px' }
  )
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

const handleRowClick = (item: Article) => {
  return navigateTo({
    path: '/article/detail',
    query: {
      id: item.id
    }
  })
}
</script>

<style lang="less" scoped>
// 首页双栏：信息流 + 右侧站点信息栏（掘金式）
.home-layout {
  display: flex;
  align-items: flex-start;
  gap: 20px;

  .feed-panel {
    flex: 1;
    min-width: 0;
  }
}

// feed tabs（掘金式：文字 tab + 短圆条下划线，骑在头部边框线上）
.feed-header {
  padding-bottom: 0;

  .feed-tabs {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .feed-tab {
    position: relative;
    padding: 0 2px 12px;
    border: 0;
    background-color: transparent;
    font-size: 14px;
    color: var(--color-text-2);
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-text-1);
    }

    &.active {
      color: var(--color-primary);
      font-weight: 500;
    }

    // 短圆条下划线：底部越界 2px，正好压在头部边框上
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -2px;
      transform: translateX(-50%);
      width: 28px;
      height: 3px;
      border-radius: 2px;
      background-color: transparent;
      transition: background-color 0.2s ease;
    }

    &.active::after {
      background-color: var(--color-primary);
    }
  }

  .feed-more {
    margin-left: auto;
    padding-bottom: 12px;
  }
}

// 空态里的动作按钮：块级居中，与空态文案拉开距离
.empty-action {
  display: block;
  margin: 12px auto 0;
}

.home-aside {
  position: sticky;
  top: 76px;
  flex-shrink: 0;
  width: 280px;

  .info-card {
    padding: 20px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-md);
  }
}

// 无限滚动哨兵：仅撑起触发区域
.feed-sentinel {
  height: 1px;
}

@media (max-width: 1000px) {
  .home-aside {
    display: none;
  }
}
</style>
