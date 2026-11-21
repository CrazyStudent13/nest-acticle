<!-- 通知中心页：左侧四分类竖栏（评论/赞和收藏/新增粉丝/系统通知）+ 右侧列表；系统通知接 /api/system/notice/list（Markdown 内容超 3 行收起、就地展开，分页）；评论栏双子栏——「收到的评论」接 /api/post/comment/received/list（他人评论我的文章/回复我的评论，掘金式接收流，铃铛红标数由本栏承接），「我发表的」接 /api/post/comment/my/list（类型徽标区分，支持删除）；赞和收藏接 /api/post/like/received/list（他人点赞我发布的文章，掘金式接收流；收藏与评论点赞功能未建）；新增粉丝后端未建占位空态；进页即调已读打点清红标；tab 状态同步 ?query，全站唯一通知入口（头部铃铛同款分类） -->
<template>
  <div class="notification-page">
    <div class="notice-panel">
      <!-- 左侧分类菜单 -->
      <aside class="notice-menu">
        <button
          v-for="cat in noticeCats"
          :key="cat.key"
          class="menu-item"
          :class="{ active: activeTab === cat.key }"
          type="button"
          @click="switchCat(cat.key)"
        >
          <span class="menu-icon" v-html="cat.icon" />
          {{ cat.label }}
        </button>
      </aside>

      <!-- 右侧内容区 -->
      <section class="notice-main">
        <!-- 系统通知：真实列表 -->
        <template v-if="activeTab === 'system'">
          <template v-if="notices.length">
            <article v-for="item in notices" :key="item.noticeId" class="notice-item">
              <div class="notice-head">
                <span class="notice-badge" :class="item.noticeType === '2' ? 'is-announce' : 'is-info'">
                  {{ item.noticeType === '2' ? '公告' : '通知' }}
                </span>
                <h3 class="notice-title">{{ item.noticeTitle || '系统消息' }}</h3>
                <time class="notice-time">{{ formatTime(item.createTime) }}</time>
              </div>
              <div
                v-if="item.noticeContent"
                class="notice-body"
                :class="{ collapsed: !expandedMap[item.noticeId] }"
                :data-nid="item.noticeId"
              >
                <MdViewer :value="item.noticeContent" />
              </div>
              <button
                v-if="overflowMap[item.noticeId]"
                class="notice-toggle"
                type="button"
                @click="toggleExpand(item.noticeId)"
              >
                {{ expandedMap[item.noticeId] ? '收起' : '展开' }}
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ flip: expandedMap[item.noticeId] }" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </article>
            <CommonPagination v-model:page="page" :total="total" :page-size="PAGE_SIZE" />
          </template>
          <CommonEmptyState v-else-if="loading" text="加载中…" />
          <CommonEmptyState v-else-if="errorMsg">{{ errorMsg }}</CommonEmptyState>
          <CommonEmptyState v-else>暂无系统通知</CommonEmptyState>
        </template>

        <!-- 评论：子栏切换（收到的评论默认 / 我发表的），铃铛红标数由「收到的评论」承接 -->
        <template v-else-if="activeTab === 'comment'">
          <div class="comment-box-bar">
            <button class="box-tab" :class="{ active: commentBox === 'received' }" type="button" @click="switchCommentBox('received')">收到的评论</button>
            <button class="box-tab" :class="{ active: commentBox === 'mine' }" type="button" @click="switchCommentBox('mine')">我发表的</button>
          </div>

          <!-- 收到的评论：掘金式接收流（左头像、中间文案+内容+相对时间、右文章封面） -->
          <template v-if="commentBox === 'received'">
            <template v-if="receivedComments.length">
              <article v-for="row in receivedComments" :key="row.id" class="notice-item like-item">
                <NuxtLink class="like-avatar" :to="{ path: '/user/space', query: { id: String(row.userId) } }">
                  <img v-if="row.avatar" :src="coverUrl(row.avatar)" :alt="row.nickName" loading="lazy" />
                  <span v-else class="avatar-fallback">{{ (row.nickName || '评').slice(0, 1) }}</span>
                </NuxtLink>
                <div class="like-main">
                  <p class="like-text">
                    <NuxtLink class="like-user" :to="{ path: '/user/space', query: { id: String(row.userId) } }">
                      {{ row.nickName || '用户' }}
                    </NuxtLink>
                    <!-- 三种文案：回复我的评论 / 回复他人评论 / 直接评论我的文章，尾部统一带文章入口 -->
                    <template v-if="row.parentId && row.replyUserId === currentUserId">回复了你的评论</template>
                    <template v-else-if="row.parentId">
                      回复了
                      <NuxtLink class="like-user" :to="{ path: '/user/space', query: { id: String(row.replyUserId) } }">
                        @{{ row.replyNickName || '未知用户' }}
                      </NuxtLink>
                      的评论
                    </template>
                    <template v-else>评论了你的文章</template>
                    <NuxtLink class="like-article" :to="{ path: '/article/detail', query: { id: String(row.articleId) } }">
                      《{{ row.articleTitle || '文章已删除' }}》
                    </NuxtLink>
                  </p>
                  <p class="like-content">{{ row.content }}</p>
                  <time class="like-time">{{ formatRelativeTime(row.createTime) }}</time>
                </div>
                <NuxtLink
                  v-if="row.articleCover"
                  class="like-thumb"
                  :to="{ path: '/article/detail', query: { id: String(row.articleId) } }"
                >
                  <img :src="coverUrl(row.articleCover)" :alt="row.articleTitle || ''" loading="lazy" />
                </NuxtLink>
              </article>
              <CommonPagination v-model:page="receivedPage" :total="receivedTotal" :page-size="PAGE_SIZE" />
            </template>
            <CommonEmptyState v-else-if="receivedLoading" text="加载中…" />
            <CommonEmptyState v-else-if="receivedError">{{ receivedError }}</CommonEmptyState>
            <CommonEmptyState v-else>还没有收到评论，文章写得越多人气越旺</CommonEmptyState>
          </template>

          <!-- 我发表的评论与回复（原管理流，服务端按当前登录人过滤） -->
          <template v-else>
            <template v-if="myComments.length">
              <article v-for="row in myComments" :key="row.id" class="notice-item">
                <div class="notice-head">
                  <!-- 徽标复用系统通知的配色：蓝=对文章的评论,橙=对他人评论的回复 -->
                  <span class="notice-badge" :class="row.parentId ? 'is-announce' : 'is-info'">
                    {{ row.parentId ? '回复' : '评论' }}
                  </span>
                  <NuxtLink
                    class="comment-article"
                    :class="{ 'is-deleted': !row.articleTitle }"
                    :to="{ path: '/article/detail', query: { id: String(row.articleId) } }"
                    target="_blank"
                  >
                    {{ row.articleTitle || '文章已删除' }}
                  </NuxtLink>
                  <time class="notice-time">{{ formatRelativeTime(row.createTime) }}</time>
                  <button class="comment-del" type="button" :disabled="deletingId === row.id" @click="removeMyComment(row)">
                    {{ deletingId === row.id ? '删除中…' : '删除' }}
                  </button>
                </div>
                <p class="comment-content" :class="{ collapsed: !commentExpandedMap[row.id] }" :data-cid="row.id">
                  <span v-if="row.parentId" class="reply-mark">
                    回复
                    <!-- 被回复人昵称可跳其个人空间（与文章详情评论区一致） -->
                    <NuxtLink v-if="row.replyUserId" class="reply-user" :to="{ path: '/user/space', query: { id: String(row.replyUserId) } }">
                      @{{ row.replyNickName || '未知用户' }}：
                    </NuxtLink>
                    <template v-else>@{{ row.replyNickName || '未知用户' }}：</template>
                  </span>{{ row.content }}
                </p>
                <!-- 超长内容默认单行省略,溢出才出展开按钮 -->
                <button v-if="commentOverflowMap[row.id]" class="notice-toggle" type="button" @click="toggleCommentExpand(row.id)">
                  {{ commentExpandedMap[row.id] ? '收起' : '展开' }}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ flip: commentExpandedMap[row.id] }" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </article>
              <CommonPagination v-model:page="commentPage" :total="commentTotal" :page-size="PAGE_SIZE" />
            </template>
            <CommonEmptyState v-else-if="commentLoading" text="加载中…" />
            <CommonEmptyState v-else-if="commentError">{{ commentError }}</CommonEmptyState>
            <CommonEmptyState v-else>暂无评论或回复，去文章页说两句吧</CommonEmptyState>
          </template>
        </template>

        <!-- 赞和收藏：他人点赞我发布的文章（掘金式接收流：左头像、中间文案+相对时间、右文章封面） -->
        <template v-else-if="activeTab === 'like'">
          <template v-if="receivedLikes.length">
            <article v-for="row in receivedLikes" :key="row.id" class="notice-item like-item">
              <NuxtLink class="like-avatar" :to="{ path: '/user/space', query: { id: String(row.userId) } }">
                <img v-if="row.avatar" :src="coverUrl(row.avatar)" :alt="row.nickName" loading="lazy" />
                <span v-else class="avatar-fallback">{{ (row.nickName || '用').slice(0, 1) }}</span>
              </NuxtLink>
              <div class="like-main">
                <p class="like-text">
                  <NuxtLink class="like-user" :to="{ path: '/user/space', query: { id: String(row.userId) } }">
                    {{ row.nickName || '用户' }}
                  </NuxtLink>
                  赞了你的文章
                  <NuxtLink class="like-article" :to="{ path: '/article/detail', query: { id: String(row.articleId) } }">
                    《{{ row.articleTitle || '文章已删除' }}》
                  </NuxtLink>
                </p>
                <time class="like-time">{{ formatRelativeTime(row.createTime) }}</time>
              </div>
              <NuxtLink
                v-if="row.articleCover"
                class="like-thumb"
                :to="{ path: '/article/detail', query: { id: String(row.articleId) } }"
              >
                <img :src="coverUrl(row.articleCover)" :alt="row.articleTitle || ''" loading="lazy" />
              </NuxtLink>
            </article>
            <CommonPagination v-model:page="likePage" :total="likeTotal" :page-size="PAGE_SIZE" />
          </template>
          <CommonEmptyState v-else-if="likeLoading" text="加载中…" />
          <CommonEmptyState v-else-if="likeError">{{ likeError }}</CommonEmptyState>
          <CommonEmptyState v-else>还没有收到点赞，发布优质文章就会有互动了</CommonEmptyState>
        </template>

        <!-- 其余分类：互动功能未建，占位空态 -->
        <CommonEmptyState v-else>{{ activeCat.label }}功能即将上线，敬请期待</CommonEmptyState>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { formatRelativeTime } from '@nest-acticle/utils'
