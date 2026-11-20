<!-- 个人空间页：带 ?id= 看他人空间（公开昵称/头像+文章统计+点赞栏），否则自己的空间（完整账号信息+编辑资料入口）；文章 tab 标题搜索+时间正/倒序（400ms 防抖），专栏 tab 复用 ColumnCard，点赞 tab 展示空间主人点赞过的文章（公开） -->
<template>
  <div class="space-page">
    <!-- 资料卡：自己的空间展示完整字段，他人空间只展示公开信息 -->
    <div class="feed-panel profile-panel">
      <div class="profile-head">
        <span class="avatar-static">
          <img v-if="avatarUrl" class="avatar" :src="avatarUrl" alt="头像" />
          <span v-else class="avatar avatar-fallback">{{ avatarFallback }}</span>
        </span>

        <div class="profile-info">
          <h2 class="profile-name">
            {{ profileName }}
            <span v-if="sexTag" class="sex-suffix">（{{ sexTag }}）</span>
          </h2>
          <!-- 他人空间：公开统计（自己/他人同一套展示） -->
          <div v-if="!isSelf" class="profile-stats">
            <span class="stat"><b>{{ spaceStats.total }}</b> 文章</span>
            <span class="stat"><b>{{ spaceStats.reads }}</b> 阅读</span>
            <span class="stat"><b>{{ spaceStats.likes }}</b> 获赞</span>
          </div>
          <!-- 仅自己可见的账号信息；性别并入昵称行，昵称与名称重复不再展示；自己的文章数据未来走专门的个人数据入口 -->
          <dl v-if="isSelf" class="profile-fields">
            <div class="field-row"><dt>昵称</dt><dd>{{ user?.userName }}</dd></div>
            <div class="field-row"><dt>注册时间</dt><dd>{{ registerTime }}</dd></div>
            <div class="field-row field-row--full"><dt>签名</dt><dd>{{ signature }}</dd></div>
          </dl>
        </div>

        <div v-if="isSelf" class="profile-actions">
          <button class="btn ghost" type="button" @click="goSettings">编辑资料</button>
        </div>
      </div>
    </div>

    <!-- 内容卡：文章 / 专栏 / 点赞 tab 统一（点赞仅本人空间），通知入口统一收归头部铃铛 -->
    <div class="feed-panel content-panel">
      <div class="tab-bar">
        <div class="tab-items">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="tab-item"
            :class="{ active: activeTab === t.key }"
            type="button"
            @click="switchTab(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
        <!-- 文章 tab 的搜索与时间排序：排序内嵌搜索框前置位 -->
        <div class="tab-tools">
          <div class="article-search">
            <button class="time-toggle" type="button" @click="toggleTimeOrder">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ flip: timeOrder === 'asc' }" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              {{ timeOrder === 'desc' ? '时间倒序' : '时间正序' }}
            </button>
            <input
              v-model="keyword"
              class="search-input"
              type="search"
              placeholder="搜索文章标题"
              maxlength="64"
              @input="onKeywordInput"
            />
          </div>
        </div>
      </div>

      <!-- 文章 tab -->
      <template v-if="activeTab === 'article'">
        <template v-if="articles.length">
          <article-card
            v-for="item in articles"
            :key="item.id || item.title"
            :card-info="item"
            @click="goArticle(item)"
          />
        </template>
        <CommonEmptyState v-else-if="articlesLoading" text="加载中…" />
        <CommonEmptyState v-else-if="keyword">
          未找到与“{{ keyword }}”相关的文章
        </CommonEmptyState>
        <CommonEmptyState v-else>
          {{ isSelf ? '还没有发布过文章' : 'TA 还没有发布过文章' }}
        </CommonEmptyState>
      </template>

      <!-- 专栏 tab：复用 ColumnCard 行列表 -->
      <template v-else-if="activeTab === 'subject'">
        <div v-if="subjects.length" class="column-list">
          <column-card
            v-for="item in subjects"
            :key="item.id || item.title"
            :column-info="item"
            @click="goColumn(item)"
          />
        </div>
        <CommonEmptyState v-else-if="subjectsLoading" text="加载中…" />
        <CommonEmptyState v-else>
          {{ isSelf ? '还没有创建专栏' : 'TA 还没有创建专栏' }}
        </CommonEmptyState>
      </template>

      <!-- 点赞 tab：本人点赞过的文章（复用文章行卡），数据按登录态拉取本人记录 -->
      <template v-else-if="activeTab === 'like'">
        <template v-if="likedArticles.length">
          <article-card
            v-for="item in likedArticles"
            :key="item.id || item.title"
            :card-info="item"
            @click="goArticle(item)"
          />
        </template>
        <CommonEmptyState v-else-if="likedLoading" text="加载中…" />
        <CommonEmptyState v-else-if="keyword">
          未找到与“{{ keyword }}”相关的文章
        </CommonEmptyState>
        <CommonEmptyState v-else>
          {{ isSelf ? '还没有点赞过文章，去信息流给好内容点个赞吧' : 'TA 还没有点赞过文章' }}
        </CommonEmptyState>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { LikedArticleItem, Subject } from '@nest-acticle/shared'

