<!-- 文章详情页：Markdown 正文+左侧悬浮工具栏+右侧作者卡/目录/相关推荐（窄屏隐藏）；评论区收在 ArticleCommentSection 组件；编辑/删除仅作者本人可见，删除二次确认后回首页；useSeoMeta+Article 结构化数据；文章不存在或已下架显示空态 -->
<template>
  <div class="detail">
    <!-- 左侧悬浮工具栏：fixed 挂视口，不占布局宽度 -->
    <ArticleActionBar
      :liked="liked"
      :like-num="likeCount"
      :comment-num="commentCount"
      :collected="collected"
      :collect-num="collectCount"
      :can-report="canReport"
      :reported="reported"
      @like="onLike"
      @comment="scrollToComments"
      @collect="onCollect"
      @report="onReport"
    />
    <!-- 收藏弹窗：勾选收藏集（含行内新建），确认后回抛高亮与计数变化 -->
    <CollectModal v-if="collectOpen" :article-id="article.id || ''" @close="collectOpen = false" @done="onCollectDone" />
    <!-- 举报弹窗：文章/用户共用组件（post 口径），理由选项走字典；提交成功回写已举报置灰态 -->
    <ReportDialog
      v-if="reportOpen"
      target-type="post"
      :target-id="article.id || ''"
      :target-label="article.title"
      @close="reportOpen = false"
      @done="onReportDone"
    />
    <CommonReadingLayout :flush="!(article.title || article.content)">
      <template v-if="article.title || article.content">
        <!-- 已下架提示：仅作者本人与后台角色能到达这里（服务端对其他访客仍返回不存在） -->
        <div v-if="article.publishStatus === '3'" class="offline-banner">该文章已下架，仅作者与后台角色可见</div>
        <h1 class="title">{{ article.title || '无标题' }}</h1>

        <!-- 元信息行：作者 时间 阅读 专栏，编辑入口靠右（仅作者本人可见），掘金式单行 -->
        <div class="meta-line">
          <span class="meta-author">{{ authorName }}</span>
          <span v-if="publishLabel" class="meta-item">{{ publishLabel }}</span>
          <span v-if="readLabel" class="meta-item">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {{ readLabel }} 阅读
          </span>
          <NuxtLink
            v-if="subject.title && article.subjectId"
            class="meta-subject"
            target="_blank"
            :to="{ path: '/column/detail', query: { id: String(article.subjectId) } }"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {{ subject.title }}
          </NuxtLink>
          <span v-if="canEdit" class="meta-actions">
            <button class="edit-btn" type="button" @click="goEdit">编辑</button>
            <button class="del-btn" type="button" :disabled="deleting" @click="removeArticle">
              {{ deleting ? '删除中…' : '删除' }}
            </button>
          </span>
        </div>

        <img v-if="coverUrl" class="cover" :src="coverUrl" :alt="article.title" />

        <div class="panel-body">
          <MdViewer :value="article.content" />
        </div>

        <!-- 评论区：抽成组件（掘金式两级结构），计数增删由组件回抛，页面同步文章冗余计数；工具栏评论按钮滚动到此处 -->
        <ArticleCommentSection
          ref="commentSectionRef"
          :article-id="article.id || ''"
          :comment-num="commentCount"
          :author-user-id="article.userInfo?.userId"
          @update:comment-num="onCommentNumChange"
        />
      </template>
      <CommonEmptyState v-else>文章不存在或已下架</CommonEmptyState>

      <!-- 右侧信息栏：作者卡 + 目录 + 相关推荐（吸顶跟随，窄屏隐藏） -->
      <template v-if="hasToc || article.userInfo?.userId || article.subjectId" #aside>
        <ArticleAuthorCard v-if="article.userInfo?.userId" :author="article.userInfo" />
        <ArticleToc v-if="hasToc" :content="article.content" />
        <ArticleRelatedCard :subject-id="article.subjectId" :exclude-id="article.id" />
      </template>
    </CommonReadingLayout>
  </div>
</template>

<script setup lang="ts">
import { formatDateTime } from '@nest-acticle/utils'
import type { Article, Subject } from '@nest-acticle/shared'

const config = useRuntimeConfig()
const route = useRoute()
const articleId = computed(() => (route.query.id as string) || '')

