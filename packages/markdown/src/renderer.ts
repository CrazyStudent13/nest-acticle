import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

export interface MarkdownRendererOptions {
  /** 代码块右上角是否生成复制按钮（默认 true）；按钮的点击事件由组件壳用 ClipboardJS 绑定，包只产出带 data 属性的 HTML */
  copyButton?: boolean
}

export interface MarkdownRenderer {
  /** 输入兼容引号包裹内容与字面 \n（沿用 client MdViewer 的历史约定），输出 HTML 与前台文章页完全一致 */
  render(source: string): string
}

const escapeTextarea = (value: string) => value.replace(/<\/textarea>/g, '&lt;/textarea>')

// 接口返回的内容可能被引号包裹，仅在两端引号匹配时才剥离，避免截断正常内容
const normalizeContent = (value: string) => {
  let temp = value

  const wrappedBy =
    (temp.length >= 2 && temp.startsWith('"') && temp.endsWith('"')) ||
    (temp.length >= 2 && temp.startsWith("'") && temp.endsWith("'"))

  if (wrappedBy) {
    temp = temp.slice(1, -1)
  }

  return temp.replace(/\\n/g, '\n')
}

// 渲染配置逐字取自重构前 client MdViewer（等价性基准见 CODE-REVIEW-2026-11-20.md 第四节 P2-5）：
// 代码块复制按钮 + 行号占位 + 语言名标注，HTML 结构不可改动（两端壳的 CSS 与 ClipboardJS 都依赖这些类名）
export function createMarkdownRenderer(options: MarkdownRendererOptions = {}): MarkdownRenderer {
  const { copyButton = true } = options

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      const codeIndex = Date.now() + Math.floor(Math.random() * 10000000)
      let html = copyButton
        ? `<button class="copy-btn" type="button" data-clipboard-action="copy" data-clipboard-target="#copy${codeIndex}">复制</button>`
        : ''
      const linesLength = str.split(/\n/).length - 1
      let linesNum = '<span aria-hidden="true" class="line-numbers-rows">'

      for (let index = 0; index < linesLength; index++) {
        linesNum += '<span></span>'
      }

      linesNum += '</span>'

      if (lang && hljs.getLanguage(lang)) {
        try {
          const preCode = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
          html += preCode

          if (linesLength) {
            html += `<b class="name">${lang}</b>`
          }

          return `<pre class="hljs"><code>${html}</code>${linesNum}</pre><textarea style="position:absolute;top:-9999px;left:-9999px;z-index:-9999;" id="copy${codeIndex}">${escapeTextarea(str)}</textarea>`
        } catch (error) {
          console.error(error)
        }
      }

      html += md.utils.escapeHtml(str)
      return `<pre class="hljs"><code>${html}</code>${linesNum}</pre><textarea style="position:absolute;top:-9999px;left:-9999px;z-index:-9999;" id="copy${codeIndex}">${escapeTextarea(str)}</textarea>`
    }
  })

  return {
    render(source: string) {
      return md.render(normalizeContent(source))
    }
  }
}
