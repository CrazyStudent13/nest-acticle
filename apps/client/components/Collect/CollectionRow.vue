<!-- 收藏集横向行卡（个人空间收藏集栏共用）：名称+私密锁/简介/更新时间·文章数·订阅数，
     跳详情由外层点击绑定（掘金收藏集栏同款布局，无封面） -->
<template>
  <article class="collection-row">
    <div class="body">
      <h3 class="title">
        {{ name }}
        <!-- 私密集锁标：仅本人视角出现（他人空间不返回私密集） -->
        <svg v-if="isPrivate" class="lock-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </h3>
      <p v-if="desc" class="desc">{{ desc }}</p>
      <div class="meta">
        <span v-if="updateTime">{{ updateTime }} 更新</span>
        <span>{{ articleCount }}篇文章</span>
        <span>{{ subscriberCount }}订阅</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { formatDate } from '@nest-acticle/utils'
import type { Collection } from '@nest-acticle/shared'

const props = withDefaults(
  defineProps<{
    collectionInfo?: Collection
  }>(),
  {
    collectionInfo: () => ({})
  }
)

const name = computed(() => props.collectionInfo?.name || '未命名收藏集')
const desc = computed(() => props.collectionInfo?.desc || '')
const isPrivate = computed(() => props.collectionInfo?.visibility === '1')
const articleCount = computed(() => props.collectionInfo?.articleCount ?? 0)
const subscriberCount = computed(() => props.collectionInfo?.subscriberCount ?? 0)

// 掘金收藏集栏展示「更新时间」：最近一次收录/编辑动态
const updateTime = computed(() => formatDate(props.collectionInfo?.updateTime))
</script>

<style lang="less" scoped>
// 掘金收藏集栏同款行布局：信息左对齐无封面，行间分隔线
.collection-row {
  padding: 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border-light);
  }

  &:hover {
    background-color: var(--color-bg);

    .title {
      color: var(--color-primary);
    }
  }

  .body {
    min-width: 0;

    .title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 17px;
      font-weight: 600;
      line-height: 24px;
      color: var(--color-text-1);
      transition: color 0.2s ease;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;

      .lock-icon {
        flex-shrink: 0;
        color: var(--color-text-3);
      }
    }

    .desc {
      margin-top: 6px;
      font-size: 14px;
      line-height: 22px;
      color: var(--color-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: 13px;
      color: var(--color-text-3);
    }
  }
}
</style>
