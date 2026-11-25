<!-- 收藏集详情页：顶部收藏集信息卡（名称/私密锁/简介/创建者/统计）+ 收藏文章列表（首屏 10 条，
     "加载更多"手动翻页）；操作区按身份分流——非本人可订阅公开集，本人可编辑/删除收藏集与移出文章；
     私密集仅创建者可见（guest 接口按登录态识别，SSR 直出公开形状，本人标记由客户端登录态刷新） -->
<template>
  <div class="collect">
    <!-- 收藏集不存在/私密集非本人访问：对齐文章详情页的空态口径；SPA 切集重拉期间显示加载中 -->
    <section v-if="!detail" class="feed-panel">
      <!-- 空态组件的文案只走默认插槽（没有 text prop，写成属性不会显示） -->
      <CommonEmptyState v-if="detailLoading">加载中…</CommonEmptyState>
      <CommonEmptyState v-else>收藏集不存在或仅创建者可见</CommonEmptyState>
    </section>

    <template v-else>
      <!-- 品牌渐变横幅（掘金收藏集头图同构，配色取论坛 token）：名称/简介/创建者 + 本人编辑/删除或订阅 -->
      <section class="collect-hero">
        <div class="hero-main">
          <h1 class="title">
            {{ detail?.name || '收藏集详情' }}
            <span v-if="detail?.isDefault" class="default-badge">默认</span>
            <svg v-if="detail?.visibility === '1'" class="lock-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </h1>
          <p v-if="detail?.desc" class="desc">{{ detail.desc }}</p>
          <NuxtLink v-if="detail?.userInfo" class="owner" :to="{ path: '/user/space', query: { id: String(detail.userInfo.userId) } }">
            <img v-if="ownerAvatar" class="owner-avatar" :src="ownerAvatar" :alt="detail.userInfo.nickName" />
            <span v-else class="owner-avatar owner-avatar--fallback">{{ ownerFallback }}</span>
            <span class="owner-name">{{ detail.userInfo.nickName }}</span>
          </NuxtLink>
        </div>

        <div class="hero-actions">
          <!-- 本人：编辑/删除收藏集（默认收藏夹不可删除，不显示删除入口，后端同样拦截） -->
          <template v-if="detail?.isMine">
            <button class="hero-btn" type="button" @click="openEdit">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              编辑
            </button>
            <button v-if="!detail?.isDefault" class="hero-btn" :class="{ danger: deleting }" type="button" :disabled="deleting" @click="confirmRemoveCollection">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              {{ deleting ? '删除中…' : '删除' }}
            </button>
          </template>
          <!-- 非本人且公开：订阅/已订阅 -->
          <button
            v-else-if="detail && detail.visibility !== '1'"
            class="hero-btn subscribe-btn"
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
          <!-- 统计行（掘金同款「N篇文章 · N订阅」口径） -->
          <h2 class="feed-title">
            {{ detail?.articleCount ?? 0 }}篇文章 · {{ detail?.subscriberCount ?? 0 }}订阅
            <span v-if="updateTime" class="feed-meta">{{ updateTime }} 更新</span>
          </h2>
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
// watch: false——SPA 内切集（同路由改 ?id=）不走 useFetch 的自动重取：它不带 token（私密集只有本人带 token
// 才看得到），且 key 变化的瞬间新 key 会沿用上一集的数据当初始值、失败时又落回 default。
// 切集统一由下方 watch(collectionId) 清空后带登录态重拉，这里的 data 只在 setup 时取一次当初值
const { data: detailRes } = await useFetch<{ data?: (Collection & { isMine?: boolean; isSubscribed?: boolean }) | null }>(
  `${config.public.apiBase}/api/post/collection/guest/detail`,
  {
    query: { id: collectionId },
    default: () => ({ data: null }),
    watch: false
  }
)

const detail = ref<(Collection & { isMine?: boolean; isSubscribed?: boolean }) | null>(detailRes.value?.data || null)

// 重拉详情期间为 true：详情为空时空态显示「加载中…」而不是「收藏集不存在」。初值 false 与 SSR 直出一致
const detailLoading = ref(false)
// 最新一轮详情请求的序号：切集/再次刷新后，迟到的旧响应一律丢弃
let detailSeq = 0

// 当前 detail 是否就是 URL 上这一集（切集瞬间会先置空，别的收藏集的数据不许冒充）
const isCurrentDetail = () => Number(detail.value?.id) === Number(collectionId.value)

// 带登录态刷新当前收藏集（apiFetch 自带 token：SSR 无 token，isMine/isSubscribed 恒为 false）。
// 只认仍是当前集的响应；失败/空结果时不保留别的收藏集的数据（切集后保持空态，杜绝 URL 与内容不一致），
// 当前集自己的详情（SSR 直出/上次刷新）照常保留
const refreshDetail = async () => {
  const id = collectionId.value
  if (!id) {
    return
  }
  const seq = ++detailSeq
  const isStale = () => seq !== detailSeq || id !== collectionId.value
  detailLoading.value = true
  try {
    const fresh = await fetchCollectionDetail(id)
    if (isStale()) {
      return
    }
    if (fresh && Number(fresh.id) === Number(id)) {
      detail.value = fresh
      // 列表为空但集内实际有文章（私密集本人访问、SPA 切集）时带登录态补拉首屏
      if ((fresh.articleCount ?? 0) > 0 && total.value === 0) {
        const first = await fetchCollectionArticles(id, { pageNum: 1, pageSize: PAGE_SIZE })
        if (isStale()) {
          return
        }
        setFirst(first.list || [], first.total || 0)
      }
    } else if (!isCurrentDetail()) {
      detail.value = null
    }
  } catch {
    if (!isStale() && !isCurrentDetail()) {
      detail.value = null
    }
  } finally {
    // 过期请求不碰加载态：新一轮刷新正在飞，由它收尾
    if (seq === detailSeq) {
      detailLoading.value = false
    }
  }
}

