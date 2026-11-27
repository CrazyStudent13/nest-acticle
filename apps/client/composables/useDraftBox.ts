// 草稿箱（localStorage 自动保存）：读写/防抖保存/删除/点击外关闭。
// ⚠️ DRAFT_KEY 与存档格式（DraftItem[] 的 JSON）是既有用户数据契约——本批次新增可选字段 articleId
// （编辑线上文章的本地快照），旧存档无该字段可正常读取，不丢数据。
// 规则：新建模式写 currentDraftId 草稿（草稿箱面板展示）；编辑模式按 articleId 归属写本地快照
// （防编辑丢失，经编辑页恢复横幅呈现，不混入面板），与基线一致时不写，避免载入动作产生等值快照。
// 状态经 reactive 返回：DraftPanel 组件以 props/emits 对接，页面模板/脚本直接 draft.xxx 读写。
import dayjs from 'dayjs'
import type { Ref } from 'vue'

export interface DraftItem {
  id: string
  userId: number
  articleId?: string // 编辑模式快照归属的文章 id；新建草稿无此字段
  title: string
  content: string
  updateTime: number
}

export const ARTICLE_DRAFT_KEY = 'article-drafts'

// 管理页等非编辑器场景直接读写本地草稿；SSR 无 localStorage 时按空处理
export const readDrafts = (): DraftItem[] => {
  if (!import.meta.client) {
    return []
  }
  try {
    const raw = JSON.parse(localStorage.getItem(ARTICLE_DRAFT_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export const writeDrafts = (items: DraftItem[]) => {
  if (!import.meta.client) {
    return
  }
  localStorage.setItem(ARTICLE_DRAFT_KEY, JSON.stringify(items))
}

export const useDraftBox = (options: { title: Ref<string>; content: Ref<string>; editId: Ref<string> }) => {
  const { title, content, editId } = options
  const { user } = useUser()

  const drafts = ref<DraftItem[]>([])
  const currentDraftId = ref('')
  const draftOpen = ref(false)
  const saveHint = ref('')

  // 草稿箱面板只列新建草稿（编辑线上文章的本地快照经编辑页恢复横幅呈现，不混入面板）
  const myDrafts = computed(() => drafts.value.filter((d) => d.userId === user.value?.userId && !d.articleId))

  // 编辑模式的本地快照（归属当前 editId 且有内容时，编辑页展示恢复横幅）
  const currentEditDraft = computed(() => {
    if (!editId.value) {
      return null
    }
    const userId = user.value?.userId
    if (!userId) {
      return null
    }
    return drafts.value.find((d) => d.articleId === editId.value && d.userId === userId) || null
  })

  // 已保存基线：与基线一致的内容不再写编辑快照（载入线上正文/恢复快照后调用，
  // 防止载入动作本身触发等值快照、下次打开误报"有未保存修改"）
  const savedBaseline = ref<{ title: string; content: string } | null>(null)
  const markSavedBaseline = () => {
    savedBaseline.value = { title: title.value, content: content.value }
  }

  const loadDrafts = () => {
    drafts.value = readDrafts()
  }

  const persistDrafts = () => {
    writeDrafts(drafts.value)
  }

  const saveCurrentDraft = () => {
    if (!title.value.trim() && !content.value.trim()) {
      return
    }
    const userId = user.value?.userId
    if (!userId) {
      return
    }
    // 编辑线上文章：按 articleId 归属保存本地快照（防编辑丢失），与基线一致时跳过
    if (editId.value) {
      if (savedBaseline.value && savedBaseline.value.title === title.value && savedBaseline.value.content === content.value) {
        return
      }
      const existing = drafts.value.find((d) => d.articleId === editId.value && d.userId === userId)
      if (existing) {
        existing.title = title.value
        existing.content = content.value
        existing.updateTime = Date.now()
      } else {
        drafts.value.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          userId,
          articleId: editId.value,
          title: title.value,
          content: content.value,
          updateTime: Date.now()
        })
      }
      persistDrafts()
      saveHint.value = `已保存本地修改 ${dayjs().format('HH:mm')}`
      return
    }
    // 新建模式：与线上无关，写 currentDraftId 草稿（草稿箱面板展示）
    const existing = currentDraftId.value ? drafts.value.find((d) => d.id === currentDraftId.value) : null
    if (existing) {
      existing.title = title.value
      existing.content = content.value
      existing.updateTime = Date.now()
    } else {
      currentDraftId.value = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      drafts.value.unshift({
        id: currentDraftId.value,
        userId,
        title: title.value,
        content: content.value,
        updateTime: Date.now()
      })
    }
    persistDrafts()
    saveHint.value = `已自动保存至草稿箱 ${dayjs().format('HH:mm')}`
  }

  // 输入防抖自动保存
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch([title, content], () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(saveCurrentDraft, 800)
  })

  const loadDraft = (item: DraftItem) => {
    title.value = item.title
    content.value = item.content
    currentDraftId.value = item.id
    draftOpen.value = false
    saveHint.value = `已载入草稿 ${dayjs(item.updateTime).format('MM-DD HH:mm')}`
  }

  const removeDraft = (item: DraftItem) => {
    drafts.value = drafts.value.filter((d) => d.id !== item.id)
    persistDrafts()
    if (currentDraftId.value === item.id) {
      currentDraftId.value = ''
    }
  }

  // 发布/保存成功后清底：编辑模式清该文章的本地快照，新建模式清 currentDraftId 对应草稿
  const clearCurrentDraft = () => {
    if (editId.value) {
      const userId = user.value?.userId
      drafts.value = drafts.value.filter((d) => !(d.articleId === editId.value && (!userId || d.userId === userId)))
      persistDrafts()
    } else if (currentDraftId.value) {
      drafts.value = drafts.value.filter((d) => d.id !== currentDraftId.value)
      currentDraftId.value = ''
      persistDrafts()
    }
  }

  // 点击面板外关闭草稿箱（面板元素由 DraftPanel 渲染，closest('.draft-wrap') 照常命中）
  onMounted(() => {
    document.addEventListener('click', onDocClick)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick)
  })
  const onDocClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (draftOpen.value && !target.closest('.draft-wrap')) {
      draftOpen.value = false
    }
  }

  return reactive({
    open: draftOpen,
    myDrafts,
    currentDraftId,
    currentEditDraft,
    saveHint,
    loadDrafts,
    loadDraft,
    removeDraft,
    clearCurrentDraft,
    saveCurrentDraft,
    markSavedBaseline
  })
}
