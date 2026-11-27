<!-- 信息流文章条目卡（首页/专栏详情/个人空间共用）：文字为主+右侧缩略图（无封面不渲染）；行数据契约见 @nest-acticle/shared 的 Article -->
<template>
  <article class="article-item" :title="title">
    <div class="body">
      <h3 class="title">
        <span v-if="sourceLabel" class="source-tag" :class="`source-${cardInfo.source}`">{{ sourceLabel }}</span>{{ title }}
        <!-- 已下架标：仅本人视角的空间文章列表会出现（服务端对访客不下发下架行），信息流场景恒不渲染 -->
        <span v-if="offline" class="offline-tag">已下架</span>
      </h3>
      <p v-if="remark" class="remark">{{ remark }}</p>
      <div class="meta">
        <template v-if="showAuthor">
          <ArticleAuthorHoverCard
            v-if="authorUserId"
            :user-id="authorUserId"
            :nick-name="authorName"
            :avatar="authorAvatar"
          />
          <span v-else-if="authorName">{{ authorName }}</span>
        </template>
        <span v-if="relativeTime" :title="publishTime">{{ relativeTime }}</span>
        <span class="meta-stat" title="阅读">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {{ readNum }}
        </span>
        <button
          type="button"
          class="meta-stat meta-action"
          :class="{ 'is-liked': liked }"
          :title="liked ? '取消点赞' : '点赞'"
          :aria-label="liked ? '取消点赞' : '点赞'"
          @click.stop="onLikeClick"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
          {{ likeNum }}
        </button>
        <button
          type="button"
          class="meta-stat meta-action"
          title="查看评论"
          aria-label="查看评论"
          @click.stop="goComments"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {{ commentNum }}
        </button>
      </div>
    </div>

    <div v-if="cover" class="thumb">
      <img :src="coverUrl" :alt="title" loading="lazy" />
    </div>
  </article>
</template>

<script setup lang="ts">
import { formatDateTime, formatRelativeTime } from '@nest-acticle/utils'
import type { Article } from '@nest-acticle/shared'
import { getArticleSourceLabel } from '~/utils/articleSource'

const props = withDefaults(
  defineProps<{
    cardInfo?: Article
    /** 是否展示作者：个人空间的文章栏（全是空间主人文章）传 false，信息流/专栏/收藏集默认展示 */
    showAuthor?: boolean
  }>(),
  {
    cardInfo: () => ({}),
    showAuthor: true
  }
)

const config = useRuntimeConfig()

const title = computed(() => props.cardInfo?.title || '无标题')
// 文章类型标（原创/转载/翻译/整理），与详情页同源文案
const sourceLabel = computed(() => getArticleSourceLabel(props.cardInfo?.source))
// 已下架行标（本人空间可见性口径，publishStatus='3' 才下发到前端）
const offline = computed(() => props.cardInfo?.publishStatus === '3')
const cover = computed(() => props.cardInfo?.cover || '')
const coverUrl = computed(() => toCoverUrl(config.public.apiBase, cover.value))
const remark = computed(() => props.cardInfo?.desc || '')
// 作者展示：优先列表端点挂载的 userInfo（含 userId/头像，供悬浮卡使用），无则回退冗余昵称列
const authorUserId = computed(() => props.cardInfo?.userInfo?.userId || props.cardInfo?.userId || 0)
const authorName = computed(() => props.cardInfo?.userInfo?.nickName || props.cardInfo?.author || '')
const authorAvatar = computed(() => props.cardInfo?.userInfo?.avatar || '')
// 三项互动计数：图标 + 数值常显（新文章为 0），与详情页图标口径一致
const readNum = computed(() => props.cardInfo?.readNum || 0)
const commentNum = computed(() => props.cardInfo?.commentNum || 0)
const articleId = computed(() => (props.cardInfo?.id ? String(props.cardInfo.id) : ''))

// 列表内点赞：接口幂等，首次点击只会「点赞」；已点过（本地态）再点则取消，数值乐观更新后以服务端校准
const { isLoggedIn } = useUser()
const { openLogin } = useAuthModal()
const { likeArticle, unlikeArticle } = useLike()
const liked = ref(false)
const likeBusy = ref(false)
const likeCountLocal = ref<number | null>(null)
const likeNum = computed(() => likeCountLocal.value ?? (props.cardInfo?.likeNum || 0))