// 登录守卫走 auth middleware：未登录/恢复失败回首页；带 ?id= 看他人空间时走 guest 旁路公开可看（authGuestQuery）
definePageMeta({
  middleware: 'auth',
  authGuestQuery: 'id'
})

const config = useRuntimeConfig()
const route = useRoute()
const { user } = useUser()
const { fetchUserLikedArticles } = useLike()
const { fetchGuestArticles } = useArticleManage()
const { fetchGuestSubjects } = useSubject()

// 签名：取用户资料，未设置时给占位文案
const signature = computed(() => user.value?.signature?.trim() || '暂未设置签名')

// ---------- 空间归属：带 ?id= 看他人空间（guest 公开数据），否则是自己的 ----------
const targetUserId = computed(() => {
  const raw = Number(route.query.id)
  if (Number.isFinite(raw) && raw > 0) {
    return raw
  }
  return user.value?.userId ?? null
})
const isSelf = computed(() => !!user.value?.userId && user.value.userId === targetUserId.value)

// 他人资料来自文章列表携带的 userInfo（后端仅公开昵称与头像）
const spaceProfile = ref<{ nickName?: string; avatar?: string }>({})
const spaceStats = ref({ total: 0, reads: 0, likes: 0 })

// ---------- 页面初始化：自己的空间要求登录，他人空间公开可看（两种情形都由 auth middleware 判定先行） ----------
const initSpace = () => {
  // 切换空间时清掉搜索词与点赞列表，避免上一位的过滤条件/数据带到下一位
  keyword.value = ''
  likedArticles.value = []
  loadMyArticles()
  if (activeTab.value === 'like') {
    loadLikedArticles()
  }
}

onMounted(() => {
  // middleware 已保证：登录态就绪（自己的空间）或 guest 旁路放行（他人空间）
  initSpace()
})

// SPA 内切换不同用户空间时重载
watch(targetUserId, (val, old) => {
  if (val !== old && val) {
    initSpace()
  }
})

// ---------- 资料展示 ----------
const profileName = computed(() =>
  isSelf.value ? user.value?.nickName || user.value?.userName || '用户' : spaceProfile.value.nickName || `用户 ${targetUserId.value}`
)
const avatarUrl = computed(() => {
  const raw = isSelf.value ? user.value?.avatar : spaceProfile.value.avatar
  return toCoverUrl(config.public.apiBase, raw)
})
const avatarFallback = computed(() => profileName.value.slice(0, 1))
// 性别标签走数据字典（0男 1女 2未知），字典未加载或未设置时不在昵称后展示
const sexOptions = useDict('sys_user_sex')
const sexTag = computed(() => {
  // 他人空间只有公开昵称/头像,性别仅本人在自己的空间展示
  if (!isSelf.value) {
    return ''
  }
  const sex = user.value?.sex ?? ''
  if (!sex) {
    return ''
  }
  return sexOptions.value.find((item) => item.dictValue === sex)?.dictLabel || ''
})
const registerTime = computed(() => {
  const value = user.value?.createTime
  if (!value) {
    return '未知'
  }
  const formatted = dayjs(value).format('YYYY-MM-DD')
  return formatted === 'Invalid Date' ? '未知' : formatted
})

const goSettings = () => {
  return navigateTo('/user/settings')
}

// ---------- 内容 tab：文章/专栏/点赞（点赞栏公开可见，同掘金「赞」栏） ----------
const tabs = [
  { key: 'article', label: '文章' },
  { key: 'subject', label: '专栏' },
  { key: 'like', label: '点赞' }
]
const activeTab = ref('article')
const articles = ref<any[]>([])
const articlesLoading = ref(true)