import type { MyCommentItem, ReceivedCommentItem, ReceivedLikeItem } from '@nest-acticle/shared'
import type { NoticeItem } from '~/composables/useNotice'

// 登录守卫走 auth middleware：未登录弹登录框并回首页，数据加载保持在组件内（守卫先行不发必 401 的请求）
definePageMeta({
  middleware: 'auth'
})

// ---------- 分类清单：与头部铃铛下拉一致（私信工作量大暂缓），icon 为全站规范的内联描边 SVG ----------
const noticeCats = [
  {
    key: 'comment',
    label: '评论',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
  },
  {
    key: 'like',
    label: '赞和收藏',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
  },
  {
    key: 'follower',
    label: '新增粉丝',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>'
  },
  {
    key: 'system',
    label: '系统通知',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
  }
] as const

type NoticeTab = (typeof noticeCats)[number]['key']

const route = useRoute()
const config = useRuntimeConfig()

// 头像/封面统一补全服务端前缀（相对路径直出会 404）
const coverUrl = (path?: string | null) => toCoverUrl(config.public.apiBase, path)

// ---------- tab 状态：?tab= 同步（非法值回落系统通知），铃铛下拉可带分类直达 ----------
const normalizeTab = (value: unknown): NoticeTab => {
  const key = String(value || 'system')
  return (noticeCats.find((cat) => cat.key === key)?.key || 'system') as NoticeTab
}