const onLikeClick = async () => {
  if (likeBusy.value || !articleId.value) {
    return
  }
  if (!isLoggedIn.value) {
    openLogin()
    return
  }
  likeBusy.value = true
  const wasLiked = liked.value
  const prevCount = likeNum.value
  liked.value = !wasLiked
  likeCountLocal.value = Math.max(0, prevCount + (wasLiked ? -1 : 1))
  try {
    const result = wasLiked ? await unlikeArticle(articleId.value) : await likeArticle(articleId.value)
    if (result) {
      liked.value = result.liked
      if (typeof result.likeNum === 'number') {
        likeCountLocal.value = result.likeNum
      }
    }
  } catch (error: any) {
    liked.value = wasLiked
    likeCountLocal.value = prevCount
    showToast(error?.message || '点赞失败，请稍后再试', 'error')
  } finally {
    likeBusy.value = false
  }
}

// 评论图标直达详情页评论区（复用详情页的滚动定位）
const goComments = () => {
  if (!articleId.value) {
    return
  }
  navigateTo({ path: '/article/detail', query: { id: articleId.value, comment: '1' } })
}

// 列表时间走相对口径（刚刚/N分钟前/N小时前/N天前，与评论/通知一致），完整时刻放 title 悬浮查看
const rawTime = computed(() => props.cardInfo?.publishTime || props.cardInfo?.createTime)
const publishTime = computed(() => formatDateTime(rawTime.value, 'YYYY-MM-DD HH:mm'))
const relativeTime = computed(() => formatRelativeTime(rawTime.value))
</script>

<style lang="less" scoped>
// 掘金风格信息流条目：文字为主，缩略图靠右，依赖外层 .feed-panel 提供底色和分隔线
.article-item {
  display: flex;
  gap: 20px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--color-bg);

    .title {
      color: var(--color-primary);
    }
  }

  .body {
    flex: 1;
    min-width: 0;

    .title {
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
      color: var(--color-text-1);
      transition: color 0.2s ease;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;

      // 文章类型标：按来源区分配色（原创蓝/转载橙/翻译绿/整理紫），与详情页一致
      .source-tag {
        display: inline-block;
        margin-right: 6px;
        padding: 0 6px;
        border-radius: var(--radius-sm);
        font-size: 11px;
        font-weight: 400;
        line-height: 18px;
        vertical-align: 2px;

        &.source-0 {
          color: var(--color-primary);
          background-color: var(--color-primary-light);
        }

        &.source-1 {
          color: #e6832d;
          background-color: rgba(230, 131, 45, 0.12);
        }

        &.source-2 {
          color: #3fb060;
          background-color: rgba(63, 176, 96, 0.12);
        }

        &.source-3 {
          color: #7c5cff;
          background-color: rgba(124, 92, 255, 0.12);
        }
      }

      // 已下架行标：红字小标（仅本人空间列表出现）
      .offline-tag {
        display: inline-block;
        margin-left: 6px;
        padding: 0 6px;
        border-radius: var(--radius-sm);
        background-color: rgba(240, 65, 66, 0.08);
        font-size: 11px;
        font-weight: 400;
        line-height: 18px;
        color: #d1242f;
        vertical-align: 2px;
      }
    }

    .remark {
      margin-top: 6px;
      font-size: 13px;
      line-height: 22px;
      color: var(--color-text-2);
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
    }

    .meta {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 16px;
      font-size: 13px;
      color: var(--color-text-3);

      .meta-stat {
        display: inline-flex;
        align-items: center;
        gap: 4px;

        svg {
          flex-shrink: 0;
        }
      }

      // 可点击的互动项：抹平 button 默认样式，悬浮/已点赞时跟随品牌色
      .meta-action {
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: inherit;
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover,
        &.is-liked {
          color: var(--color-primary);
        }
      }
    }
  }

  .thumb {
    flex-shrink: 0;
    align-self: center;
    width: 112px;
    height: 76px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background-color: var(--color-bg);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
