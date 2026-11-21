// 发布弹窗逻辑：专栏拉取（走 useSubject guest 列表）/封面 16:9 裁剪上传（复用 useImageCrop+useUpload）/
// 发布校验与提示/提交。提交保留 apiFetch<{ id: number }> 直调——
// useArticleManage 的 updateArticle 签名（PUT+publishStatus 必填）与本页 POST/PUT 共用体不吻合，URL 与 body 逐字保留。
// 状态经 reactive 返回（PublishStore）：PublishModal 组件以单一 store prop + v-model 显隐对接，
// 页面只做 openPublish 触发与编辑模式预填；生命周期仍随页面挂载（刻意不用 useState，避免跨导航残留发布态）。
import dayjs from 'dayjs'
import type { Ref } from 'vue'
import type { Subject } from '@nest-acticle/shared'

interface PublishOptions {
  title: Ref<string>
  content: Ref<string>
  editId: Ref<string>
  // 打开弹窗前的标题/内容校验走页面顶部红条（3s 自动消失）
  setTopTip: (message: string) => void
  // 发布成功后清除当前本地草稿（来自 useDraftBox）
  clearCurrentDraft: () => void
}

export const usePublish = (options: PublishOptions) => {
  const { title, content, editId, setTopTip, clearCurrentDraft } = options
  const config = useRuntimeConfig()
  const { uploadImage } = useUpload()

  const open = ref(false)
  const publishing = ref(false)
  const publishTip = ref('')
  const subjects = ref<Subject[]>([])
  const subjectsLoading = ref(false)
  const publishForm = reactive({ subjectId: '', cover: '', desc: '' })
  const coverUploading = ref(false)

  const coverPreview = computed(() => toCoverUrl(config.public.apiBase, publishForm.cover))

  // 简介：取正文纯文本前 100 字作为默认摘要
  const autoDesc = () => {
    const plain = content.value
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*`~\-|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return plain.slice(0, 100)
  }

  const fetchSubjects = async () => {
    subjectsLoading.value = true
    try {
      const { fetchGuestSubjects } = useSubject()
      const data = await fetchGuestSubjects({ pageNum: 1, pageSize: 50 })
      subjects.value = data.list || []
    } catch {
      // 拉取失败按无专栏处理：行隐藏、允许继续发布，仅提示可稍后归类
      subjects.value = []
      showToast('专栏列表加载失败，文章将暂不归入专栏', 'warning')
    } finally {
      subjectsLoading.value = false
    }
  }

  const openPublish = () => {
    if (!title.value.trim()) {
      setTopTip('请先输入文章标题')
      return
    }
    if (!content.value.trim()) {
      setTopTip('请先输入文章内容')
      return
    }
    publishTip.value = ''
    // 编辑模式保留已预填的专栏/封面/简介，仅新建时重置
    if (!editId.value) {
      publishForm.subjectId = ''
      publishForm.desc = autoDesc()
    }
    open.value = true
    fetchSubjects()
  }

  // 悬浮移除封面（原为弹窗模板内联赋值 publishForm.cover = ''）
  const removeCover = () => {
    publishForm.cover = ''
  }

  const handleCoverChange = async (event: Event) => {
    const inputEl = event.target as HTMLInputElement
    const file = inputEl.files?.[0]
    inputEl.value = ''
    if (!file) {
      return
    }
    if (!/^image\//.test(file.type)) {
      publishTip.value = '请选择图片文件'
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片不能超过 5MB', 'error')
      return
    }
    // 封面按 16:9 裁剪后再上传，取消则静默结束
    let cropped: File
    try {
      cropped = await cropImage(file, { title: '裁剪封面', aspectRatio: 16 / 9 })
    } catch {
      return
    }
    coverUploading.value = true
    try {
      const url = await uploadImage(cropped, 'article/cover')
      publishForm.cover = url
      publishTip.value = ''
    } catch (error: any) {
      publishTip.value = error?.message || '封面上传失败'
    } finally {
      coverUploading.value = false
    }
  }

  const confirmPublish = async () => {
    // 有可选专栏时必须选择；列表为空时跳过后端会存为 0（未归类）
    if (subjects.value.length && !publishForm.subjectId) {
      publishTip.value = '请选择专栏'
      return
    }
    publishing.value = true
    publishTip.value = ''
    // publishStatus 不再发送：服务端 DTO 已剥离该字段（BUG-6），发布状态由服务端 create() 写死、
    // 更新分支同样忽略该字段，发送等于死字段（上下架走 creator 文章管理，不在此处）
    const body: Record<string, any> = {
      title: title.value.trim(),
      desc: publishForm.desc.trim() || undefined,
      content: content.value,
      cover: publishForm.cover || undefined,
      source: '0'
    }
    if (publishForm.subjectId) {
      body.subjectId = Number(publishForm.subjectId)
    }
    if (editId.value) {
      // 更新：PUT 幂等携带 id，publishTime 不传则保留原发布时间
      body.id = Number(editId.value)
    } else {
      body.publishTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
    try {
      const res = await apiFetch<{ id: number }>('/api/post/article', {
        method: editId.value ? 'PUT' : 'POST',
        body
      })
      const newId = editId.value ? editId.value : res.data?.id
      // 发布成功后清掉对应本地草稿
      clearCurrentDraft()
      open.value = false
      showToast(editId.value ? '保存成功' : '发布成功', 'success')
      return navigateTo({ path: '/article/detail', query: { id: String(newId) } })
    } catch (error: any) {
      publishTip.value = error?.message || '保存失败，请稍后重试'
    } finally {
      publishing.value = false
    }
  }

  return reactive({
    open,
    publishing,
    publishTip,
    subjects,
    subjectsLoading,
    publishForm,
    coverUploading,
    coverPreview,
    openPublish,
    removeCover,
    handleCoverChange,
    confirmPublish
  })
}

export type PublishStore = ReturnType<typeof usePublish>
