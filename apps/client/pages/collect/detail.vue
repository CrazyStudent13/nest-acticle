<!-- 收藏集详情页：顶部收藏集信息卡（名称/私密锁/简介/创建者/统计）+ 收藏文章列表（首屏 10 条，
     "加载更多"手动翻页）；操作区按身份分流——非本人可订阅公开集，本人可编辑/删除收藏集与移出文章；
     私密集仅创建者可见（guest 接口按登录态识别，SSR 直出公开形状，本人标记由客户端登录态刷新） -->
<template>
  <div class="collect">
    <!-- 收藏集不存在/私密集非本人访问：对齐文章详情页的空态口径 -->
    <section v-if="!detail" class="feed-panel">
      <CommonEmptyState>收藏集不存在或仅创建者可见</CommonEmptyState>
    </section>

    <template v-else>
      <section class="collect-header">
      <div class="header-main">
        <h1 class="title">
          {{ detail?.name || '收藏集详情' }}
          <span v-if="detail?.isDefault" class="default-badge">默认</span>
          <svg v-if="detail?.visibility === '1'" class="lock-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </h1>
        <p v-if="detail?.desc" class="desc">{{ detail.desc }}</p>
        <div class="meta">
          <span>{{ detail?.articleCount ?? 0 }} 篇文章</span>
          <span>{{ detail?.subscriberCount ?? 0 }} 订阅</span>
          <span v-if="updateTime">{{ updateTime }} 更新</span>
        </div>
        <NuxtLink v-if="detail?.userInfo" class="owner" :to="{ path: '/user/space', query: { id: String(detail.userInfo.userId) } }">
          <img v-if="ownerAvatar" class="owner-avatar" :src="ownerAvatar" :alt="detail.userInfo.nickName" />
          <span v-else class="owner-avatar owner-avatar--fallback">{{ ownerFallback }}</span>
          <span class="owner-name">{{ detail.userInfo.nickName }}</span>
        </NuxtLink>
      </div>

      <div class="header-actions">
        <!-- 本人：编辑/删除收藏集（默认收藏夹不可删除，不显示删除入口，后端同样拦截） -->
        <template v-if="detail?.isMine">
          <button class="action-btn" type="button" @click="openEdit">编辑收藏集</button>
          <button v-if="!detail?.isDefault" class="action-btn danger" type="button" :disabled="deleting" @click="confirmRemoveCollection">
            {{ deleting ? '删除中…' : '删除收藏集' }}
          </button>
        </template>
        <!-- 非本人且公开：订阅/已订阅 -->
        <button
          v-else-if="detail && detail.visibility !== '1'"
          class="action-btn subscribe-btn"
          :class="{ subscribed: detail.isSubscribed }"
          type="button"
          :disabled="subscribeBusy"
          @click="toggleSubscribe"
        >
          {{ subscribeBusy ? '处理中…' : detail.isSubscribed ? '已订阅' : '订阅' }}
        </button>
      </div>
    </section>

    <section class="feed-panel">
      <div class="feed-header">
        <h2 class="feed-title">收藏文章</h2>
      </div>

      <template v-if="articles.length">
        <div v-for="item in articles" :key="item.id || item.title" class="article-row">
          <article-card :card-info="item" @click="goArticle(item)" />
          <!-- 本人整理视角：悬浮移出收藏集 -->
          <button v-if="detail?.isMine" class="row-remove" type="button" title="移出收藏集" @click.stop="confirmRemoveArticle(item)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            移出
          </button>
        </div>
      </template>
      <CommonEmptyState v-else-if="listLoading">加载中…</CommonEmptyState>
      <CommonEmptyState v-else>该收藏集下还没有文章</CommonEmptyState>

      <div v-if="articles.length && !finished" class="feed-loadmore">
        <button class="loadmore-btn" type="button" :disabled="listLoading" @click="loadMore">
          {{ listLoading ? '加载中…' : loadError ? '加载失败，点击重试' : '加载更多' }}
        </button>
      </div>
      <p v-else-if="articles.length && finished && loadedMore" class="feed-end">已经到底了</p>
    </section>

    <!-- 编辑收藏集弹窗（本人） -->
    <CollectCollectionEditModal v-if="editOpen" :collection="editForm" @close="editOpen = false" @saved="onEdited" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '@nest-acticle/utils'
import type { Article, Collection } from '@nest-acticle/shared'

const route = useRoute()
const config = useRuntimeConfig()
const collectionId = computed(() => (route.query.id as string) || '')

const { fetchCollectionDetail, fetchCollectionArticles, deleteCollection, uncollectArticle, subscribeCollection, unsubscribeCollection } = useCollect()
const { user, ensureUserRestored } = useUser()