const activeTab = ref<NoticeTab>(normalizeTab(route.query.tab))
const activeCat = computed(() => noticeCats.find((cat) => cat.key === activeTab.value) || noticeCats[noticeCats.length - 1]!)

watch(
  () => route.query.tab,
  (value) => {
    activeTab.value = normalizeTab(value)
  }
)

const switchCat = (key: NoticeTab) => {
  if (key === activeTab.value) {
    return
  }
  return navigateTo({ path: '/notification', query: key === 'system' ? {} : { tab: key } })
}

// ---------- 系统通知列表：分页拉取，status='1'（已关闭）前端过滤；403 等业务错误降级为空态提示 ----------
const { fetchNotices, fetchMyComments } = useNotice()
const { markRead, fetchReceivedComments } = useNotify()
const { user } = useUser()

// 当前登录人 id：收到的评论行判定「回复了我的评论」用
const currentUserId = computed(() => user.value?.userId ?? null)

const PAGE_SIZE = 10
const page = ref(1)
const total = ref(0)
const notices = ref<NoticeItem[]>([])
const loading = ref(false)
const errorMsg = ref('')

const loadNotices = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await fetchNotices({ pageNum: page.value, pageSize: PAGE_SIZE })
    notices.value = (data.list || []).filter((item) => item.status === '0')
    total.value = data.total || 0
  } catch (error: any) {
    notices.value = []
    total.value = 0
    errorMsg.value = error?.message || '通知加载失败'
  } finally {
    loading.value = false
  }
  await nextTick()
  measureOverflow()
}