const { data } = await useFetch<{ data?: Article | null }>(
  `${config.public.apiBase}/api/post/article/guest/detail`,
  {
    query: {
      id: articleId
    },
    default: () => ({ data: null })
  }
)

const article = computed(() => {
  const model = data.value?.data || {}

  return {
    ...model,
    title: model.title || '',
    content: model.content || '',
    publishTime: formatDateTime(model.publishTime, 'YYYY-MM-DD HH:mm'),
    createTime: formatDateTime(model.createTime, 'YYYY-MM-DD HH:mm'),
    // ISO 时间留给结构化数据与 og 元信息用
    isoTime: (model.publishTime || model.createTime) || undefined
  }
})

// 专栏信息：文章带 subjectId 时取标题做入口徽标（拿不到标题则不展示）
const { data: subjectRes } = await useFetch<{ data?: Subject | null }>(
  `${config.public.apiBase}/api/post/subject/guest/detail`,
  {
    query: computed(() => ({ id: String(article.value.subjectId || '') })),
    default: () => ({ data: null })
  }
)
const subject = computed(() => subjectRes.value?.data || {})

const authorName = computed(() => article.value.userInfo?.nickName || article.value.author || '佚名')
const coverUrl = computed(() => toCoverUrl(config.public.apiBase, article.value.cover))
// publishTime 常为 null，回退 createTime
const publishLabel = computed(() => article.value.publishTime || article.value.createTime)
// article 是 computed 拼装的普通对象，直接改它的字段不会触发视图更新；
// 计数以本地覆盖值优先，接口回写只改覆盖值
const readNumLocal = ref<number | null>(null)
const likeNumLocal = ref<number | null>(null)
const commentNumLocal = ref<number | null>(null)
const readCount = computed(() =>
  readNumLocal.value ?? (typeof article.value.readNum === 'number' ? article.value.readNum : 0)
)
const readLabel = computed(() => String(readCount.value))
const likeCount = computed(() =>
  likeNumLocal.value ?? (typeof article.value.likeNum === 'number' ? article.value.likeNum : 0)
)
const commentCount = computed(() =>
  commentNumLocal.value ?? (typeof article.value.commentNum === 'number' ? article.value.commentNum : 0)
)
const collectNumLocal = ref<number | null>(null)
const collectCount = computed(() =>
  collectNumLocal.value ?? (typeof article.value.collectNum === 'number' ? article.value.collectNum : 0)
)

// ---------- 阅读数：客户端上报一次，服务端原子自增；按文章+自然日去重，防刷新灌水 ----------
const READ_KEY_PREFIX = 'article-read:'

// 去重键按「文章 + 自然日」各存一条，隔日即失效：写入新键时顺带清掉非当日的旧键，
// 防每读一篇多一条、localStorage 无界累积（前缀只此一处使用，不会误伤其他键）
const sweepStaleReadKeys = (day: string) => {
  // 先收集再删：边遍历边删会让后续键位前移，漏扫
  const staleKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(READ_KEY_PREFIX) && !key.endsWith(`:${day}`)) {
      staleKeys.push(key)
    }
  }
  staleKeys.forEach((key) => localStorage.removeItem(key))
}

const recordRead = async () => {
  const id = article.value.id
  if (!id) {
    return
  }
  const now = new Date()
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  const storageKey = `${READ_KEY_PREFIX}${id}:${day}`
  if (localStorage.getItem(storageKey)) {
    return
  }
  try {
    const res = await apiFetch<{ readNum: number }>(`/api/post/article/guest/read/${id}`, { method: 'POST' })
    // 请求期间切到别的文章时不回写，避免把上一篇的计数记到当前文章
    if (article.value.id === id && typeof res.data?.readNum === 'number') {
      readNumLocal.value = res.data.readNum
    }
    localStorage.setItem(storageKey, '1')
    sweepStaleReadKeys(day)
  } catch {
    // 上报失败不阻塞阅读，下次进入再试
  }
}
onMounted(recordRead)

// ---------- 点赞：登录态下查询/切换，未登录点击引导登录 ----------
const { isLoggedIn } = useUser()
const { openLogin } = useAuthModal()
const { fetchLikeStatus, likeArticle, unlikeArticle } = useLike()
const liked = ref(false)
const likeBusy = ref(false)
// 文章切换时旧请求可能后到，序号保证只认最新一次查询
let likeSeq = 0

