<!-- 个人空间页：带 ?id= 看他人空间（公开资料接口取昵称/头像+文章统计+点赞栏，零文章用户同样能解析出资料），否则自己的空间（完整账号信息+编辑资料入口）；文章 tab 标题搜索+时间正/倒序（400ms 防抖），专栏 tab 复用 ColumnCard，点赞 tab 展示空间主人点赞过的文章（公开），关注/粉丝 tab 展示空间主人的关注与粉丝列表（公开，条目带访问者视角三态关注按钮） -->
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
            <!-- 账号被举报处置停用：昵称右侧对外可见的状态标识，内容仍可浏览 -->
            <span v-if="spaceStopped" class="profile-stopped">该用户已被停用</span>
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
        <!-- 他人空间（且已登录）：关注按钮三态 + 举报入口（存在待处理举报时置灰）；未登录不渲染，关注动作入口由文章页作者卡承接游客 -->
        <div v-else-if="isLoggedIn" class="profile-actions">
          <FollowButton :target-user-id="targetUserId!" @change="onProfileFollowChange" />
          <button class="btn ghost" :disabled="userReported" type="button" @click="openReport">{{ userReported ? '已举报' : '举报' }}</button>
        </div>
      </div>
    </div>

    <!-- 内容卡：文章 / 专栏 / 关注 / 粉丝 / 点赞 tab 统一（点赞仅本人空间），通知入口统一收归头部铃铛 -->
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
        <!-- 文章/点赞 tab 的搜索与时间排序；关注/粉丝栏不提供搜索（同掘金）；收藏集 tab 显示新建入口（排序内嵌搜索框前置位） -->
        <div class="tab-tools">
          <template v-if="activeTab === 'article' || activeTab === 'like'">
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
          </template>
          <!-- 新建收藏集入口（仅收藏集 tab + 本人空间，同掘金收藏集栏右上角） -->
          <button v-else-if="activeTab === 'collect' && isSelf" class="create-collect-btn" type="button" @click="openCollectEdit(null)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建收藏集
          </button>
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
          <CommonPagination
            :page="likedPage"
            :total="likedTotal"
            :page-size="LIKED_PAGE_SIZE"
            @update:page="onLikedPageChange"
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

      <!-- 关注 tab：空间主人关注的人（公开，guest 接口本人/访客共用），条目按钮为访问者视角三态 -->
      <template v-else-if="activeTab === 'follow'">
        <div v-if="followUsers.length" class="follow-list">
          <FollowUserRow
            v-for="item in followUsers"
            :key="item.userId"
            :user-info="item"
            @click="goSpace(item)"
            @change="onFollowRowChange"
          />
          <CommonPagination
            :page="followPage"
            :total="followTotal"
            :page-size="FOLLOW_PAGE_SIZE"
            @update:page="onFollowPageChange"
          />
        </div>
        <CommonEmptyState v-else-if="followList.loading.value" text="加载中…" />
        <CommonEmptyState v-else>
          {{ isSelf ? '还没有关注任何人，去文章页发现感兴趣的作者吧' : 'TA 还没有关注任何人' }}
        </CommonEmptyState>
      </template>

      <!-- 粉丝 tab：关注空间主人的人（公开，同掘金），未回关的条目按钮即「回关」 -->
      <template v-else-if="activeTab === 'fans'">
        <div v-if="fansUsers.length" class="follow-list">
          <FollowUserRow
            v-for="item in fansUsers"
            :key="item.userId"
            :user-info="item"
            @click="goSpace(item)"
            @change="onFansRowChange"
          />
          <CommonPagination
            :page="fansPage"
            :total="fansTotal"
            :page-size="FOLLOW_PAGE_SIZE"
            @update:page="onFansPageChange"
          />
        </div>
        <CommonEmptyState v-else-if="fansLoading" text="加载中…" />
        <CommonEmptyState v-else>
          {{ isSelf ? '还没有粉丝，持续输出优质内容就会有人关注你' : 'TA 还没有粉丝' }}
        </CommonEmptyState>
      </template>

      <!-- 收藏集 tab：我创建的/我订阅的子栏（guest 接口本人含私密集，他人仅公开），最近更新在前 -->
      <template v-else-if="activeTab === 'collect'">
        <div class="collect-bar">
          <button
            class="pill"
            :class="{ active: collectBox === 'created' }"
            type="button"
            @click="switchCollectBox('created')"
          >
            我创建的 {{ createdTotal }}
          </button>
          <button
            class="pill"
            :class="{ active: collectBox === 'subscribed' }"
            type="button"
            @click="switchCollectBox('subscribed')"
          >
            我订阅的 {{ subscribedTotal }}
          </button>
        </div>

        <template v-if="collectBox === 'created'">
          <div v-if="createdCollections.length" class="collection-list">
            <collect-collection-row
              v-for="item in createdCollections"
              :key="item.id || item.name"
              :collection-info="item"
              :mine="isSelf"
              @click="goCollection(item)"
              @edit="openCollectEdit(item)"
              @remove="onCollectionRemove(item)"
            />
          </div>
          <CommonEmptyState v-else-if="collectLoading" text="加载中…" />
          <CommonEmptyState v-else>
            {{ isSelf ? '还没有收藏集，点击右上角新建一个吧' : 'TA 还没有创建收藏集' }}
          </CommonEmptyState>
          <CommonPagination
            :page="createdPage"
            :total="createdTotal"
            :page-size="COLLECT_PAGE_SIZE"
            @update:page="onCreatedPageChange"
          />
        </template>

        <template v-else>
          <div v-if="subscribedCollections.length" class="collection-list">
            <collect-collection-row
              v-for="item in subscribedCollections"
              :key="item.id || item.name"
              :collection-info="item"
              @click="goCollection(item)"
            />
          </div>
          <CommonEmptyState v-else-if="collectLoading" text="加载中…" />
          <CommonEmptyState v-else>
            {{ isSelf ? '还没有订阅收藏集，去别人的收藏集页点订阅吧' : 'TA 还没有订阅收藏集' }}
          </CommonEmptyState>
          <CommonPagination
            :page="subscribedPage"
            :total="subscribedTotal"
            :page-size="COLLECT_PAGE_SIZE"
            @update:page="onSubscribedPageChange"
          />
        </template>
      </template>
    </div>

    <!-- 新建/编辑收藏集弹窗（父条件渲染，同创作者中心专栏弹窗模式） -->
    <CollectCollectionEditModal v-if="collectEditOpen" :collection="editingCollection" @close="collectEditOpen = false" @saved="onCollectSaved" />
    <!-- 举报用户弹窗（文章/用户共用组件，user 口径）：理由选项走字典；提交成功回写已举报置灰态 -->
    <ReportDialog
      v-if="reportOpen"
      target-type="user"
      :target-id="targetUserId!"
      :target-label="spaceProfile.nickName || `用户 ${targetUserId}`"
      @close="reportOpen = false"
      @done="onReportDone"
    />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { Article, Collection, FollowUserItem, LikedArticleItem, Subject, ViewerFollowState } from '@nest-acticle/shared'

