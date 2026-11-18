<!-- 信息流文章条目卡（首页/专栏详情/个人空间共用）：文字为主+右侧缩略图（无封面不渲染）；行数据契约见 @nest-acticle/shared 的 Article -->
<template>
  <article class="article-item" :title="title">
    <div class="body">
      <h3 class="title">{{ title }}</h3>
      <p v-if="remark" class="remark">{{ remark }}</p>
      <div class="meta">
        <span v-if="author">{{ author }}</span>
        <span v-if="publishTime">{{ publishTime }}</span>
        <span v-if="readLabel">{{ readLabel }}</span>
      </div>
    </div>

    <div v-if="cover" class="thumb">
      <img :src="coverUrl" :alt="title" loading="lazy" />
    </div>
  </article>
</template>

<script setup lang="ts">
import { formatDateTime } from '@nest-acticle/utils'
import type { Article } from '@nest-acticle/shared'

const props = withDefaults(
  defineProps<{
    cardInfo?: Article
  }>(),
  {
    cardInfo: () => ({})
  }
)

const config = useRuntimeConfig()

const title = computed(() => props.cardInfo?.title || '无标题')
const cover = computed(() => props.cardInfo?.cover || '')
const coverUrl = computed(() => toCoverUrl(config.public.apiBase, cover.value))
const remark = computed(() => props.cardInfo?.desc || '')
const author = computed(() => props.cardInfo?.author || '')
const readLabel = computed(() => {
  const read = props.cardInfo?.readNum
  return read ? `${read} 阅读` : ''
})

const publishTime = computed(() => {
  // 已发布文章优先发布时间，未发布回退创建时间
  return formatDateTime(props.cardInfo?.publishTime || props.cardInfo?.createTime, 'YYYY-MM-DD HH:mm')
})
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
      gap: 4px 16px;
      font-size: 13px;
      color: var(--color-text-3);
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
