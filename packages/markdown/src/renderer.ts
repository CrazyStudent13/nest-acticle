import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import { katex as katexPlugin } from '@mdit/plugin-katex'

export interface MarkdownRendererOptions {
  /** 代码块右上角是否生成复制按钮（默认 true）；按钮的点击事件由组件壳用 ClipboardJS 绑定，包只产出带 data 属性的 HTML */
  copyButton?: boolean
  /** 是否渲染行内 $...$ 与块级 $$...$$ 数学公式（默认 true，katex）。插件对"$ 后紧跟数字"的计价文案做了规避（如 价格 $5 和 $10 保持字面） */
  math?: boolean
  /** 是否把 ```mermaid 代码块输出为待渲染的 .mermaid 容器（默认 true）；容器由宿主调 renderMermaidDiagrams 懒加载渲染，不含图表的文章零加载成本 */
  mermaid?: boolean
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
  const { copyButton = true, math = true, mermaid: withMermaid = true } = options

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

  // 数学公式：行内 $...$ / 块级 $$...$$（katex 渲染为带 .katex 类的 HTML，样式随包 style.css 分发）
  if (math) {
    md.use(katexPlugin, { throwOnError: false })
  }

  // mermaid：仅改写该语言的 fence 为 .mermaid 容器（宿主经 renderMermaidDiagrams 懒加载渲染），
  // 其余语言委托默认 fence（复制按钮/行号/highlight 逻辑不受影响）
  if (withMermaid) {
    const defaultFence = md.renderer.rules.fence
    md.renderer.rules.fence = (tokens, idx, mdOptions, env, self) => {
      const token = tokens[idx]
      if (token.info.trim() === 'mermaid') {
        return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>\n`
      }
      return defaultFence!(tokens, idx, mdOptions, env, self)
    }
  }

  // 站外链接新窗口打开（markdown 显式链接与 linkify 自动链接同走 link_open 规则）；
  // 站内相对链接保持当前页跳转。rel 带 noopener 防 tabnabbing
  const defaultLinkOpen = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, idx, mdOptions, env, self) => {
    const token = tokens[idx]
    const href = token.attrGet('href') || ''
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
    return defaultLinkOpen ? defaultLinkOpen(tokens, idx, mdOptions, env, self) : self.renderToken(tokens, idx, mdOptions)
  }

  // 图片懒加载：长文多图首屏不再被图片阻塞（loading=lazy）+ 异步解码
  const defaultImage = md.renderer.rules.image
  md.renderer.rules.image = (tokens, idx, mdOptions, env, self) => {
    tokens[idx].attrSet('loading', 'lazy')
    tokens[idx].attrSet('decoding', 'async')
    return defaultImage ? defaultImage(tokens, idx, mdOptions, env, self) : self.renderToken(tokens, idx, mdOptions)
  }

  return {
    render(source: string) {
      return md.render(normalizeContent(source))
    }
  }
}
