// 草稿箱（localStorage 自动保存）：读写/防抖保存/删除/点击外关闭，从 editor/new.vue 抽出（原 :507-604）。
// ⚠️ DRAFT_KEY 与存档格式（DraftItem[] 的 JSON）是既有用户数据契约，逐字保留——改 key 或字段会让用户丢草稿。
// 规则：仅新建模式写草稿（editId 模式不写，避免与线上内容混淆）；列表按 userId 隔离展示。
// 状态经 reactive 返回：DraftPanel 组件以 props/emits 对接，页面模板/脚本直接 draft.xxx 读写。
import dayjs from 'dayjs'
import type { Ref } from 'vue'

export interface DraftItem {
  id: string
  userId: number
  title: string
  content: string
  updateTime: number
}

export const useDraftBox = (options: { title: Ref<string>; content: Ref<string>; editId: Ref<string> }) => {
  const { title, content, editId } = options
  const { user } = useUser()

  const DRAFT_KEY = 'article-drafts'
  const drafts = ref<DraftItem[]>([])
  const currentDraftId = ref('')
  const draftOpen = ref(false)
  const saveHint = ref('')

  const myDrafts = computed(() => drafts.value.filter((d) => d.userId === user.value?.userId))

  const loadDrafts = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]')
      drafts.value = Array.isArray(raw) ? raw : []
    } catch {
      drafts.value = []
    }
  }

  const persistDrafts = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.value))
  }

  const saveCurrentDraft = () => {
    // 编辑已有文章不写本地草稿，避免和线上内容混淆
    if (editId.value || (!title.value.trim() && !content.value.trim())) {
      return
    }
    const userId = user.value?.userId
    if (!userId) {
      return
    }
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

  // 发布成功后清掉当前草稿（confirmPublish 调用；原逻辑内联在发布提交里）
  const clearCurrentDraft = () => {
    if (currentDraftId.value) {
      drafts.value = drafts.value.filter((d) => d.id !== currentDraftId.value)
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
    saveHint,
    loadDrafts,
    loadDraft,
    removeDraft,
    clearCurrentDraft,
    saveCurrentDraft
  })
}