// ---------- 文章列表：标题搜索（后端 LIKE）+ 时间正/倒序（后端排序参数），输入 400ms 防抖 ----------
const keyword = ref('')
const timeOrder = ref<'desc' | 'asc'>('desc')
let keywordTimer: ReturnType<typeof setTimeout> | null = null

const loadMyArticles = async () => {
  const userId = targetUserId.value
  if (!userId) {
    return
  }
  articlesLoading.value = true
  try {
    const data = await fetchGuestArticles({
      userId,
      pageNum: 1,
      pageSize: 50,
      orderByColumn: 'createTime',
      isAsc: timeOrder.value === 'desc' ? 'descending' : 'ascending',
      ...(keyword.value.trim() ? { title: keyword.value.trim() } : {})
    })
    const list = data.list || []
    articles.value = list
    // 公开统计（自己/他人同一套）+ 他人资料从文章携带的 userInfo 取
    if (!isSelf.value) {
      const info = list[0]?.userInfo
      if (info?.nickName || info?.avatar) {
        spaceProfile.value = { nickName: info.nickName, avatar: info.avatar }
      }
    }
    spaceStats.value = {
      total: data.total || 0,
      reads: list.reduce((sum, item) => sum + (item.readNum || 0), 0),
      likes: list.reduce((sum, item) => sum + (item.likeNum || 0), 0)
    }
  } catch {
    articles.value = []
  } finally {
    articlesLoading.value = false
  }
}

const onKeywordInput = () => {
  if (keywordTimer) {
    clearTimeout(keywordTimer)
  }
  // 搜索与排序控件为文章/点赞两个列表共用，按当前 tab 分发
  keywordTimer = setTimeout(() => (activeTab.value === 'like' ? loadLikedArticles() : loadMyArticles()), 400)
}

const toggleTimeOrder = () => {
  timeOrder.value = timeOrder.value === 'desc' ? 'asc' : 'desc'
  if (activeTab.value === 'like') {
    loadLikedArticles()
  } else {
    loadMyArticles()
  }
}

// ---------- 专栏 tab：guest subject list 原生支持 userId 过滤，首次进入 tab 才拉取 ----------
const subjects = ref<Subject[]>([])
const subjectsLoading = ref(false)
const subjectsLoaded = ref(false)

const loadMySubjects = async () => {
  const userId = targetUserId.value
  if (!userId) {
    return
  }
  subjectsLoading.value = true
  try {
    const data = await fetchGuestSubjects({ userId, pageNum: 1, pageSize: 50 })
    subjects.value = data.list || []
  } catch {
    subjects.value = []
  } finally {
    subjectsLoading.value = false
    subjectsLoaded.value = true
  }
}

// ---------- 点赞 tab：空间主人点赞过的已发布文章（公开接口，guest/list 按 userId 查询） ----------
const likedArticles = ref<LikedArticleItem[]>([])
const likedLoading = ref(false)

const loadLikedArticles = async () => {
  const userId = targetUserId.value
  if (!userId) {
    return
  }
  likedLoading.value = true
  try {
    const data = await fetchUserLikedArticles(userId, {
      pageNum: 1,
      pageSize: 50,
      isAsc: timeOrder.value === 'desc' ? 'descending' : 'ascending',
      ...(keyword.value.trim() ? { title: keyword.value.trim() } : {})
    })
    likedArticles.value = data.list || []
  } catch {
    likedArticles.value = []
  } finally {
    likedLoading.value = false
  }
}

const switchTab = (key: string) => {
  if (activeTab.value === key) {
    return
  }
  activeTab.value = key
  // 文章/点赞两 tab 共用搜索与排序控件，切入时按当前控件状态重载；专栏首次进入才拉取
  if (key === 'like') {
    loadLikedArticles()
  } else if (key === 'article') {
    loadMyArticles()
  } else if (key === 'subject' && !subjectsLoaded.value) {
    loadMySubjects()
  }
}

const goArticle = (item: any) => {
  return navigateTo({
    path: '/article/detail',
    query: { id: item.id }
  })
}

const goColumn = (item: any) => {
  return navigateTo({
    path: '/column/detail',
    query: { id: item.id }
  })
}
</script>

