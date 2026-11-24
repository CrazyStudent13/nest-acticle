<!-- 关注按钮三态（作者卡/关注粉丝列表/通知中心回关共用）：
     none=关注（实底主色） following=已关注 mutual=互相关注（描边灰）。
     state 未传时挂载后自行查 status（作者卡场景）；列表场景由行数据直传、免查询。
     未登录点击弹登录框（比等 apiFetch 401 统一出口的静默处理体验明确）；
     动作成功后回读 status 拿权威互关态与粉丝数（follow 响应只带 followed+fanNum） -->
<template>
  <button class="follow-btn" :class="[`is-${innerState}`, size]" type="button" :disabled="loading" @click.stop="onToggle">
    {{ label }}
  </button>
</template>

<script setup lang="ts">
import type { ViewerFollowState } from '@nest-acticle/shared'

const props = withDefaults(
  defineProps<{
    /** 目标用户 id */
    targetUserId: number
    /** 已知状态（列表行直传）；不传则挂载后自行查询（作者卡场景） */
    state?: ViewerFollowState | null
    /** 尺寸：default 作者卡 / small 列表行 */
    size?: 'default' | 'small'
  }>(),
  {
    state: null,
    size: 'default'
  }
)

const emit = defineEmits<{
  (e: 'change', payload: { state: ViewerFollowState; fanNum: number }): void
}>()

const { fetchFollowStatus, followUser, unfollowUser } = useFollow()
const { user, isLoggedIn } = useUser()

const innerState = ref<ViewerFollowState>('none')
const loading = ref(false)
// 是否已发起过状态查询（含失败）：登录态就绪只补查一次，失败不反复重试
let stateQueried = false

// 列表行数据传入的状态同步进来（翻页/回关后行数据刷新）
watch(
  () => props.state,
  (value) => {
    if (typeof value === 'string') {
      innerState.value = value
    }
  },
  { immediate: true }
)

// 作者卡场景（未传 state）：登录态才查询状态——未登录查询必 401 会经 apiFetch 统一出口弹登录框，
// 游客保持 none 由点击引导登录。SSR 页水合时登录态往往尚未恢复完成，故除挂载外再 watch 一手：
// 登录态就绪瞬间补查（幂等，stateQueried 防重复）
const fetchStateIfNeeded = () => {
  if (props.state !== null || stateQueried || !isLoggedIn.value) {
    return
  }
  stateQueried = true
  fetchFollowStatus(props.targetUserId)
    .then((status) => {
      if (status) {
        applyStatus(status)
      }
    })
    .catch(() => {
      /* 静默：保持未关注态 */
    })
}

onMounted(fetchStateIfNeeded)
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    fetchStateIfNeeded()
  }
})

const applyStatus = (status: { followed: boolean; mutual: boolean; fanNum: number }) => {
  innerState.value = status.followed ? (status.mutual ? 'mutual' : 'following') : 'none'
  emit('change', { state: innerState.value, fanNum: status.fanNum })
}

const label = computed(() => (innerState.value === 'mutual' ? '互相关注' : innerState.value === 'following' ? '已关注' : '关注'))

const onToggle = async () => {
  if (loading.value) {
    return
  }
  // 未登录：明确弹登录框引导（自己的空间父级已隐藏按钮，这里对自关注兜底 no-op）
  if (!isLoggedIn.value) {
    useAuthModal().openLogin()
    return
  }
  if (user.value?.userId === props.targetUserId) {
    return
  }
  loading.value = true
  try {
    // 先按当前状态发起动作，再回读权威状态（互关标记只有 status 接口能给出）
    if (innerState.value === 'none') {
      await followUser(props.targetUserId)
    } else {
      await unfollowUser(props.targetUserId)
    }
    const status = await fetchFollowStatus(props.targetUserId)
    if (status) {
      applyStatus(status)
    }
  } catch (error: any) {
    showToast(error?.message || '操作失败，请稍后重试', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.follow-btn {
  min-width: 84px;
  padding: 7px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 18px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  // 未关注：实底主色（掘金同款主行动钮）
  &.is-none {
    border: 0;
    background-color: var(--color-primary);
    color: #fff;

    &:hover:not(:disabled) {
      background-color: var(--color-primary-hover);
    }
  }

  // 已关注/互相关注：描边弱化态，hover 变 danger 提示可取关
  &.is-following,
  &.is-mutual {
    border: 1px solid var(--color-border);
    background-color: var(--color-surface);
    color: var(--color-text-2);

    &:hover:not(:disabled) {
      border-color: #d1242f;
      color: #d1242f;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  // 列表行/通知行的小号
  &.small {
    min-width: 64px;
    padding: 4px 12px;
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
