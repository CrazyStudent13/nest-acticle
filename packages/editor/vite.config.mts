import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// 组件打包选型说明：tsup 只接受 esbuild 插件，@vitejs/plugin-vue 是 vite 插件无法挂进 tsup
// 管线，SFC 编译走 vite lib mode（产物 exports 形态与 @nest-acticle/markdown 对齐：
// 双格式 js + 单一 types 入口 + style.css）；类型由 vue-tsc 生成（SFC 的 .vue.d.ts）。
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
      cssFileName: 'style'
    },
    rollupOptions: {
      // vue 为 peerDependency；markdown/clipboard 声明为 dependencies，均由宿主解析，不打进产物
      external: ['vue', 'clipboard', '@nest-acticle/markdown']
    },
    target: 'es2021',
    minify: false,
    sourcemap: false,
    emptyOutDir: true
  }
});