// 登录守卫走 auth middleware：未登录/恢复失败回首页；带 ?id= 看他人空间时走 guest 旁路公开可看（authGuestQuery）
definePageMeta({
  middleware: 'auth',
  authGuestQuery: 'id'
})

const config = useRuntimeConfig()
const route = useRoute()
const { user, isLoggedIn, fetchGuestProfile } = useUser()
const { fetchUserLikedArticles } = useLike()
const { fetchUserFollows } = useFollow()
const { fetchGuestArticles } = useArticleManage()
const { fetchGuestSubjects } = useSubject()
const { fetchGuestCollections, fetchGuestSubscribed } = useCollect()

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

// 他人资料：公开资料接口取昵称头像（不依赖文章行捎带——零文章用户的空间此前
// 只能显示占位名）；加载失败或用户不存在时保留空值走占位
const spaceProfile = ref<{ nickName?: string; avatar?: string; status?: string }>({})
const spaceStats = ref({ total: 0, reads: 0, likes: 0 })

const loadGuestProfile = async (userId: number) => {
  try {
    const profile = await fetchGuestProfile(userId)
    // 请求期间切到别人的空间：上一位的资料不落地
    if (userId !== targetUserId.value) {
      return
    }
    if (profile) {
      spaceProfile.value = { nickName: profile.nickName, avatar: profile.avatar ?? undefined, status: profile.status }
    }
  } catch {
    /* 静默：保留占位名 */
  }
}

