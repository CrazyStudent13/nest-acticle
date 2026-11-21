/**
 * TS 纯后端预设（server 用）：typescript-eslint flat recommended + prettier 让位
 *
 * 与旧 .eslintrc（eslint 8 + @typescript-eslint v6）的规则面保持等价：
 * recommended 基线 + 关闭 no-explicit-any/no-unused-vars，prettier 只做让位不做注入。
 */
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const tsPreset = defineConfig(
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    }
  },

  tseslint.configs.recommended,

  {
    rules: {
      // server 大量 RuoYi 风格代码依赖 any 透传，不启用
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // 实体/DTO 属性为赋值式声明，空接口仅用于占位
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },

  eslintConfigPrettier,

  globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**'])
);
