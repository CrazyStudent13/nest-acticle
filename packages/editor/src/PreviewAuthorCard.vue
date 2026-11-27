<!-- 预览右栏作者卡（共享）：头像 + 昵称 + 文章/阅读/获赞三栏统计。
     数据由宿主注入（client 取登录用户与 guest 统计，admin 取文章作者与 guest 统计），
     样式与前台作者卡一致；href 为空时作者区不可跳转（admin 无前台空间路由）。 -->
<template>
  <div class="na-preview-author">
    <component
      :is="href ? 'a' : 'div'"
      class="na-preview-author-link"
      :href="href || undefined"
      :title="href ? `查看 ${authorName} 的空间` : undefined"
    >
      <span class="na-preview-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="authorName" />
        <span v-else class="na-preview-avatar-fallback">{{ authorName.slice(0, 1) }}</span>
      </span>
      <span class="na-preview-author-name">{{ authorName }}</span>
    </component>

    <div class="na-preview-stats">
      <div class="na-preview-stat">
        <span class="num">{{ displayStats.total }}</span>
        <span class="label">文章</span>
      </div>
      <div class="na-preview-stat">
        <span class="num">{{ displayStats.reads }}</span>
        <span class="label">阅读</span>
      </div>
      <div class="na-preview-stat">
        <span class="num">{{ displayStats.likes }}</span>
        <span class="label">获赞</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { PreviewAuthorStats } from './types';

const props = withDefaults(
  defineProps<{
    authorName?: string;
    avatarUrl?: string;
    /** 作者空间链接（client 传前台路由；admin 不传则仅展示） */
    href?: string;
    /** 统计；未传或加载中按 0 展示（与前台作者卡一致） */
    stats?: PreviewAuthorStats | null;
  }>(),
  {
    authorName: '佚名',
    avatarUrl: '',
    href: '',
    stats: null
  }
);

const authorName = computed(() => props.authorName || '佚名');
const displayStats = computed(() => props.stats || { total: 0, reads: 0, likes: 0 });
</script>

<style lang="less" scoped>
.na-preview-author {
  padding: 16px;
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border-light, #f0f1f3);
  border-radius: var(--radius-md, 12px);
}

.na-preview-author-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-decoration: none;
}

a.na-preview-author-link:hover .na-preview-author-name {
  color: var(--color-primary, #4f6bff);
}

.na-preview-avatar {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .na-preview-avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #fff;
    background-image: var(--gradient-brand, linear-gradient(135deg, #4f6bff 0%, #7c5cff 100%));
  }
}

.na-preview-author-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1, #1f2329);
  transition: color 0.2s ease;
}

.na-preview-stats {
  display: flex;
  margin-top: 14px;
}

.na-preview-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  .num {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-1, #1f2329);
  }

  .label {
    font-size: 12px;
    color: var(--color-text-3, #86909c);
  }
}
</style>