// ---------- 页面初始化：自己的空间要求登录，他人空间公开可看（两种情形都由 auth middleware 判定先行） ----------
const initSpace = () => {
  // 切换空间时清掉搜索词/点赞列表/收藏集/关注粉丝列表/上一位的资料，避免带到下一位
  // （列表 reset 同时作废上一位空间在飞的请求，迟到的旧结果不会写回）
  keyword.value = ''
  likedList.reset()
  spaceProfile.value = {}
  createdList.reset()
  createdLoaded.value = false
  subscribedList.reset()
  subscribedLoaded.value = false
  followList.reset()
  followLoaded.value = false
  fansList.reset()
  fansLoaded.value = false
  loadMyArticles()
  if (activeTab.value === 'like') {
    loadLikedArticles()
  } else if (activeTab.value === 'collect') {
    loadCollectBox()
  } else if (activeTab.value === 'follow') {
    loadFollowUsers()
  } else if (activeTab.value === 'fans') {
    loadFansUsers()
  }
}

onMounted(() => {
  // middleware 已保证：登录态就绪（自己的空间）或 guest 旁路放行（他人空间）
  initSpace()
  syncUserReportStatus()
})

// SPA 内切换不同用户空间时重载
watch(targetUserId, (val, old) => {
  if (val !== old && val) {
    initSpace()
    syncUserReportStatus()
  }
})

// ---------- 举报用户（仅他人空间渲染入口）：登录态下查询已举报态，已举报置灰；提交成功回写并提示 ----------
const { fetchReportStatus } = useReport()
const userReported = ref(false)
const reportOpen = ref(false)

const syncUserReportStatus = () => {
  const userId = targetUserId.value
  if (!isLoggedIn.value || !userId || isSelf.value) {
    userReported.value = false
    return
  }
  fetchReportStatus('user', userId)
    .then((value) => {
      // 切换空间时旧请求可能后到，只回写当前空间的结果
      if (value && userId === targetUserId.value) {
        userReported.value = value.reported
      }
    })
    .catch(() => {})
}

const openReport = () => {
  if (!userReported.value) {
    reportOpen.value = true
  }
}

const onReportDone = () => {
  reportOpen.value = false
  userReported.value = true
  showToast('举报已提交，感谢你帮助维护社区环境', 'success')
}

// ---------- 资料展示 ----------
const profileName = computed(() =>
  isSelf.value ? user.value?.nickName || user.value?.userName || '用户' : spaceProfile.value.nickName || `用户 ${targetUserId.value}`
)
const avatarUrl = computed(() => {
  const raw = isSelf.value ? user.value?.avatar : spaceProfile.value.avatar
  return toCoverUrl(config.public.apiBase, raw)
})
const avatarFallback = computed(() => profileName.value.slice(0, 1))
// 账号状态（StatusEnum：0 正常 / 1 停用）：停用来自举报处置，他人空间对外标示
const spaceStopped = computed(() => !isSelf.value && spaceProfile.value.status === '1')
// 性别标签走数据字典（0男 1女 2未知），字典未加载或未设置时不在昵称后展示；
// 字典接口只要求登录态，挂在 isSelf 上按需拉取——游客/过期会话不发这条请求（401 会弹登录框）
const sexOptions = useDict('sys_user_sex', { enabled: isSelf })
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

// ---------- 内容 tab：文章/专栏/收藏集/关注/粉丝/点赞（关注粉丝栏与收藏集栏公开可见，同掘金） ----------
const tabs = [
  { key: 'article', label: '文章' },
  { key: 'subject', label: '专栏' },
  { key: 'collect', label: '收藏集' },
  { key: 'follow', label: '关注' },
  { key: 'fans', label: '粉丝' },
  { key: 'like', label: '点赞' }
]
const activeTab = ref('article')

