import { vuePreset } from '@nest-acticle/eslint-config';
import { globalIgnores } from 'eslint/config';

// 规则面收敛在 @nest-acticle/eslint-config 的 vuePreset（vue essential + vue-ts recommended
// + prettier 让位 + perfectionist 排序），此处只保留应用侧的扫描范围与忽略清单
export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'auto-imports.d.ts', 'components.d.ts']),

  ...vuePreset({ scriptLangs: ['ts', 'tsx'] })
];
