<!-- 用户行卡（个人空间关注/粉丝栏共用）：头像+昵称+签名+粉丝数+三态关注按钮；
     跳空间由外层点击绑定（同收藏集行卡模式），行尾按钮不冒泡 -->
<template>
  <article class="follow-user-row">
    <span class="avatar">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="nickName" loading="lazy" />
      <span v-else class="avatar-fallback">{{ nickName.slice(0, 1) }}</span>
    </span>
    <div class="body">
      <h3 class="name">{{ nickName }}</h3>
      <p class="signature">{{ signature }}</p>
    </div>
    <div class="row-side">
      <span class="fans">{{ fanNum }} 粉丝</span>
      <!-- 自己的行不显示关注按钮（无法关注自己，避免无效入口） -->
      <FollowButton v-if="!isSelfRow" :target-user-id="userId" :state="userInfo.followState" size="small" @change="onChange" />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { FollowUserItem, ViewerFollowState } from '@nest-acticle/shared'

const props = withDefaults(
  defineProps<{
    userInfo?: FollowUserItem
  }>(),
  {
    userInfo: () => ({ userId: 0, nickName: '', fanNum: 0, followState: 'none' }) as FollowUserItem
  }
)

const emit = defineEmits<{
  (e: 'change', payload: { userId: number; state: ViewerFollowState; fanNum: number }): void
}>()

const config = useRuntimeConfig()
const { user } = useUser()

const userId = computed(() => props.userInfo.userId)
// 是否当前登录人自己的行（水合前登录态未恢复先按他人渲染，恢复后按钮自行隐藏）
const isSelfRow = computed(() => !!user.value?.userId && user.value.userId === userId.value)
const nickName = computed(() => props.userInfo.nickName || `用户 ${userId.value}`)
const signature = computed(() => props.userInfo.signature?.trim() || '暂未设置签名')
const fanNum = computed(() => props.userInfo.fanNum ?? 0)
const avatarUrl = computed(() => toCoverUrl(config.public.apiBase, props.userInfo.avatar))

// 按钮动作后上报给页面（页面按 userId 回写列表行的状态与粉丝数，本组件不直改 props）
const onChange = (payload: { state: ViewerFollowState; fanNum: number }) => {
  emit('change', { userId: userId.value, state: payload.state, fanNum: payload.fanNum })
}
</script>

<style lang="less" scoped>
.follow-user-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border-light);
  }

  &:hover {
    background-color: var(--color-bg);

    .name {
      color: var(--color-primary);
    }
  }

  .avatar {
    flex-shrink: 0;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .avatar-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: #fff;
      background-image: var(--gradient-brand);
    }
  }

  .body {
    flex: 1;
    min-width: 0;

    .name {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
      color: var(--color-text-1);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      transition: color 0.2s ease;
    }

    .signature {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 20px;
      color: var(--color-text-3);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .row-side {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 14px;

    .fans {
      font-size: 13px;
      color: var(--color-text-3);
      white-space: nowrap;
    }
  }
}
</style>