// ---------- 收藏集详情：SSR 直出公开形状；本人/订阅标记依赖登录态，挂载后客户端刷新 ----------
const { data: detailRes } = await useFetch<{ data?: (Collection & { isMine?: boolean; isSubscribed?: boolean }) | null }>(
  `${config.public.apiBase}/api/post/collection/guest/detail`,
  {
    query: { id: collectionId },
    default: () => ({ data: null })
  }
)

const detail = ref<(Collection & { isMine?: boolean; isSubscribed?: boolean }) | null>(detailRes.value?.data || null)

const refreshDetail = async () => {
  if (!collectionId.value) {
    return
  }
  try {
    const fresh = await fetchCollectionDetail(collectionId.value)
    if (fresh) {
      detail.value = fresh
    }
  } catch {
    /* 静默：保留 SSR 数据 */
  }
}

onMounted(async () => {
  // 登录态静默恢复后刷新归属/订阅标记（SSR 无 token，isMine/isSubscribed 恒为 false）
  await ensureUserRestored()
  if (user.value) {
    refreshDetail()
  }
})

// SPA 内切换收藏集时重载（detail 由 useFetch query 响应式自动重取）
watch(collectionId, () => {
  detail.value = detailRes.value?.data || null
  resetList()
  refreshDetail()
})

useSeoMeta({
  title: () => (detail.value?.name ? `${detail.value.name} - 收藏集 - 游戏速递` : '收藏集详情 - 游戏速递'),
  ogTitle: () => detail.value?.name || '收藏集详情',
  description: () => detail.value?.desc || '游戏速递的收藏集详情页。'
})

const updateTime = computed(() => formatDate(detail.value?.updateTime))
const ownerAvatar = computed(() => toCoverUrl(config.public.apiBase, detail.value?.userInfo?.avatar))
const ownerFallback = computed(() => detail.value?.userInfo?.nickName?.slice(0, 1) || '用')

const goArticle = (item: Article) => {
  return navigateTo({
    path: '/article/detail',
    query: { id: item.id }
  })
}

// ---------- 收藏文章列表：首屏 SSR 直出，后续页客户端追加（同专栏详情的加载更多模式） ----------
const PAGE_SIZE = 10
const { data: articleRes } = await useFetch<{ data?: { list?: Article[]; total?: number } | null }>(
  `${config.public.apiBase}/api/post/collection/guest/articles`,
  {
    query: computed(() => ({
      collectionId: collectionId.value,
      pageNum: 1,
      pageSize: PAGE_SIZE
    })),
    default: () => ({ data: { list: [], total: 0 } })
  }
)

const appended = ref<Article[]>([])
const lastPage = ref(1)
const lastPageShort = ref(false)
const listLoading = ref(false)
const loadError = ref('')

const articles = computed(() => {
  const first = articleRes.value?.data?.list || []
  return appended.value.length ? [...first, ...appended.value] : first
})

const total = computed(() => articleRes.value?.data?.total || 0)

const finished = computed(() => {
  if (total.value) {
    return articles.value.length >= total.value
  }
  return lastPageShort.value
})

const loadedMore = computed(() => appended.value.length > 0)

const loadMore = async () => {
  if (listLoading.value || finished.value || !collectionId.value) {
    return
  }
  listLoading.value = true
  loadError.value = ''
  try {
    const data = await fetchCollectionArticles(collectionId.value, { pageNum: lastPage.value + 1, pageSize: PAGE_SIZE })
    const list = data.list || []
    appended.value.push(...list)
    lastPage.value += 1
    if (list.length < PAGE_SIZE) {
      lastPageShort.value = true
    }
  } catch (error: any) {
    loadError.value = error?.message || '加载失败'
  } finally {
    listLoading.value = false
  }
}

const resetList = () => {
  appended.value = []
  lastPage.value = 1
  lastPageShort.value = false
  loadError.value = ''
}

// ---------- 订阅/退订（非本人；未登录先弹登录框） ----------
const { openLogin } = useAuthModal()
const subscribeBusy = ref(false)

const toggleSubscribe = async () => {
  if (!detail.value) {
    return
  }
  if (!user.value) {
    openLogin()
    return
  }
  subscribeBusy.value = true
  try {
    const result = detail.value.isSubscribed
      ? await unsubscribeCollection(detail.value.id!)
      : await subscribeCollection(detail.value.id!)
    detail.value.isSubscribed = !!result?.subscribed
    if (result?.subscriberCount !== undefined) {
      detail.value.subscriberCount = result.subscriberCount
    }
    showToast(detail.value.isSubscribed ? '订阅成功' : '已退订', 'success')
  } catch (error: any) {
    showToast(error?.message || '操作失败，请稍后重试', 'error')
  } finally {
    subscribeBusy.value = false
  }
}

// ---------- 编辑收藏集（本人） ----------
const editOpen = ref(false)
const editForm = ref<Collection | null>(null)

const openEdit = () => {
  if (!detail.value) {
    return
  }
  editForm.value = {
    id: detail.value.id,
    name: detail.value.name,
    desc: detail.value.desc,
    visibility: detail.value.visibility
  }
  editOpen.value = true
}