// ---------- 收到的评论（评论栏默认子页）：他人评论我的文章/回复我的评论，掘金式接收流 ----------
const commentBox = ref<'received' | 'mine'>('received')

const receivedComments = ref<ReceivedCommentItem[]>([])
const receivedPage = ref(1)
const receivedTotal = ref(0)
const receivedLoading = ref(false)
const receivedError = ref('')

const loadReceivedComments = async () => {
  receivedLoading.value = true
  receivedError.value = ''
  try {
    const data = await fetchReceivedComments({ pageNum: receivedPage.value, pageSize: PAGE_SIZE })
    receivedComments.value = data.list || []
    receivedTotal.value = data.total || 0
  } catch (error: any) {
    receivedComments.value = []
    receivedTotal.value = 0
    receivedError.value = error?.message || '评论加载失败'
  } finally {
    receivedLoading.value = false
  }
}

// 子栏切换：重置到第一页并按需加载（切走的子页在切回时再拉，保证数据新鲜）
const switchCommentBox = (box: 'received' | 'mine') => {
  if (commentBox.value === box) {
    return
  }
  commentBox.value = box
  if (box === 'received') {
    receivedPage.value = 1
    loadReceivedComments()
  } else {
    commentPage.value = 1
    loadMyComments()
  }
}

// ---------- 我的评论列表（评论 tab）：分页拉取当前登录人的评论与回复，删除后重拉保证计数准确 ----------
const { deleteComment } = useComment()

const myComments = ref<MyCommentItem[]>([])
const commentPage = ref(1)
const commentTotal = ref(0)
const commentLoading = ref(false)
const commentError = ref('')
const deletingId = ref<number | null>(null)

const loadMyComments = async () => {
  commentLoading.value = true
  commentError.value = ''
  try {
    const data = await fetchMyComments({ pageNum: commentPage.value, pageSize: PAGE_SIZE })
    myComments.value = data.list || []
    commentTotal.value = data.total || 0
  } catch (error: any) {
    myComments.value = []
    commentTotal.value = 0
    commentError.value = error?.message || '评论加载失败'
  } finally {
    commentLoading.value = false
  }
  await nextTick()
  measureCommentOverflow()
}

// ---------- 内容展开/收起：默认单行省略,渲染后量 scrollWidth 决定是否出「展开」按钮 ----------
const commentExpandedMap = ref<Record<number, boolean>>({})
const commentOverflowMap = ref<Record<number, boolean>>({})

const measureCommentOverflow = () => {
  const map: Record<number, boolean> = {}
  document.querySelectorAll<HTMLElement>('.comment-content[data-cid]').forEach((el) => {
    const cid = Number(el.dataset.cid)
    if (Number.isFinite(cid)) {
      map[cid] = el.scrollWidth > el.clientWidth + 1
    }
  })
  commentOverflowMap.value = map
}

const toggleCommentExpand = (id: number) => {
  commentExpandedMap.value = { ...commentExpandedMap.value, [id]: !commentExpandedMap.value[id] }
}

