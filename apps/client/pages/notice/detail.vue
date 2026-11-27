<!-- 通知/公告详情页：与文章详情页共用 CommonReadingLayout 双栏布局（正文卡片 + 右侧信息栏吸顶），
     头部结构一致（标题 → 发布人/时间/类型 → 正文），无评论/点赞等互动；
     正文取自 /api/system/notice/list 按 noticeId 过滤（前台角色只有 list 权限），登录守卫先行；
     不存在/已关闭显示空态；右侧信息卡含发布时间/发布人，更多通知可直达其他公告 -->
<template>
  <div class="notice-detail">
    <CommonReadingLayout :flush="!notice">
      <template v-if="notice">
        <h1 class="title">{{ notice.noticeTitle || '系统消息' }}</h1>

        <!-- 元信息行：与文章页同规格——发布人/时间/类型，入口靠右 -->
        <div class="meta-line">
          <span class="meta-author">{{ notice.createBy || '系统' }}</span>
          <time class="meta-time">{{ formatTime(notice.createTime) }}</time>
          <span class="notice-badge" :class="notice.noticeType === '2' ? 'is-announce' : 'is-info'">
            {{ notice.noticeType === '2' ? '公告' : '通知' }}
          </span>
          <NuxtLink class="meta-back" to="/notification">返回通知中心</NuxtLink>
        </div>

        <div class="panel-body">
          <MdViewer v-if="notice.noticeContent" :value="notice.noticeContent" />
          <p v-else class="body-empty">该通知暂无正文内容</p>
        </div>
      </template>

      <template v-else>
        <NuxtLink class="back-link" to="/notification">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回通知中心
        </NuxtLink>
        <CommonEmptyState v-if="loading" text="加载中…" />
        <CommonEmptyState v-else>{{ errorMsg || '通知不存在或已关闭' }}</CommonEmptyState>
      </template>

      <!-- 右侧信息栏：与文章页作者卡/目录同规格，吸顶跟随，窄屏隐藏 -->
      <template v-if="notice" #aside>
        <section class="side-card">
          <h2 class="card-title">通知信息</h2>
          <dl class="info-list">
            <div class="info-row">
              <dt>发布时间</dt>
              <dd>{{ formatTime(notice.createTime) }}</dd>
            </div>
            <div v-if="notice.createBy" class="info-row">
              <dt>发布人</dt>
              <dd>{{ notice.createBy }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="moreNotices.length" class="side-card">
          <h2 class="card-title">更多通知</h2>
          <ul class="more-list">
            <li v-for="item in moreNotices" :key="item.noticeId" class="more-item">
              <i class="more-dot" :class="{ 'is-announce': item.noticeType === '2' }" />
              <NuxtLink class="more-link" :to="{ path: '/notice/detail', query: { id: String(item.noticeId) } }">
                {{ item.noticeTitle || '系统消息' }}
              </NuxtLink>
              <time class="more-time">{{ formatShortTime(item.createTime) }}</time>
            </li>
          </ul>
        </section>
      </template>
    </CommonReadingLayout>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { NoticeItem } from '~/composables/useNotice'

// 数据依赖客户端 token，守卫先行避免未登录发必 401 的请求
definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const { fetchNotices } = useNotice()
const { markNoticesRead, refreshBadge } = useNotify()

const noticeId = computed(() => {
  const id = Number(route.query.id)
  return Number.isInteger(id) && id > 0 ? id : 0
})

const notice = ref<NoticeItem | null>(null)
const moreNotices = ref<NoticeItem[]>([])
const loading = ref(true)
const errorMsg = ref('')

const loadNotice = async () => {
  if (!noticeId.value) {
    loading.value = false
    errorMsg.value = '通知不存在或已关闭'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await fetchNotices({ noticeId: noticeId.value, pageNum: 1, pageSize: 1, status: '0' })
    notice.value = data.list?.[0] || null
    // 进详情即标该条已读（逐条已读模型），角标随之回落——从铃铛下拉直达详情也算看过
    if (notice.value) {
      markNoticesRead([noticeId.value]).catch(() => {})
      refreshBadge()
    }
  } catch (error: any) {
    notice.value = null
    errorMsg.value = error?.message || '通知加载失败'
  } finally {
    loading.value = false
  }
}

// 右侧「更多通知」：取最新几条并剔除当前这篇，失败静默（不影响正文阅读）
const loadMoreNotices = async () => {
  try {
    const data = await fetchNotices({ pageNum: 1, pageSize: 6, status: '0' })
    moreNotices.value = (data.list || []).filter((item) => item.noticeId !== noticeId.value).slice(0, 5)
  } catch {
    moreNotices.value = []
  }
}

const formatTime = (value?: string | null) => {
  if (!value) {
    return ''
  }
  const formatted = dayjs(value).format('YYYY-MM-DD HH:mm')
  return formatted === 'Invalid Date' ? '' : formatted
}

const formatShortTime = (value?: string | null) => {
  if (!value) {
    return ''
  }
  const formatted = dayjs(value).format('MM-DD')
  return formatted === 'Invalid Date' ? '' : formatted
}

useHead(() => ({ title: notice.value?.noticeTitle ? `${notice.value.noticeTitle} - 游戏速递` : '通知详情 - 游戏速递' }))

// 右侧更多通知是站内链接，同路由复用组件时 query 变化要重拉正文
watch(noticeId, () => {
  loadNotice()
  loadMoreNotices()
})

onMounted(() => {
  loadNotice()
  loadMoreNotices()
})
</script>

<style lang="less" scoped>
.title {
  margin: 0 0 16px;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-1);
  overflow-wrap: anywhere;
}

// 元信息行与文章详情页同口径：单行、制底分割线，入口（返回）靠右
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

  .meta-time {
    color: var(--color-text-3);
  }

  .meta-back {
    margin-left: auto;
    color: var(--color-text-3);
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-primary);
    }
  }
}

.notice-badge {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 18px;

  &.is-info {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
  }

  &.is-announce {
    background-color: rgba(230, 132, 41, 0.12);
    color: #e68429;
  }
}

.panel-body {
  // 卡片内 Markdown 不带纸面底色（github 深色底会形成色块），文字配色仍随站点主题
  :deep(.markdown-body) {
    background-color: transparent;
  }

  .body-empty {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-3);
  }
}

// 空态分支的返回入口
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--color-text-3);
  transition: color 0.2s ease;

  &:hover {
    color: var(--color-primary);
  }
}

// 右侧卡片：与文章页 aside 卡片同规格
.side-card {
  padding: 16px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
}

.card-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.info-list {
  margin: 0;

  .info-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 13px;

    dt {
      flex-shrink: 0;
      width: 56px;
      color: var(--color-text-3);
    }

    dd {
      flex: 1;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-text-2);
    }
  }
}

.more-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;

  .more-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  // 类型小圆点：通知=品牌蓝，公告=橙色（与正文徽标同色系）
  .more-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-primary);

    &.is-announce {
      background-color: #e68429;
    }
  }

  .more-link {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-2);
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-primary);
    }
  }

  .more-time {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-text-3);
  }
}

@media (max-width: 640px) {
  .title {
    font-size: 22px;
  }
}
</style>