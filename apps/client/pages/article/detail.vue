<!-- 文章详情页：Markdown 正文+左侧悬浮工具栏+右侧作者卡/目录/相关推荐（窄屏隐藏）；编辑/删除仅作者本人可见，删除二次确认后回首页；useSeoMeta+Article 结构化数据；文章不存在或已下架显示空态 -->
<template>
  <div class="detail">
    <!-- 左侧悬浮工具栏：fixed 挂视口，不占布局宽度 -->
    <ArticleActionBar :liked="liked" :like-num="likeCount" :comment-num="commentCount" @like="onLike" @comment="scrollToComments" />
    <template v-if="article.title || article.content">
      <div class="detail-layout">
        <article class="panel">
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

          <!-- 评论区：guest 列表公开；登录后可发表/删除自己的评论，工具栏评论按钮滚动到此处 -->
          <div ref="commentSectionRef" class="comment-section">
            <h3 class="comment-title">评论 <span class="comment-count">{{ commentCount }}</span></h3>

            <div v-if="isLoggedIn" class="comment-editor">
              <div v-if="replyTo" class="reply-banner">
                回复 @{{ replyTo.userInfo?.nickName || '用户' }}
                <button class="reply-cancel" type="button" @click="cancelReply">取消</button>
              </div>
              <textarea
                v-model="commentDraft"
                class="comment-input"
                maxlength="500"
                :placeholder="replyTo ? `回复 @${replyTo.userInfo?.nickName || '用户'}（1-500 字）` : '写下你的评论（1-500 字）'"
                rows="3"
              ></textarea>
              <div class="comment-editor-actions">
                <span class="comment-hint">{{ commentDraft.length }}/500</span>
                <button class="comment-submit" type="button" :disabled="commentBusy || !commentDraft.trim()" @click="submitComment">
                  {{ commentBusy ? '发布中…' : '发布' }}
                </button>
              </div>
            </div>
            <div v-else class="comment-login">
              <span>登录后即可发表评论</span>
              <button class="comment-submit" type="button" @click="openLogin">去登录</button>
            </div>

            <div v-if="comments.length" class="comment-list">
              <div v-for="item in comments" :key="item.id" class="comment-item">
                <span class="comment-avatar">
                  <img v-if="item.userInfo?.avatar" :src="toCoverUrl(config.public.apiBase, item.userInfo.avatar)" :alt="item.userInfo.nickName" loading="lazy" />
                  <span v-else class="avatar-fallback">{{ (item.userInfo?.nickName || '游').slice(0, 1) }}</span>
                </span>
                <div class="comment-main">
                  <div class="comment-meta">
                    <span class="comment-author">{{ item.userInfo?.nickName || '用户' }}</span>
                    <span class="comment-time">{{ formatDateTime(item.createTime, 'YYYY-MM-DD HH:mm') }}</span>
                  </div>
                  <p class="comment-content">
                    <span v-if="item.replyNickName" class="comment-reply-tag">回复 @{{ item.replyNickName }}：</span>{{ item.content }}
                  </p>
                </div>
                <div class="comment-actions">
                  <button v-if="isLoggedIn" class="comment-reply-btn" type="button" @click="startReply(item)">回复</button>
                  <button
                    v-if="user?.userId && item.userId === user.userId"
                    class="comment-del"
                    type="button"
                    :disabled="commentDeletingId === item.id"
                    @click="removeComment(item)"
                  >
                    删除
                  </button>
                </div>
              </div>
              <div v-if="comments.length < commentTotal" class="comment-more">
                <button class="comment-more-btn" type="button" :disabled="commentLoading" @click="loadMoreComments">
                  {{ commentLoading ? '加载中…' : '加载更多评论' }}
                </button>
              </div>
            </div>
            <CommonEmptyState v-else-if="!commentLoading" text="还没有评论，来抢沙发" />
          </div>
        </article>

        <!-- 右侧信息栏：作者卡 + 目录 + 相关推荐（吸顶跟随，窄屏隐藏） -->
        <aside v-if="hasToc || article.userInfo?.userId || article.subjectId" class="toc-aside">
          <ArticleAuthorCard v-if="article.userInfo?.userId" :author="article.userInfo" />
          <ArticleToc v-if="hasToc" :content="article.content" />
          <ArticleRelatedCard :subject-id="article.subjectId" :exclude-id="article.id" />
        </aside>
      </div>
    </template>
    <div v-else class="panel panel-empty">
      <CommonEmptyState>文章不存在或已下架</CommonEmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDateTime } from '@nest-acticle/utils'
import type { Article, CommentItem, Subject } from '@nest-acticle/shared'

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
const readLabel = computed(() => (typeof article.value.readNum === 'number' ? String(article.value.readNum) : ''))
const likeCount = computed(() => (typeof article.value.likeNum === 'number' ? article.value.likeNum : 0))
const commentCount = computed(() => (typeof article.value.commentNum === 'number' ? article.value.commentNum : 0))