const onEdited = async () => {
  editOpen.value = false
  showToast('收藏集已保存', 'success')
  resetList()
  refreshDetail()
}

// ---------- 删除收藏集（本人，二次确认后回个人空间） ----------
const deleting = ref(false)

const confirmRemoveCollection = async () => {
  if (!detail.value?.id) {
    return
  }
  const ok = await confirmAction({
    title: '删除收藏集',
    message: `确定删除收藏集「${detail.value.name}」吗？收藏与订阅关系会一并清理。`,
    confirmText: '删除'
  })
  if (!ok) {
    return
  }
  deleting.value = true
  try {
    await deleteCollection(detail.value.id)
    showToast('收藏集已删除', 'success')
    navigateTo({ path: '/user/space', query: { id: String(detail.value.userId) } })
  } catch (error: any) {
    showToast(error?.message || '删除失败，请稍后重试', 'error')
  } finally {
    deleting.value = false
  }
}

// ---------- 移出文章（本人，二次确认） ----------
const confirmRemoveArticle = async (item: Article) => {
  if (!detail.value?.id || !item.id) {
    return
  }
  const ok = await confirmAction({
    title: '移出收藏集',
    message: `确定把「${item.title}」移出收藏集吗？`,
    confirmText: '移出'
  })
  if (!ok) {
    return
  }
  try {
    await uncollectArticle(detail.value.id, item.id)
    // 从首页与追加页两处来源移除并同步计数（详情卡与列表 total），不整页刷新
    if (articleRes.value?.data) {
      articleRes.value.data.list = articleRes.value.data.list?.filter((row) => row.id !== item.id) ?? []
      articleRes.value.data.total = Math.max(0, (articleRes.value.data.total || 0) - 1)
    }
    appended.value = appended.value.filter((row) => row.id !== item.id)
    if (detail.value) {
      detail.value.articleCount = Math.max(0, (detail.value.articleCount || 0) - 1)
    }
    showToast('已移出收藏集', 'success')
  } catch (error: any) {
    showToast(error?.message || '移出失败，请稍后重试', 'error')
  }
}
</script>

<style lang="less" scoped>
.collect {
  padding: 4px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// 收藏集信息卡
.collect-header {
  padding: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  .header-main {
    flex: 1;
    min-width: 0;

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 22px;
      font-weight: 600;
      color: var(--color-text-1);

      .default-badge {
        flex-shrink: 0;
        padding: 2px 10px;
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-full);
        font-size: 12px;
        font-weight: 400;
        line-height: 18px;
        color: var(--color-primary);
      }

      .lock-icon {
        flex-shrink: 0;
        color: var(--color-text-3);
      }
    }

    .desc {
      margin-top: 10px;
      font-size: 14px;
      line-height: 22px;
      color: var(--color-text-2);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .meta {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: 13px;
      color: var(--color-text-3);
    }

    .owner {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--color-text-2);

      &:hover .owner-name {
        color: var(--color-primary);
      }

      .owner-avatar {
        width: 24px;
        height: 24px;
        border-radius: var(--radius-full);
        object-fit: cover;
        background-color: var(--color-bg);
        line-height: 24px;
        text-align: center;

        &--fallback {
          color: #fff;
          background-image: var(--gradient-brand);
          font-size: 12px;
        }
      }

      .owner-name {
        transition: color 0.2s ease;
      }
    }
  }

  .header-actions {
    flex-shrink: 0;
    display: flex;
    gap: 10px;

    .action-btn {
      padding: 7px 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface);
      font-size: 13px;
      color: var(--color-text-2);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        color 0.2s ease,
        opacity 0.2s ease;

      &:hover:not(:disabled) {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &.danger:hover:not(:disabled) {
        border-color: #d1242f;
        color: #d1242f;
      }

      // 订阅主按钮：主题色实底，已订阅转浅底
      &.subscribe-btn {
        border: 0;
        background-color: var(--color-primary);
        color: #fff;

        &:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
          color: #fff;
        }

        &.subscribed {
          background-color: var(--color-primary-light);
          color: var(--color-primary);

          &:hover:not(:disabled) {
            background-color: var(--color-primary-light);
            color: var(--color-primary);
            opacity: 0.85;
          }
        }
      }
    }
  }
}

// 文章行容器：承载本人视角的悬浮移出按钮
.article-row {
  position: relative;

  .row-remove {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    font-size: 12px;
    color: var(--color-text-3);
    opacity: 0;
    cursor: pointer;
    transition:
      opacity 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      border-color: #d1242f;
      color: #d1242f;
    }
  }

  &:hover .row-remove {
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .article-row .row-remove {
    opacity: 1;
    right: 12px;
    padding: 4px 8px;
  }

  .collect-header {
    flex-direction: column;

    .header-actions {
      width: 100%;

      .action-btn {
        flex: 1;
      }
    }
  }
}
</style>
