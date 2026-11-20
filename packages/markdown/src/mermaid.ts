// mermaid 图表懒加载渲染：renderer 把 ```mermaid fence 标记为 .mermaid 容器（内容为转义后的图表源码），
// 宿主在挂载/内容更新后对本函数调用——内部动态 import mermaid（约 3MB 依赖闭包，vite/rolldown 独立
// 分包），不含图表的文章零加载成本。同一容器重复调用安全：mermaid.run 以 data-processed 幂等跳过。
export async function renderMermaidDiagrams(root: Element): Promise<number> {
  const nodes = Array.from(root.querySelectorAll('.mermaid')) as HTMLElement[]
  if (nodes.length === 0) {
    return 0
  }
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({ startOnLoad: false })
  await mermaid.run({ nodes })
  return nodes.length
}