// ---------- 文章列表：标题搜索（后端 LIKE）+ 时间正/倒序（后端排序参数），输入 400ms 防抖 ----------
const keyword = ref('')
const timeOrder = ref<'desc' | 'asc'>('desc')
let keywordTimer: ReturnType<typeof setTimeout> | null = null

// ---------- 五个列表共用 usePagedList（页码/总数/加载态/请求序号都在里面）：文章与专栏一次性拉满 50 条不分页，
// 点赞与收藏集双子栏真分页。fetchPage 在调用时才读 userId/搜索词/排序，搜索、排序、切换空间重新 load 即可；
// 请求序号保证先发后到的过期响应（连改搜索词、快速切空间）不会覆盖当前结果 ----------
// 空间尚未解析出 userId（登录态未恢复）时各 loader 直接返回不发请求，这里只是收窄类型
const userIdForList = () => targetUserId.value as number

// 加载态初值为 true：首屏等 onMounted（登录态就绪后）才首次加载，避免水合前闪一下空态
const articleList = usePagedList<Article>(
  (params) =>
    fetchGuestArticles({
      userId: userIdForList(),
      ...params,
      orderByColumn: 'createTime',
      isAsc: timeOrder.value === 'desc' ? 'descending' : 'ascending',
      ...(keyword.value.trim() ? { title: keyword.value.trim() } : {})
    }),
  { pageSize: 50, initialLoading: true }
)
const { list: articles, loading: articlesLoading } = articleList

