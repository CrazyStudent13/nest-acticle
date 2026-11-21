// 上传通用：文件走 common/upload，按 path 归档到对应目录，返回相对地址
// （原先在 editor/new.vue 与 Creator/ColumnEditModal.vue 各抄一份，收敛于此）
export const useUpload = () => {
  const uploadImage = async (file: File, path: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('path', path)
    const res = await apiFetch<{ url: string }>('/api/common/upload', { method: 'POST', body: form })
    return res.data?.url || ''
  }

  return { uploadImage }
}
