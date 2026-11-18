import { tsPreset } from '@nest-acticle/eslint-config';

// 由 .eslintrc.js（eslint 8 + @typescript-eslint v6）迁移至 flat config（eslint 10），
// 规则面等价：recommended 基线 + 关闭 no-explicit-any/no-unused-vars，prettier 让位
export default [
  {
    files: ['src/**/*.ts', 'test/**/*.ts']
  },

  ...tsPreset
];
