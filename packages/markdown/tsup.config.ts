import { defineConfig } from 'tsup';

// 双格式输出：ESM 供 Nuxt/Vite，CJS 兜底；dts 供两端类型解析
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  target: 'es2021',
});