const loadMyArticles = async () => {
  const userId = targetUserId.value
  if (!userId) {
    return
  }
  // 过期（已被更晚的搜索/排序/空间切换取代）或失败：不落任何副作用
  const data = await articleList.load()
  if (!data) {
    return
  }
  const list = data.list || []
  // 他人空间资料走公开资料接口（零文章用户也能取到昵称头像）
  if (!isSelf.value) {
    loadGuestProfile(userId)
  }
  spaceStats.value = {
    total: data.total || 0,
    reads: list.reduce((sum, item) => sum + (item.readNum || 0), 0),
    likes: list.reduce((sum, item) => sum + (item.likeNum || 0), 0)
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
const subjectList = usePagedList<Subject>((params) => fetchGuestSubjects({ userId: userIdForList(), ...params }), {
  pageSize: 50
})
const { list: subjects, loading: subjectsLoading } = subjectList
const subjectsLoaded = ref(false)

// 无论成败都标记「已加载过」（切走再切回不重拉），与原实现一致
const loadMySubjects = async () => {
  if (!targetUserId.value) {
    return
  }
  await subjectList.load()
  subjectsLoaded.value = true
}

// ---------- 点赞 tab：空间主人点赞过的已发布文章（公开接口，guest/list 按 userId 查询） ----------
const LIKED_PAGE_SIZE = 10
const likedList = usePagedList<LikedArticleItem>(
  (params) =>
    fetchUserLikedArticles(userIdForList(), {
      ...params,
      isAsc: timeOrder.value === 'desc' ? 'descending' : 'ascending',
      ...(keyword.value.trim() ? { title: keyword.value.trim() } : {})
    }),
  { pageSize: LIKED_PAGE_SIZE }
)
const { page: likedPage, total: likedTotal, list: likedArticles, loading: likedLoading } = likedList

// 不传页码 = 回第一页重拉（搜索/排序变化、切 tab、切空间）；分页器翻页传目标页
const loadLikedArticles = (page = 1) => {
  if (!targetUserId.value) {
    return
  }
  return likedList.load(page)
}

const onLikedPageChange = (page: number) => {
  loadLikedArticles(page)
}

// ---------- 关注/粉丝 tab：空间主人的关注/粉丝列表（公开接口，guest/list 按 userId+type 查询），
// 关注时间倒序；条目 followState 为访问者视角三态（登录态由服务端解析，未登录一律 none） ----------
const FOLLOW_PAGE_SIZE = 10

const followList = usePagedList<FollowUserItem>((params) => fetchUserFollows(userIdForList(), 'following', params), {
  pageSize: FOLLOW_PAGE_SIZE
})
const { page: followPage, total: followTotal, list: followUsers, loading: followLoading } = followList
const followLoaded = ref(false)

const loadFollowUsers = (page = 1) => {
  if (!targetUserId.value) {
    return
  }
  return followList.load(page).finally(() => {
    followLoaded.value = true
  })
}

const onFollowPageChange = (page: number) => {
  loadFollowUsers(page)
}

const fansList = usePagedList<FollowUserItem>((params) => fetchUserFollows(userIdForList(), 'fans', params), {
  pageSize: FOLLOW_PAGE_SIZE
})
const { page: fansPage, total: fansTotal, list: fansUsers, loading: fansLoading } = fansList
const fansLoaded = ref(false)

const loadFansUsers = (page = 1) => {
  if (!targetUserId.value) {
    return
  }
  return fansList.load(page).finally(() => {
    fansLoaded.value = true
  })
}

const onFansPageChange = (page: number) => {
  loadFansUsers(page)
}

// 条目关注按钮动作后回写行数据（UserRow 不直改 props，页面按 userId 找到行回写状态与粉丝数）
const applyRowChange = (list: FollowUserItem[], payload: { userId: number; state: ViewerFollowState; fanNum: number }) => {
  const row = list.find((item) => item.userId === payload.userId)
  if (row) {
    row.fanNum = payload.fanNum
    row.followState = payload.state
  }
}

const onFollowRowChange = (payload: { userId: number; state: ViewerFollowState; fanNum: number }) => {
  applyRowChange(followUsers.value, payload)
}

const onFansRowChange = (payload: { userId: number; state: ViewerFollowState; fanNum: number }) => {
  applyRowChange(fansUsers.value, payload)
}

// 资料卡关注按钮动作后：已加载过的两列表当场重拉（当前 tab 立即反映；未加载过的标记待切 tab 时拉）
const onProfileFollowChange = () => {
  if (followLoaded.value) {
    loadFollowUsers()
  } else {
    followLoaded.value = false
  }
  if (fansLoaded.value) {
    loadFansUsers()
  } else {
    fansLoaded.value = false
  }
}

// ---------- 收藏集 tab：我创建的/我订阅的子栏，各自独立分页，首次进入才拉取 ----------
const COLLECT_PAGE_SIZE = 10
const collectBox = ref<'created' | 'subscribed'>('created')

const createdList = usePagedList<Collection>((params) => fetchGuestCollections(userIdForList(), params), {
  pageSize: COLLECT_PAGE_SIZE
})
const { page: createdPage, total: createdTotal, list: createdCollections } = createdList
const createdLoaded = ref(false)

const subscribedList = usePagedList<Collection>((params) => fetchGuestSubscribed(userIdForList(), params), {
  pageSize: COLLECT_PAGE_SIZE
})
const { page: subscribedPage, total: subscribedTotal, list: subscribedCollections } = subscribedList
const subscribedLoaded = ref(false)

// 两子栏共用一个加载态：任一子栏在拉，当前子栏没数据时显示「加载中」
const collectLoading = computed(() => createdList.loading.value || subscribedList.loading.value)

// 不传页码 = 回第一页重拉（保存/删除收藏集后刷新计数）；无论成败都标记「已加载过」
const loadCreatedCollections = (page = 1) => {
  if (!targetUserId.value) {
    return
  }
  return createdList.load(page).finally(() => {
    createdLoaded.value = true
  })
}

const loadSubscribedCollections = (page = 1) => {
  if (!targetUserId.value) {
    return
  }
  return subscribedList.load(page).finally(() => {
    subscribedLoaded.value = true
  })
}

// 按当前子栏拉取（tab 切换/空间切换共用入口）
const loadCollectBox = () => {
  if (collectBox.value === 'created') {
    loadCreatedCollections()
  } else {
    loadSubscribedCollections()
  }
}

const switchCollectBox = (box: 'created' | 'subscribed') => {
  if (collectBox.value === box) {
    return
  }
  collectBox.value = box
  // 各子栏首次进入才拉取；已加载过的翻页态保留
  if (box === 'created' && !createdLoaded.value) {
    loadCreatedCollections()
  } else if (box === 'subscribed' && !subscribedLoaded.value) {
    loadSubscribedCollections()
  }
}

const onCreatedPageChange = (page: number) => {
  loadCreatedCollections(page)
}

const onSubscribedPageChange = (page: number) => {
  loadSubscribedCollections(page)
}

// ---------- 新建/编辑/删除收藏集（仅本人空间入口） ----------
const collectEditOpen = ref(false)
const editingCollection = ref<Collection | null>(null)

const openCollectEdit = (collection: Collection | null) => {
  editingCollection.value = collection
  collectEditOpen.value = true
}

const onCollectSaved = () => {
  collectEditOpen.value = false
  showToast('收藏集已保存', 'success')
  loadCreatedCollections()
}

// 行内删除：默认夹后端同样拦截（前端入口已隐藏），非默认夹二次确认后软删
const { deleteCollection } = useCollect()

const onCollectionRemove = async (item: Collection) => {
  if (!item.id) {
    return
  }
  const ok = await confirmAction({
    title: '删除收藏集',
    message: `确定删除收藏集「${item.name}」吗？收藏与订阅关系会一并清理。`,
    confirmText: '删除',
    danger: true
  })
  if (!ok) {
    return
  }
  try {
    await deleteCollection(item.id)
    showToast('收藏集已删除', 'success')
    loadCreatedCollections()
  } catch (error: any) {
    showToast(error?.message || '删除失败，请稍后重试', 'error')
  }
}

const goCollection = (item: Collection) => {
  return navigateTo({
    path: '/collect/detail',
    query: { id: item.id }
  })
}

const switchTab = (key: string) => {
  if (activeTab.value === key) {
    return
  }
  activeTab.value = key
  // 文章/点赞两 tab 共用搜索与排序控件，切入时按当前控件状态重载；专栏/收藏集/关注/粉丝首次进入才拉取
  if (key === 'like') {
    loadLikedArticles()
  } else if (key === 'article') {
    loadMyArticles()
  } else if (key === 'subject' && !subjectsLoaded.value) {
    loadMySubjects()
  } else if (key === 'collect' && !createdLoaded.value && !subscribedLoaded.value) {
    loadCollectBox()
  } else if (key === 'follow' && !followLoaded.value) {
    loadFollowUsers()
  } else if (key === 'fans' && !fansLoaded.value) {
    loadFansUsers()
  }
}

const goArticle = (item: any) => {
  return navigateTo({
    path: '/article/detail',
    query: { id: item.id }
  })
}

const goSpace = (item: { userId: number }) => {
  return navigateTo({
    path: '/user/space',
    query: { id: String(item.userId) }
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

    // 停用标识：昵称右侧灰底小胶囊，与昵称同排、弱于正文
    .profile-stopped {
      display: inline-block;
      vertical-align: middle;
      margin-left: 8px;
      padding: 0 8px;
      border-radius: var(--radius-full);
      background-color: var(--color-bg);
      color: var(--color-text-3);
      font-size: 12px;
      font-weight: 400;
      line-height: 20px;
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
    display: flex;
    align-items: center;
    gap: 10px;

    // 与 FollowButton 默认尺寸对齐（padding/字号/行高/最小宽一致），两钮等高同宽、间距由 gap 统一
    .btn.ghost {
      min-width: 84px;
      padding: 7px 18px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      line-height: 18px;
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

// 收藏集行列表容器（CollectionRow 自带行分隔线）
.collection-list {
  overflow: hidden;
}

// 关注/粉丝行列表容器（FollowUserRow 自带行分隔线）
.follow-list {
  overflow: hidden;
}

// 收藏集 tab 的子栏切换（我创建的/我订阅的，掘金同款胶囊）
.collect-bar {
  display: flex;
  gap: 8px;
  padding: 16px 20px 4px;

  .pill {
    padding: 6px 16px;
    border: 0;
    border-radius: var(--radius-full);
    background-color: var(--color-bg);
    font-size: 13px;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      color: var(--color-text-1);
    }

    &.active {
      background-color: var(--color-primary-light);
      color: var(--color-primary);
      font-weight: 500;
    }
  }
}

// 新建收藏集入口（tab 工具区右端，仅本人空间）
.create-collect-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary);
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-primary-hover);
  }
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
