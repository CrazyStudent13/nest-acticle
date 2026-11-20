<!-- 编辑器顶栏草稿箱：按钮+弹出列表（当前草稿高亮/悬浮删除/空态文案）。数据与动作由页面侧 useDraftBox
     经 props/emits 对接（列表按 userId 过滤、载入写回编辑器、删除持久化都在 composable），显隐 v-model:open -->
<template>
  <div class="draft-wrap">
    <button class="draft-btn" type="button" @click="open = !open">
      草稿箱<span v-if="drafts.length" class="draft-count">{{ drafts.length }}</span>
    </button>
    <div v-if="open" class="draft-panel">
      <template v-if="drafts.length">
        <div
          v-for="item in drafts"
          :key="item.id"
          class="draft-item"
          :class="{ current: item.id === currentId }"
          @click="emit('load', item)"
        >
          <span class="draft-item-title">{{ item.title || '无标题' }}</span>
          <span class="draft-item-time">{{ formatDraftTime(item.updateTime) }}</span>
          <button class="draft-item-del" type="button" title="删除草稿" @click.stop="emit('remove', item)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6H4V4h4V4a1 1 0 0 1 1-1zm1 2v1h4V5h-4zM7 6v14h10V6H7zm2 2h2v10H9V8zm4 0h2v10h-2V8z" />
            </svg>
          </button>
        </div>
      </template>
      <p v-else class="draft-empty">暂无草稿，内容会自动保存到这里</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { DraftItem } from '~/composables/useDraftBox'

defineProps<{
  // 当前用户的草稿列表（useDraftBox.myDrafts）
  drafts: DraftItem[]
  // 当前正在编辑的草稿 id（列表高亮 current）
  currentId: string
}>()

const emit = defineEmits<{
  // 载入草稿到编辑器
  (e: 'load', item: DraftItem): void
  // 删除草稿
  (e: 'remove', item: DraftItem): void
}>()

// 显隐双向绑定：按钮切换 / 点击面板外关闭（useDraftBox 内监听）/ ?drafts=1 自动展开
const open = defineModel<boolean>('open', { default: false })

const formatDraftTime = (time: number) => dayjs(time).format('MM-DD HH:mm')
</script>

<style lang="less" scoped>
.draft-wrap {
  position: relative;
  flex-shrink: 0;
}

.draft-btn {
  padding: 5px 14px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background-color: transparent;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background-color: var(--color-primary-light);
  }

  .draft-count {
    margin-left: 4px;
  }
}

.draft-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 300px;
  max-height: 360px;
  overflow-y: auto;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  z-index: 20;

  .draft-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    cursor: pointer;
    border-bottom: 1px solid var(--color-border-light);
    transition: background-color 0.15s ease;

    &:hover {
      background-color: var(--color-bg);
    }

    &.current {
      .draft-item-title {
        color: var(--color-primary);
      }
    }

    .draft-item-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      color: var(--color-text-1);
    }

    .draft-item-time {
      flex-shrink: 0;
      font-size: 12px;
      color: var(--color-text-3);
    }

    .draft-item-del {
      flex-shrink: 0;
      display: flex;
      padding: 2px;
      border: 0;
      background-color: transparent;
      color: var(--color-text-3);
      cursor: pointer;
      transition: color 0.15s ease;

      &:hover {
        color: #d1242f;
      }
    }
  }

  .draft-empty {
    padding: 24px 14px;
    font-size: 12px;
    color: var(--color-text-3);
    text-align: center;
  }
}
</style>
