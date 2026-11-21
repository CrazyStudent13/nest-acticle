/**
 * Vue 前端预设（admin 用）：vue flat essential + vue-ts recommended + prettier 让位 + perfectionist 排序
 *
 * 规则面从 admin 原 eslint.config.js 原样迁移；调用方仍需自行声明
 * files-to-lint / globalIgnores / 应用侧特有覆盖。
 */
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, configureVueProject, vueTsConfigs } from '@vue/eslint-config-typescript';
import perfectionist from 'eslint-plugin-perfectionist';
import pluginVue from 'eslint-plugin-vue';

/**
 * @param {object} [options]
 * @param {string[]} [options.scriptLangs] 允许的 SFC 脚本语言，默认 ['ts']
 */
export function vuePreset(options = {}) {
  configureVueProject({ scriptLangs: options.scriptLangs || ['ts'] });

  return defineConfigWithVueTs(
    pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,

    skipFormatting,

    {
      plugins: {
        perfectionist
      },
      rules: {
        // vue
        'vue/multi-word-component-names': 'off',
        // 项目以 JS 为主的 SFC，不强制 <script lang>
        'vue/block-lang': 'off',

        // typescript
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            // 大量回调签名带未使用的占位参数（如 (row, column)），不报
            args: 'none',
            varsIgnorePattern: '^_'
          }
        ],

        // perfectionist
        'perfectionist/sort-exports': 'warn',
        'perfectionist/sort-imports': [
          'warn',
          {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type']
          }
        ],
        'perfectionist/sort-objects': 'off'
      }
    }
  );
}