onMounted(async () => {
  // 登录态静默恢复后刷新归属/订阅标记（SSR 无 token，isMine/isSubscribed 恒为 false）
  await ensureUserRestored()
  if (!user.value) {
    return
  }
  refreshDetail()
})

// SPA 内切换收藏集（同路由改 ?id=，如浏览器前进/后退）：URL 已指向新集，先把详情与列表清空
// （旧集内容一帧都不许留，在飞的「加载更多」随之作废），再带登录态重拉
watch(collectionId, () => {
  detail.value = null
  clearList()
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

// ---------- 收藏文章列表：首屏 SSR 直出，后续页客户端追加（useInfiniteList：按文章 id 去重）----------
const PAGE_SIZE = 10
const { data: articleRes } = await useFetch<{ data?: { list?: Article[]; total?: number } | null }>(
  `${config.public.apiBase}/api/post/collection/guest/articles`,
  {
    query: computed(() => ({
      collectionId: collectionId.value,
      pageNum: 1,
      pageSize: PAGE_SIZE
    })),
    default: () => ({ data: { list: [], total: 0 } }),
    watch: false
  }
)

// 首页取 SSR 直出结果；首页为空但集内有文章时（私密集本人访问）由 refreshDetail 带登录态补拉覆盖
const {
  items: articles,
  total,
  finished,
  loadedMore,
  loading: listLoading,
  loadError,
  loadMore: loadMoreRows,
  setFirst,
  reset: resetList,
  clear: clearList,
  remove: removeArticle
} = useInfiniteList<Article>({
  pageSize: PAGE_SIZE,
  keyOf: (item) => item.id,
  first: articleRes.value?.data?.list,
  total: articleRes.value?.data?.total,
  // apiFetch 自带 token：私密集只有本人带 token 才取得到后续页
  fetchPage: (pageNum) => fetchCollectionArticles(collectionId.value, { pageNum, pageSize: PAGE_SIZE })
})

// 无 collectionId（异常路由）时不发请求
const loadMore = () => (collectionId.value ? loadMoreRows() : undefined)

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
    // 首页与追加页两处来源一并移除并同步计数（详情卡与列表 total），不整页刷新
    removeArticle(item.id)
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

// 品牌渐变横幅（配色走 --gradient-brand，不取掘金蓝）：名称/简介/创建者居左，操作居右上
.collect-hero {
  padding: 28px 28px 26px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  background-image: var(--gradient-brand);
  border-radius: var(--radius-sm);
  color: #fff;
  overflow: hidden;

  .hero-main {
    flex: 1;
    min-width: 0;

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
      color: #fff;

      .default-badge {
        flex-shrink: 0;
        padding: 1px 9px;
        border: 1px solid rgba(255, 255, 255, 0.7);
        border-radius: var(--radius-full);
        font-size: 12px;
        font-weight: 400;
        line-height: 18px;
        color: #fff;
      }

      .lock-icon {
        flex-shrink: 0;
        color: rgba(255, 255, 255, 0.85);
      }
    }

    .desc {
      margin-top: 10px;
      font-size: 14px;
      line-height: 22px;
      color: rgba(255, 255, 255, 0.85);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .owner {
      margin-top: 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.92);

      &:hover .owner-name {
        opacity: 0.8;
      }

      .owner-avatar {
        width: 26px;
        height: 26px;
        border-radius: var(--radius-full);
        object-fit: cover;
        background-color: rgba(255, 255, 255, 0.25);
        line-height: 26px;
        text-align: center;

        &--fallback {
          color: #fff;
          background-color: rgba(255, 255, 255, 0.22);
          font-size: 12px;
        }
      }

      .owner-name {
        transition: opacity 0.2s ease;
      }
    }
  }

  .hero-actions {
    flex-shrink: 0;
    display: flex;
    gap: 10px;
    padding-top: 2px;

    // 白描边 ghost 按钮（编辑/删除），订阅为白底主题字
    .hero-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 16px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: var(--radius-sm);
      background-color: transparent;
      font-size: 13px;
      color: #fff;
      cursor: pointer;
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        color 0.2s ease,
        opacity 0.2s ease;

      &:hover:not(:disabled) {
        background-color: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.9);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      // 删除进行中转危险提示
      &.danger:not(:disabled) {
        border-color: rgba(255, 158, 158, 0.9);
        color: #ffd9d9;
      }

      // 订阅主按钮：白底主题字；已订阅转半透明白底白字
      &.subscribe-btn {
        border-color: transparent;
        background-color: #fff;
        color: var(--color-primary);
        font-weight: 500;

        &:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.88);
        }

        &.subscribed {
          background-color: transparent;
          border-color: rgba(255, 255, 255, 0.6);
          color: #fff;
          font-weight: 400;

          &:hover:not(:disabled) {
            background-color: rgba(255, 255, 255, 0.14);
          }
        }
      }
    }
  }
}

// 内容卡统计行（掘金「N篇文章 · N订阅」口径）：覆盖全站 feed-header 的紧凑标题样式，常规字重灰字、内边距更舒展
.feed-panel > .feed-header {
  padding: 24px 24px;
}

.feed-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 14px;
  font-weight: 400;
  color: var(--color-text-2);

  .feed-meta {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-text-3);
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

  .collect-hero {
    flex-direction: column;
    padding: 22px 20px;

    .hero-actions {
      width: 100%;

      .hero-btn {
        flex: 1;
        justify-content: center;
      }
    }
  }
}
</style>