const syncLikeStatus = () => {
  const id = article.value.id
  const seq = ++likeSeq
  if (!isLoggedIn.value || !id) {
    liked.value = false
    return
  }
  fetchLikeStatus(id)
    .then((value) => {
      if (seq === likeSeq) {
        liked.value = value
      }
    })
    .catch(() => {})
}

// 点赞状态依赖 token，详情页 SSR 只出公共数据，状态在客户端补查；
// 相关推荐等同路由跳转会复用页面组件，文章 id 变了必须重查，否则沿上一篇的点赞态
onMounted(syncLikeStatus)
watch(isLoggedIn, syncLikeStatus)
watch(() => article.value.id, () => {
  readNumLocal.value = null
  likeNumLocal.value = null
  commentNumLocal.value = null
  collectNumLocal.value = null
  syncLikeStatus()
  syncCollectStatus()
  syncReportStatus()
  recordRead()
})

const onLike = async () => {
  if (likeBusy.value) {
    return
  }
  if (!isLoggedIn.value) {
    openLogin()
    return
  }
  const id = article.value.id
  if (!id) {
    return
  }
  // 作废在途的状态查询：点击发生在状态回包前时，旧结果不能覆盖这次点击
  ++likeSeq
  // 乐观更新：点击即翻转高亮并增减计数，请求返回后再以服务端结果校准，失败回滚
  const wasLiked = liked.value
  const prevCount = likeCount.value
  liked.value = !wasLiked
  likeNumLocal.value = Math.max(0, prevCount + (wasLiked ? -1 : 1))

  likeBusy.value = true
  try {
    const result = wasLiked ? await unlikeArticle(id) : await likeArticle(id)
    // 请求期间已切到别的文章时不回写，避免把上一篇的结果记到当前文章
    if (result && article.value.id === id) {
      liked.value = result.liked
      if (typeof result.likeNum === 'number') {
        likeNumLocal.value = result.likeNum
      }
    }
  } catch (error: any) {
    if (article.value.id === id) {
      liked.value = wasLiked
      likeNumLocal.value = prevCount
    }
    showToast(error?.message || '点赞失败，请稍后再试', 'error')
  } finally {
    likeBusy.value = false
  }
}

// ---------- 收藏：登录态下查询收藏集勾选态，未登录点击引导登录；弹窗确认后回抛状态 ----------
const { fetchCollectStatus } = useCollect()
const collected = ref(false)
const collectOpen = ref(false)
// 文章切换时旧请求可能后到，序号保证只认最新一次查询
let collectSeq = 0

const syncCollectStatus = () => {
  const id = article.value.id
  const seq = ++collectSeq
  if (!isLoggedIn.value || !id) {
    collected.value = false
    return
  }
  fetchCollectStatus(id)
    .then((list) => {
      if (seq === collectSeq) {
        collected.value = list.some((item) => item.collected)
      }
    })
    .catch(() => {})
}

const onCollect = () => {
  if (!isLoggedIn.value) {
    openLogin()
    return
  }
  collectOpen.value = true
}

const onCollectDone = (value: boolean, delta: number) => {
  collectOpen.value = false
  collected.value = value
  if (delta) {
    collectNumLocal.value = Math.max(0, collectCount.value + delta)
  }
}

// 收藏状态同样依赖 token 与文章 id，时机与点赞态补查一致
onMounted(syncCollectStatus)
watch(isLoggedIn, syncCollectStatus)

// ---------- 评论区：逻辑收进 ArticleCommentSection，页面只持有计数与滚动定位 ----------
const commentSectionRef = ref<{ $el?: HTMLElement | null } | null>(null)
const onCommentNumChange = (value: number) => {
  commentNumLocal.value = value
}

