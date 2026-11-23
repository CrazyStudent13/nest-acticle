<!-- 收藏集横向行卡（个人空间收藏集栏共用）：名称+私密锁/默认标/简介/更新时间·文章数·订阅数，
     本人视角行尾悬浮「编辑/删除」（默认夹不可删，不显示删除入口）；跳详情由外层点击绑定（掘金收藏集栏同款布局，无封面） -->
<template>
  <article class="collection-row">
    <div class="body">
      <h3 class="title">
        {{ name }}
        <!-- 默认收藏夹标：每用户初始自带、不可删除 -->
        <span v-if="isDefault" class="default-badge">默认</span>
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

    <!-- 本人整理视角：悬浮显示行内操作（默认夹不显示删除入口，后端同样拦截） -->
    <div v-if="mine" class="row-actions" @click.stop>
      <button class="row-btn" type="button" @click="emit('edit')">编辑</button>
      <button v-if="!isDefault" class="row-btn row-btn--danger" type="button" @click="emit('remove')">删除</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { formatDate } from '@nest-acticle/utils'
import type { Collection } from '@nest-acticle/shared'

const props = withDefaults(
  defineProps<{
    collectionInfo?: Collection
    /** 是否当前登录人自己的收藏集（决定行内编辑/删除操作是否显示） */
    mine?: boolean
  }>(),
  {
    collectionInfo: () => ({}),
    mine: false
  }
)

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'remove'): void
}>()

const name = computed(() => props.collectionInfo?.name || '未命名收藏集')
const desc = computed(() => props.collectionInfo?.desc || '')
const isPrivate = computed(() => props.collectionInfo?.visibility === '1')
const isDefault = computed(() => !!props.collectionInfo?.isDefault)
const articleCount = computed(() => props.collectionInfo?.articleCount ?? 0)
const subscriberCount = computed(() => props.collectionInfo?.subscriberCount ?? 0)

// 掘金收藏集栏展示「更新时间」：最近一次收录/编辑动态
const updateTime = computed(() => formatDate(props.collectionInfo?.updateTime))
</script>

<style lang="less" scoped>
// 掘金收藏集栏同款行布局：信息左对齐无封面，行间分隔线
.collection-row {
  display: flex;
  align-items: center;
  gap: 16px;
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

    .row-actions {
      opacity: 1;
    }
  }

  .body {
    flex: 1;
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

      .default-badge {
        flex-shrink: 0;
        padding: 1px 8px;
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-full);
        font-size: 11px;
        font-weight: 400;
        line-height: 16px;
        color: var(--color-primary);
      }

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

  .row-actions {
    flex-shrink: 0;
    display: flex;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;

    .row-btn {
      padding: 5px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface);
      font-size: 12px;
      color: var(--color-text-2);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        color 0.2s ease;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      &.row-btn--danger:hover {
        border-color: #d1242f;
        color: #d1242f;
      }
    }
  }
}

@media (max-width: 640px) {
  .collection-row .row-actions {
    opacity: 1;
  }
}
</style>

