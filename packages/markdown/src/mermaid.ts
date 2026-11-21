// mermaid 安全配置显式声明：securityLevel 必须写死，不能依赖库的默认值——
// v12 当前默认 strict，但默认值随大版本升级可能漂移，安全边界一旦静默放宽就是 XSS 面。
// strict 语义：图表内的 HTML 标签被转义/净化（不执行）、禁用 click 回调等交互能力，
// 图表源码（来自用户文章内容）因此无法借 mermaid 注入脚本。
// initialize 只跑一次：mermaid 全局单例配置，重复 initialize 既冗余也可能覆盖运行时状态，
// 惰性放在首次动态 import 之后（无图表的文章不加载 mermaid 也不触碰配置）。
let mermaidInitialized = false

// mermaid 图表懒加载渲染：renderer 把 ```mermaid fence 标记为 .mermaid 容器（内容为转义后的图表源码），
// 宿主在挂载/内容更新后对本函数调用——内部动态 import mermaid（约 3MB 依赖闭包，vite/rolldown 独立
// 分包），不含图表的文章零加载成本。同一容器重复调用安全：mermaid.run 以 data-processed 幂等跳过。
export async function renderMermaidDiagrams(root: Element): Promise<number> {
  const nodes = Array.from(root.querySelectorAll('.mermaid')) as HTMLElement[]
  if (nodes.length === 0) {
    return 0
  }
  const mermaid = (await import('mermaid')).default
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
    mermaidInitialized = true
  }
  await mermaid.run({ nodes })
  return nodes.length
}