// 工具栏评论按钮：滚动定位到评论区
const scrollToComments = () => {
  commentSectionRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 编辑/删除入口：仅当前登录用户是文章作者时可见
const { user, ensureUserRestored } = useUser()
const canEdit = computed(
  () => !!user.value?.userId && !!article.value.userInfo?.userId && user.value.userId === article.value.userInfo.userId
)
const goEdit = () => navigateTo({ path: '/editor/new', query: { id: String(article.value.id || '') } })

// ---------- 举报：登录态下查询已举报态（登录/切文章后补查，时机同点赞态）；作者本人不显示入口（服务端亦拒绝自查举报），未登录点击引导登录；提交成功回写置灰态 ----------
const { fetchReportStatus } = useReport()
const reported = ref(false)
const reportOpen = ref(false)

const canReport = computed(() => !canEdit.value)

const syncReportStatus = () => {
  const id = article.value.id
  if (!isLoggedIn.value || !id) {
    reported.value = false
    return
  }
  fetchReportStatus('post', id)
    .then((value) => {
      // 文章切换时旧请求可能后到，只回写当前文章的结果
      if (value && article.value.id === id) {
        reported.value = value.reported
      }
    })
    .catch(() => {})
}

onMounted(syncReportStatus)
watch(isLoggedIn, syncReportStatus)

const onReport = () => {
  if (!isLoggedIn.value) {
    openLogin()
    return
  }
  if (!reported.value) {
    reportOpen.value = true
  }
}

const onReportDone = () => {
  reportOpen.value = false
  reported.value = true
  showToast('举报已提交，感谢你帮助维护社区环境', 'success')
}

// 删除后回首页（需 post:article:remove 权限，失败透传后端 msg）
const deleting = ref(false)
const removeArticle = async () => {
  const ok = await confirmAction({
    title: '删除文章',
    message: `确定删除「${article.value.title || '无标题'}」吗？删除后不可恢复。`,
    confirmText: '删除',
    danger: true
  })
  if (!ok) {
    return
  }
  deleting.value = true
  try {
    await apiFetch(`/api/post/article/${article.value.id}`, { method: 'DELETE' })
    return navigateTo('/')
  } catch (error: any) {
    showToast(error?.message || '删除失败，请稍后重试', 'error')
  } finally {
    deleting.value = false
  }
}

// 登录态恢复（编辑按钮依赖 user.userId 比对；逻辑在 useUser.ensureUserRestored，与 auth middleware 共用）
onMounted(() => {
  ensureUserRestored()
})

// 右侧目录开关：文章带标题大纲才展示
const hasToc = computed(() => extractMarkdownHeadings(article.value.content).length > 0)

useSeoMeta({
  title: () => (article.value.title ? `${article.value.title} - 游戏速递` : '文章详情 - 游戏速递'),
  ogTitle: () => article.value.title || '文章详情',
  ogType: 'article',
  articlePublishedTime: () => (article.value.isoTime as string | undefined) || undefined,
  description: () => article.value.desc || article.value.title || '游戏速递的文章详情页。',
  ogImage: () => coverUrl.value || undefined
})

// 结构化数据：搜索引擎富摘要
useHead(() => {
  if (!article.value.id) {
    return {}
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.value.title,
    description: article.value.desc || article.value.title,
    image: coverUrl.value || undefined,
    datePublished: article.value.isoTime,
    dateModified: article.value.createTime || undefined,
    author: {
      '@type': 'Person',
      name: authorName.value
    }
  }
  return {
    script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }]
  }
})
</script>

<style lang="less" scoped>
// 已下架横幅：红色浅底，仅作者/后台角色可见（服务端拦访客）
.offline-banner {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background-color: rgba(240, 65, 66, 0.08);
  font-size: 13px;
  line-height: 20px;
  color: #d1242f;
}

.title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-1);
  margin-bottom: 16px;
}

// 掘金式元信息行：纯文本+小图标，头像与统计归右侧作者卡
.meta-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding-bottom: 18px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 13px;
  color: var(--color-text-2);

  .meta-author {
    font-weight: 600;
    color: var(--color-text-1);
  }

  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-3);
  }

  .meta-subject {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-3);
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-primary);
    }
  }

  .meta-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 12px;

    .edit-btn,
    .del-btn {
      padding: 2px 4px;
      border: 0;
      background-color: transparent;
      font-size: 13px;
      cursor: pointer;
      transition: opacity 0.2s ease;

      &:hover:not(:disabled) {
        opacity: 0.75;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .edit-btn {
      color: var(--color-primary);
    }

    .del-btn {
      color: #d1242f;
    }
  }
}

.cover {
  width: 100%;
  max-height: 440px;
  object-fit: cover;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .title {
    font-size: 22px;
  }

  .meta-line .meta-subject {
    display: none;
  }
}
</style>