const removeMyComment = async (row: MyCommentItem) => {
  if (deletingId.value) {
    return
  }
  const confirmed = await confirmAction({
    title: '删除评论',
    message: '确定删除这条评论吗？其下的回复也会一并删除。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) {
    return
  }
  deletingId.value = row.id
  try {
    await deleteComment(row.id)
    showToast('评论已删除', 'success')
    // 服务端会级联删除其全部后代,行数与总数以重拉结果为准
    loadMyComments()
  } catch (error: any) {
    showToast(error?.message || '删除失败，请稍后再试', 'error')
  } finally {
    deletingId.value = null
  }
}

// ---------- 收到的赞（赞和收藏 tab）：他人点赞我发布的文章，服务端按登录态过滤，最新在前 ----------
const receivedLikes = ref<ReceivedLikeItem[]>([])
const likePage = ref(1)
const likeTotal = ref(0)
const likeLoading = ref(false)
const likeError = ref('')

const loadReceivedLikes = async () => {
  likeLoading.value = true
  likeError.value = ''
  try {
    const res = await apiFetch<{ list?: ReceivedLikeItem[]; total?: number }>('/api/post/like/received/list', {
      query: { pageNum: likePage.value, pageSize: PAGE_SIZE }
    })
    receivedLikes.value = res.data?.list || []
    likeTotal.value = res.data?.total || 0
  } catch (error: any) {
    receivedLikes.value = []
    likeTotal.value = 0
    likeError.value = error?.message || '点赞列表加载失败'
  } finally {
    likeLoading.value = false
  }
}

// 首屏加载放到登录守卫之后（onMounted），避免未登录先发一轮必然 401 的请求
watch(activeTab, (tab) => {
  if (tab === 'system') {
    page.value = 1
    loadNotices()
  }
  if (tab === 'comment') {
    receivedPage.value = 1
    commentPage.value = 1
    // 按当前子栏加载（两子栏都有独立分页，切回时经 switchCommentBox 重拉）
    if (commentBox.value === 'received') {
      loadReceivedComments()
    } else {
      loadMyComments()
    }
  }
  if (tab === 'like') {
    likePage.value = 1
    loadReceivedLikes()
  }
})

watch(page, loadNotices)
watch(receivedPage, loadReceivedComments)
watch(commentPage, loadMyComments)
watch(likePage, loadReceivedLikes)

// ---------- 内容展开/收起：Markdown 长文默认收起（72px），渲染后量 scrollHeight 决定是否出「展开」按钮 ----------
const expandedMap = ref<Record<number, boolean>>({})
const overflowMap = ref<Record<number, boolean>>({})

const COLLAPSED_HEIGHT = 72

const measureOverflow = () => {
  const map: Record<number, boolean> = {}
  document.querySelectorAll<HTMLElement>('.notice-body[data-nid]').forEach((el) => {
    const nid = Number(el.dataset.nid)
    if (Number.isFinite(nid)) {
      map[nid] = el.scrollHeight > COLLAPSED_HEIGHT + 2
    }
  })
  overflowMap.value = map
}

const toggleExpand = (noticeId: number) => {
  expandedMap.value = { ...expandedMap.value, [noticeId]: !expandedMap.value[noticeId] }
}

const formatTime = (value?: string | null) => {
  if (!value) {
    return ''
  }
  const formatted = dayjs(value).format('YYYY-MM-DD HH:mm')
  return formatted === 'Invalid Date' ? '' : formatted
}

// ---------- 首屏加载：登录守卫已由 auth middleware 先行（未登录不会到达这里），避免发一轮必然 401 的请求 ----------
onMounted(() => {
  // 进通知中心即清铃铛红标：全部互动分类已读水位推至当前（失败静默，下次进入重试）
  markRead().catch(() => {})
  if (activeTab.value === 'system') {
    loadNotices()
  } else if (activeTab.value === 'comment') {
    if (commentBox.value === 'received') {
      loadReceivedComments()
    } else {
      loadMyComments()
    }
  } else if (activeTab.value === 'like') {
    loadReceivedLikes()
  }
})
</script>

<style lang="less" scoped>
// 宽度交给 default 布局的 app-main（1100px 容器，与头部 logo/退出同缘对齐），页面只做垂直微调
// 高度撑满视口剩余空间：100vh - 头部61 - app-main 上下padding 64 - 页面自身 padding 12
.notification-page {
  min-height: calc(100vh - 137px);
  display: flex;
  flex-direction: column;
  padding: 4px 0 8px;
}

.notice-panel {
  flex: 1;
  // 左菜单与右列表两张独立卡片、中间 16px 间距——对齐站点「多卡片+间距」的模块语言；stretch 等高拉满
  display: flex;
  align-items: stretch;
  gap: 16px;
}

// 左侧分类竖栏（与设置页 200px 菜单同规格），高度贴合菜单内容
.notice-menu {
  flex-shrink: 0;
  width: 200px;
  padding: 12px 8px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: transparent;
    font-size: 14px;
    color: var(--color-text-2);
    text-align: left;
    cursor: pointer;
    transition:
      color 0.2s ease,
      background-color 0.2s ease;

    .menu-icon {
      display: flex;
      align-items: center;
      color: var(--color-text-3);
      transition: color 0.2s ease;
    }

    &:hover {
      color: var(--color-text-1);
      background-color: var(--color-bg);
    }

    &.active {
      color: var(--color-primary);
      background-color: var(--color-primary-light);
      font-weight: 500;

      .menu-icon {
        color: var(--color-primary);
      }
    }
  }
}