// ---------- 点赞：登录态下查询/切换，未登录点击引导登录 ----------
const { isLoggedIn } = useUser()
const { openLogin } = useAuthModal()
const { fetchLikeStatus, likeArticle, unlikeArticle } = useLike()
const liked = ref(false)
const likeBusy = ref(false)

const syncLikeStatus = () => {
  if (isLoggedIn.value && article.value.id) {
    fetchLikeStatus(article.value.id)
      .then((value) => (liked.value = value))
      .catch(() => {})
  } else {
    liked.value = false
  }
}

// 点赞状态依赖 token，详情页 SSR 只出公共数据，状态在客户端补查
onMounted(syncLikeStatus)
watch(isLoggedIn, syncLikeStatus)

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
  likeBusy.value = true
  try {
    const result = liked.value ? await unlikeArticle(id) : await likeArticle(id)
    if (result) {
      liked.value = result.liked
      if (typeof result.likeNum === 'number') {
        article.value.likeNum = result.likeNum
      }
    }
  } catch (error: any) {
    showToast(error?.message || '点赞失败，请稍后再试', 'error')
  } finally {
    likeBusy.value = false
  }
}

// ---------- 评论区：guest 列表公开；发表/删除自己的评论要求登录 ----------
const { fetchComments, addComment, deleteComment } = useComment()
const comments = ref<CommentItem[]>([])
const commentTotal = ref(0)
const commentPageNum = ref(1)
const commentLoading = ref(false)
const commentDraft = ref('')
const commentBusy = ref(false)
const commentDeletingId = ref<number | null>(null)
const commentSectionRef = ref<HTMLElement | null>(null)
// 回复目标：非空时编辑器处于回复模式，提交携带 parentId（服务端校验同文章且存在）
const replyTo = ref<CommentItem | null>(null)

const startReply = (item: CommentItem) => {
  replyTo.value = item
  const input = document.querySelector('.comment-input') as HTMLTextAreaElement | null
  input?.focus()
}

const cancelReply = () => {
  replyTo.value = null
}

const loadComments = async (page = 1) => {
  const id = article.value.id
  if (!id) {
    return
  }
  commentLoading.value = true
  try {
    const data = await fetchComments(id, { pageNum: page, pageSize: 10 })
    if (page === 1) {
      comments.value = data.list || []
    } else {
      comments.value = [...comments.value, ...(data.list || [])]
    }
    commentTotal.value = data.total || 0
    commentPageNum.value = page
  } catch {
    if (page === 1) {
      comments.value = []
    }
  } finally {
    commentLoading.value = false
  }
}

const loadMoreComments = () => loadComments(commentPageNum.value + 1)

// 评论列表依赖文章 id：SSR 首包后客户端补查，文章切换时重拉
onMounted(() => {
  if (article.value.id) {
    loadComments(1)
  }
})
watch(
  () => article.value.id,
  (id) => {
    if (id) {
      loadComments(1)
    }
  }
)

const submitComment = async () => {
  const content = commentDraft.value.trim()
  if (!content || commentBusy.value) {
    return
  }
  const id = article.value.id
  if (!id) {
    return
  }
  commentBusy.value = true
  try {
    const created = await addComment(id, content, replyTo.value?.id ?? undefined)
    if (created) {
      // 列表为最新在前，新评论（含回复）插到头部并同步计数
      comments.value = [created, ...comments.value]
      commentTotal.value += 1
      if (typeof article.value.commentNum === 'number') {
        article.value.commentNum += 1
      }
      commentDraft.value = ''
      cancelReply()
      showToast('评论发布成功', 'success')
    }
  } catch (error: any) {
    showToast(error?.message || '评论发布失败，请稍后再试', 'error')
  } finally {
    commentBusy.value = false
  }
}

