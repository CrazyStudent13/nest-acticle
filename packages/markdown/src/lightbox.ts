// 文章图片放大预览（lightbox）：宿主壳经 bindImageLightbox 绑定点击委托——点击 .markdown-body 内
// 图片时以全屏遮罩展示原图，点击遮罩空白区或 ESC 关闭（点图片本身不关，便于看图时随意点按）。
// 实现为包内命令式 DOM（不依赖 Vue），两端壳与编辑器预览共用同一实现；样式收在 dist/style.css
// 的 .na-markdown-lightbox。

const OVERLAY_CLASS = 'na-markdown-lightbox'

let overlay: HTMLElement | null = null
let lastFocus: HTMLElement | null = null

const closeOverlay = () => {
  if (!overlay) {
    return
  }
  overlay.style.display = 'none'
  lastFocus?.focus?.()
  lastFocus = null
}

function ensureOverlay(): HTMLElement {
  if (overlay) {
    return overlay
  }
  overlay = document.createElement('div')
  overlay.className = OVERLAY_CLASS
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', '图片预览')
  // 接收焦点用：显示时把焦点移入遮罩（基础 a11y，ESC 关闭后还原；不做完整 focus trap）
  overlay.setAttribute('tabindex', '-1')

  const img = document.createElement('img')
  img.alt = ''
  overlay.appendChild(img)

  // 点遮罩空白区关闭；点图片本身不关（target 判断，图片上不需要额外 stopPropagation）
  overlay.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('img')) {
      return
    }
    closeOverlay()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay!.style.display !== 'none') {
      closeOverlay()
    }
  })

  document.body.appendChild(overlay)
  return overlay
}

export function openImageLightbox(src: string): void {
  if (typeof document === 'undefined' || !src) {
    return
  }
  const el = ensureOverlay()
  lastFocus = document.activeElement as HTMLElement | null
  el.querySelector('img')!.src = src
  el.style.display = 'flex'
  el.focus()
}

/**
 * 在容器上绑定图片放大点击委托（事件委托，v-html 重渲染无需重绑）。
 * @returns 解绑函数，宿主在卸载时调用
 */
export function bindImageLightbox(container: Element): () => void {
  const onClick = (event: Event) => {
    const target = event.target as HTMLElement
    const img = target.closest('img')
    if (img && container.contains(img)) {
      event.preventDefault()
      openImageLightbox((img as HTMLImageElement).currentSrc || img.getAttribute('src') || '')
    }
  }
  container.addEventListener('click', onClick)
  return () => container.removeEventListener('click', onClick)
}