<style lang="less" scoped>
.space-page {
  padding: 4px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-panel {
  padding: 24px;
}

.profile-head {
  display: flex;
  gap: 20px;
  align-items: flex-start;

  .avatar-static {
    flex-shrink: 0;
    line-height: 0;
  }

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-full);
    object-fit: cover;
    background-color: var(--color-bg);
    display: flex;
    align-items: center;
    justify-content: center;

    &.avatar-fallback {
      background-image: var(--gradient-brand);
      color: #fff;
      line-height: 64px;
      text-align: center;
    }
  }

  .profile-info {
    flex: 1;
    min-width: 0;

    .profile-name {
      font-size: 20px;
      font-weight: 600;
      color: var(--color-text-1);
      margin-bottom: 10px;

      .sex-suffix {
        font-size: 14px;
        font-weight: 400;
        color: var(--color-text-3);
      }
    }

    .profile-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 24px;
      margin: 0;

      .field-row {
        display: flex;
        gap: 8px;
        font-size: 13px;
        line-height: 22px;

        dt {
          flex-shrink: 0;
          color: var(--color-text-3);

          &::after {
            content: '：';
          }
        }

        dd {
          margin: 0;
          color: var(--color-text-1);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        // 个性签名整行展示：跨满两列并允许换行，长签名不被半宽单行截断
        &.field-row--full {
          grid-column: 1 / -1;

          dd {
            white-space: normal;
            overflow-wrap: anywhere;
            text-overflow: clip;
          }
        }
      }
    }

    .profile-stats {
      display: flex;
      gap: 24px;
      font-size: 13px;
      color: var(--color-text-2);

      .stat b {
        font-size: 16px;
        color: var(--color-text-1);
        margin-right: 4px;
      }
    }
  }

  .profile-actions {
    flex-shrink: 0;

    .btn.ghost {
      padding: 6px 14px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      border: 1px solid var(--color-border);
      background-color: var(--color-surface);
      color: var(--color-text-2);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        color 0.2s ease;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }
  }
}

// 专栏行列表容器（ColumnCard 自带行分隔线）
.column-list {
  overflow: hidden;
}

// 内容卡
.content-panel {
  min-height: 320px;

  .tab-bar {
    display: flex;
    align-items: center;
    padding: 8px 20px 0;
    border-bottom: 1px solid var(--color-border-light);

    .tab-items {
      display: flex;
      gap: 4px;
    }

    .tab-item {
      position: relative;
      padding: 10px 16px 12px;
      border: 0;
      background-color: transparent;
      font-size: 14px;
      color: var(--color-text-2);
      cursor: pointer;
      transition: color 0.2s ease;

      &:hover {
        color: var(--color-text-1);
      }

      &.active {
        color: var(--color-primary);
        font-weight: 500;
      }

      // 短圆条下划线：底部越界 2px，正好压在 tab 行边框上
      &::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -2px;
        transform: translateX(-50%);
        width: 26px;
        height: 3px;
        border-radius: 2px;
        background-color: transparent;
        transition: background-color 0.2s ease;
      }

      &.active::after {
        background-color: var(--color-primary);
      }
    }

    // 文章 tab 的搜索组：时间排序内嵌为前置按钮
    .tab-tools {
      margin-left: auto;
      display: flex;
      align-items: center;
    }

    .article-search {
      display: flex;
      align-items: center;
      width: 240px;
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
      transition: border-color 0.2s ease;

      &:focus-within {
        border-color: var(--color-primary);
      }

      .time-toggle {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border: 0;
        border-right: 1px solid var(--color-border-light);
        background-color: transparent;
        font-size: 13px;
        color: var(--color-text-2);
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover {
          color: var(--color-primary);
        }

        svg {
          transition: transform 0.2s ease;

          &.flip {
            transform: rotate(180deg);
          }
        }
      }

      .search-input {
        flex: 1;
        min-width: 0;
        padding: 6px 10px;
        border: 0;
        background-color: transparent;
        font-size: 13px;
        color: var(--color-text-1);
        outline: none;

        &::placeholder {
          color: var(--color-text-3);
        }
      }
    }
  }

  @media (max-width: 640px) {
    .tab-bar .tab-tools .article-search {
      width: 140px;
    }
  }

  .feed-empty {
    min-height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