const removeComment = async (item: CommentItem) => {
  if (commentDeletingId.value) {
    return
  }
  const confirmed = await confirmAction({
    title: '删除评论',
    message: '确定删除这条评论吗？',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) {
    return
  }
  commentDeletingId.value = item.id
  try {
    await deleteComment(item.id)
    comments.value = comments.value.filter((c) => c.id !== item.id)
    commentTotal.value = Math.max(0, commentTotal.value - 1)
    if (typeof article.value.commentNum === 'number') {
      article.value.commentNum = Math.max(0, article.value.commentNum - 1)
    }
    // 回复目标被删除（含级联删掉的回复）时退出回复模式
    if (replyTo.value && !comments.value.some((c) => c.id === replyTo.value!.id)) {
      cancelReply()
    }
    showToast('评论已删除', 'success')
  } catch (error: any) {
    showToast(error?.message || '删除失败，请稍后再试', 'error')
  } finally {
    commentDeletingId.value = null
  }
}

// 工具栏评论按钮：滚动定位到评论区
const scrollToComments = () => {
  commentSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 编辑/删除入口：仅当前登录用户是文章作者时可见
const { user, fetchUserInfo } = useUser()
const canEdit = computed(
  () => !!user.value?.userId && !!article.value.userInfo?.userId && user.value.userId === article.value.userInfo.userId
)
const goEdit = () => navigateTo({ path: '/editor/new', query: { id: String(article.value.id || '') } })

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

// 登录态恢复（编辑按钮依赖 user.userId 比对）
onMounted(() => {
  if (getToken() && !user.value) {
    fetchUserInfo().catch(() => {})
  }
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
.detail-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
}

.panel {
  flex: 1;
  min-width: 0;
  max-width: 820px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 36px 44px;

  &.panel-empty {
    padding: 0;
  }
}

// 右侧信息栏：作者卡 + 目录，吸顶跟随，窄屏隐藏
.toc-aside {
  position: sticky;
  top: 76px;
  flex-shrink: 0;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

@media (max-width: 1000px) {
  .toc-aside {
    display: none;
  }
}

@media (max-width: 640px) {
  .panel {
    padding: 24px 20px;
  }

  .title {
    font-size: 22px;
  }

  .meta-line .meta-subject {
    display: none;
  }
}

// 评论区：正文下方独立区块，依赖面板底色与分隔线 token
.comment-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border-light);

  .comment-title {
    margin: 0 0 16px;
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-1);

    .comment-count {
      font-size: 14px;
      font-weight: 400;
      color: var(--color-text-3);
      margin-left: 4px;
    }
  }

  .comment-editor {
    margin-bottom: 20px;

    .reply-banner {
      margin-bottom: 8px;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: var(--radius-sm);
      background-color: var(--color-primary-light);
      font-size: 13px;
      color: var(--color-primary);

      .reply-cancel {
        padding: 0;
        border: 0;
        background-color: transparent;
        font-size: 12px;
        color: var(--color-text-3);
        cursor: pointer;

        &:hover {
          color: var(--color-text-1);
        }
      }
    }

    .comment-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
      font-size: 13px;
      line-height: 20px;
      color: var(--color-text-1);
      resize: vertical;
      outline: none;
      transition: border-color 0.2s ease;

      &:focus {
        border-color: var(--color-primary);
      }
    }

    .comment-editor-actions {
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;

      .comment-hint {
        font-size: 12px;
        color: var(--color-text-3);
      }
    }
  }

  .comment-login {
    margin-bottom: 20px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px dashed var(--color-border-light);
    border-radius: var(--radius-sm);
    font-size: 13px;
    color: var(--color-text-2);
  }

  .comment-submit {
    padding: 6px 16px;
    border: 0;
    border-radius: var(--radius-sm);
    background-image: var(--gradient-brand);
    font-size: 13px;
    color: #fff;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .comment-list {
    .comment-item {
      display: flex;
      gap: 12px;
      padding: 14px 0;

      &:not(:last-child) {
        border-bottom: 1px solid var(--color-border-light);
      }

      .comment-avatar {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        line-height: 0;

        img {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          object-fit: cover;
        }

        .avatar-fallback {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          background-image: var(--gradient-brand);
          font-size: 14px;
          color: #fff;
        }
      }

      .comment-main {
        flex: 1;
        min-width: 0;

        .comment-meta {
          display: flex;
          align-items: center;
          gap: 10px;

          .comment-author {
            font-size: 13px;
            font-weight: 500;
            color: var(--color-text-1);
          }

          .comment-time {
            font-size: 12px;
            color: var(--color-text-3);
          }
        }

        .comment-content {
          margin: 6px 0 0;
          font-size: 14px;
          line-height: 22px;
          color: var(--color-text-1);
          white-space: pre-wrap;
          overflow-wrap: anywhere;

          .comment-reply-tag {
            color: var(--color-primary);
          }
        }
      }

      .comment-actions {
        flex-shrink: 0;
        align-self: flex-start;
        display: flex;
        gap: 10px;

        .comment-reply-btn {
          padding: 0;
          border: 0;
          background-color: transparent;
          font-size: 12px;
          color: var(--color-text-3);
          cursor: pointer;
          transition: color 0.2s ease;

          &:hover {
            color: var(--color-primary);
          }
        }
      }

      .comment-del {
        flex-shrink: 0;
        align-self: flex-start;
        padding: 0;
        border: 0;
        background-color: transparent;
        font-size: 12px;
        color: var(--color-text-3);
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover {
          color: #d1242f;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    .comment-more {
      padding: 14px 0 4px;
      text-align: center;

      .comment-more-btn {
        padding: 6px 20px;
        border: 1px solid var(--color-border-light);
        border-radius: var(--radius-sm);
        background-color: transparent;
        font-size: 13px;
        color: var(--color-text-2);
        cursor: pointer;
        transition:
          color 0.2s ease,
          border-color 0.2s ease;

        &:hover {
          color: var(--color-primary);
          border-color: var(--color-primary);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }
}
</style>
