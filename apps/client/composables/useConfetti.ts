// 注册成功礼花：基于 canvas-confetti 插件（零依赖 ~7KB），左右下角两门"礼炮"对射 + 中部补一炮
// 静态导入：该包 .mjs 内部虽为 CJS 写法但尾部有真正的 export default，静态图直接绑定函数本体，
// 不经过跨 chunk 动态门面——曾有 rollup 合并 chunk 时把动态门面的 default 错绑成其他模块的
// 导出对象，调用抛 TypeError 被 catch 吞掉，表现为注册成功但礼花无声消失。
// 模块顶层对 window/self 有环境守卫，SSR 导入安全；随注册弹窗 chunk 加载，不进首屏 bundle。
// 层级约定：注册弹窗(1000) < 礼花(zIndex 1500) < Toast(2000)；插件画布自带 pointer-events:none

import confetti from 'canvas-confetti'
import type { Options } from 'canvas-confetti'

const fireConfetti = () => {
  // 品牌色打底 + 常见节日色，与站点 --color-primary(#4f6bff) 呼应
  const defaults: Options = {
    colors: ['#4f6bff', '#ff6b6b', '#ffd93d', '#6bcb77', '#b07cf0', '#13c2c2', '#ff9f43'],
    zIndex: 1500,
    // 系统开启"减少动态效果"的用户直接跳过，插件的 promise 会立即 resolve
    disableForReducedMotion: true
  }

  // 左右下角向中上方对射（angle 60/120 即官方"侧炮"示例方向）
  confetti({ ...defaults, particleCount: 90, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.9 } })
  confetti({ ...defaults, particleCount: 90, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.9 } })
  // 中部补一炮，礼炮覆盖不到的中间区域也能撒满
  confetti({ ...defaults, particleCount: 60, spread: 100, startVelocity: 35, origin: { x: 0.5, y: 0.7 } })
}

export { fireConfetti }