.notice-main {
  flex: 1;
  min-width: 0;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

// 评论栏子切换（收到的评论/我发表的）：页头胶囊组，同左菜单 active 视觉
.comment-box-bar {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-light);

  .box-tab {
    padding: 4px 12px;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: transparent;
    font-size: 13px;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      color 0.2s ease,
      background-color 0.2s ease;

    &:hover {
      color: var(--color-text-1);
      background-color: var(--color-bg);
    }

    &.active {
      color: var(--color-primary);
      background-color: var(--color-primary-light);
      font-weight: 500;
    }
  }
}

.notice-item {
  padding: 16px 20px;

  & + .notice-item {
    border-top: 1px solid var(--color-border-light);
  }
}

// 赞和收藏：掘金式接收流——左头像、中间「谁赞了哪篇」+相对时间、右文章封面
.like-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .like-avatar {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .avatar-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background-color: var(--color-primary-light);
      font-size: 16px;
      color: var(--color-primary);
    }
  }

  .like-main {
    flex: 1;
    min-width: 0;
  }

  .like-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    line-height: 22px;
    color: var(--color-text-1);
  }

  // 昵称与文章标题走主题蓝，悬浮加下划线；文章已删时仍可点（详情页有空态）
  .like-user,
  .like-article {
    color: var(--color-primary);
    transition: color 0.2s ease;

    &:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  }

  // 昵称与后续动作文案的间隙（模板换行被 Vue condense 吞掉，靠间距撑开）
  .like-user {
    margin-right: 4px;
  }

  .like-time {
    display: block;
    margin-top: 10px;
    font-size: 13px;
    color: var(--color-text-3);
  }

  // 收到的评论内容行：可换行的正文（区别于 like-text 的单行文案）
  .like-content {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 22px;
    color: var(--color-text-1);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .like-thumb {
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-sm);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }
}

.notice-head {
  display: flex;
  align-items: center;
  gap: 8px;

  .notice-badge {
    flex-shrink: 0;
    padding: 1px 8px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    line-height: 18px;

    // 通知=品牌蓝浅底；公告=橙色浅底
    &.is-info {
      background-color: var(--color-primary-light);
      color: var(--color-primary);
    }

    &.is-announce {
      background-color: rgba(230, 132, 41, 0.12);
      color: #e68429;
    }
  }

  .notice-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-1);
  }

  .notice-time {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-text-3);
  }
}

// 评论栏：文章标题链接（复用通知标题的排版），文章已删时降级灰字且不可点
.comment-article {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
  transition: color 0.2s ease;

  // 链接悬浮统一：主题色 + 下划线（与文章详情评论区一致）
  &:hover {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &.is-deleted {
    color: var(--color-text-3);
    font-weight: 400;
    cursor: default;

    &:hover {
      color: var(--color-text-3);
      text-decoration: none;
    }
  }
}

.comment-del {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background-color: transparent;
  font-size: 12px;
  color: var(--color-text-3);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover:not(:disabled) {
    color: #d1242f;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// 评论内容：普通文本即可（评论本身不支持 Markdown），回复行带内联标记
.comment-content {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  // 收起态：单行省略（掘金消息中心口径），展开后还原多行
  &.collapsed {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reply-mark {
    color: var(--color-primary);

    .reply-user {
      color: inherit;
      transition: color 0.2s ease;

      // 链接悬浮统一：下划线（偏移 2px）
      &:hover {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
  }
}

.notice-body {
  margin-top: 10px;

  // 卡片内 Markdown 不带纸面底色（github 主题深底色比卡片更深会形成色块），文字配色仍随站点主题
  :deep(.markdown-body) {
    background-color: transparent;
  }

  // 收起态：限高 + 底部渐隐提示还有内容
  &.collapsed {
    max-height: 72px;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
    mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
  }
}

.notice-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background-color: transparent;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;

  svg {
    transition: transform 0.2s ease;

    &.flip {
      transform: rotate(180deg);
    }
  }
}

// 分页器与最后一条目之间的间距（条目自带 border-top 充当分隔线）
.notice-main :deep(.pager) {
  padding: 14px 0 16px;
}

// 窄屏：左菜单变横向滚动条
@media (max-width: 768px) {
  .notice-panel {
    flex-direction: column;
  }

  .notice-menu {
    width: 100%;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 8px;

    .menu-item {
      width: auto;
      flex-shrink: 0;
      white-space: nowrap;
    }
  }
}
</style>
