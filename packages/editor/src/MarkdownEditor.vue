<!-- 共享 Markdown 编辑器：textarea + 工具栏 + Ctrl+B/I 快捷键 + 字数/行数统计 + 左写右预览 + 粘贴/按钮图片上传。
     上传经 uploadImage 回调注入（裁剪/上传/地址补全是宿主业务，包不绑死任何 app 的体系）；
     预览渲染走 @nest-acticle/markdown 的 createMarkdownRenderer，与前台文章页同源；
     工具栏/快捷键/字数统计逻辑自 client useMarkdownEditor 逐行迁入（集合不变）。 -->
<template>
  <div class="na-md-editor" :style="{ height }">
    <!-- 工具栏 -->
    <div class="na-md-editor-toolbar">
      <button class="na-md-editor-tool-btn na-md-editor-tool-text" type="button" title="标题" @click="cycleHeading">H</button>
      <button class="na-md-editor-tool-btn na-md-editor-tool-text" type="button" title="加粗 (Ctrl+B)" @click="wrapInline('**', '**', '加粗文本')"><b>B</b></button>
      <button class="na-md-editor-tool-btn na-md-editor-tool-text" type="button" title="斜体 (Ctrl+I)" @click="wrapInline('*', '*', '斜体文本')"><i>I</i></button>

      <span class="na-md-editor-tool-divider" />

      <button class="na-md-editor-tool-btn na-md-editor-tool-text" type="button" title="引用" @click="toggleLinePrefix('> ')">”</button>
      <button class="na-md-editor-tool-btn" type="button" title="链接" @click="insertLink">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
      <button class="na-md-editor-tool-btn" type="button" title="上传图片" :disabled="uploading" @click="pickImage">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </button>

      <span class="na-md-editor-tool-divider" />

      <button class="na-md-editor-tool-btn na-md-editor-tool-text na-md-editor-tool-code" type="button" title="行内代码" @click="wrapInline('`', '`', '代码')"><span>&lt;/&gt;</span></button>
      <button class="na-md-editor-tool-btn" type="button" title="代码块" @click="insertCodeBlock">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>

      <span class="na-md-editor-tool-divider" />

      <button class="na-md-editor-tool-btn" type="button" title="无序列表" @click="toggleLinePrefix('- ')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="9" y1="6" x2="21" y2="6" />
          <line x1="9" y1="12" x2="21" y2="12" />
          <line x1="9" y1="18" x2="21" y2="18" />
          <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button class="na-md-editor-tool-btn na-md-editor-tool-text" type="button" title="有序列表" @click="toggleOrderedList">1.</button>
      <button class="na-md-editor-tool-btn" type="button" title="表格" @click="insertTable">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </button>
      <button class="na-md-editor-tool-btn na-md-editor-tool-text" type="button" title="分割线" @click="insertHr">—</button>
      <input ref="imgInput" class="na-md-editor-img-input" type="file" accept="image/*" @change="handleImgChange" />
    </div>

    <!-- 左写右预览 -->
    <div class="na-md-editor-body">
      <textarea
        ref="taRef"
        v-model="content"
        class="na-md-editor-input"
        :placeholder="placeholder"
        @keydown="handleShortcut"
        @paste="handlePaste"
      />
      <div v-if="preview" class="na-md-editor-preview">
        <!-- 预览 HTML 由 @nest-acticle/markdown 产出（宿主需引入其 style.css），与文章详情页渲染同源 -->
        <div v-html="previewHtml"></div>
      </div>
    </div>

    <!-- 状态栏：字数/行数内置，其余状态（如草稿保存提示）经 status-extra 插槽追加 -->
    <footer class="na-md-editor-status">
      <span>字数 {{ charCount }}</span>
      <span>行数 {{ lineCount }}</span>
      <slot name="status-extra" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import ClipboardJS from 'clipboard';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { createMarkdownRenderer } from '@nest-acticle/markdown';

import { useMarkdownEditor } from './composables/useMarkdownEditor';

const props = withDefaults(
  defineProps<{
    /** 正文内容（v-model） */
    modelValue: string;
    /** 图片上传回调：入参原始 File，返回 markdown 可用的 URL；未传时粘贴/按钮上传静默忽略并 console.warn */
    uploadImage?: (file: File) => Promise<string>;
    /** 占位文案 */
    placeholder?: string;
    /** 编辑器整体高度 */
    height?: string;
    /** 是否左写右预览（预览渲染与前台文章页同源） */
    preview?: boolean;
  }>(),
  {
    uploadImage: undefined,
    placeholder: '请输入内容（支持 Markdown 语法）',
    height: '100%',
    preview: true
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// 双向绑定桥：包内读写都走这个可写 computed，宿主侧只依赖 v-model
const content = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
});

const taRef = ref<HTMLTextAreaElement | null>(null);
const {
  charCount,
  lineCount,
  replaceRange,
  cycleHeading,
  wrapInline,
  toggleLinePrefix,
  toggleOrderedList,
  insertLink,
  insertCodeBlock,
  insertTable,
  insertHr,
  handleShortcut
} = useMarkdownEditor(content, taRef);

// ---------- 预览：渲染器与前台文章页同源 ----------
const renderer = createMarkdownRenderer();
const previewHtml = computed(() => (props.modelValue ? renderer.render(props.modelValue) : ''));

// 预览代码块复制按钮：与两端 MdViewer 壳一致的绑定与反馈（ClipboardJS 全局委托，卸载销毁）
let clipboard: ClipboardJS | null = null;

onMounted(() => {
  clipboard = new ClipboardJS('.copy-btn');
  clipboard.on('success', (event) => {
    event.clearSelection();
    const trigger = event.trigger as HTMLElement | undefined;
    if (trigger) {
      trigger.textContent = '已复制';
      trigger.classList.add('copied');
      setTimeout(() => {
        trigger.textContent = '复制';
        trigger.classList.remove('copied');
      }, 1500);
    }
  });
  clipboard.on('error', (event) => {
    console.error('Action:', event.action);
    console.error('Trigger:', event.trigger);
  });
});

onBeforeUnmount(() => {
  clipboard?.destroy();
  clipboard = null;
});

// ---------- 图片上传（工具栏按钮 + 粘贴）：经 uploadImage 回调交宿主处理 ----------
const imgInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const pickImage = () => {
  imgInput.value?.click();
};

const handleImgChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    uploadAndInsert(file);
  }
};

// 粘贴截图直接进入上传流程
const handlePaste = (event: ClipboardEvent) => {
  const file = Array.from(event.clipboardData?.files || []).find((f) => /^image\//.test(f.type));
  if (file) {
    event.preventDefault();
    uploadAndInsert(file);
  }
};

// 图片上传：先取当前选区（宿主的裁剪弹窗/网络等待会夺走焦点与光标，插入位置必须在回调前捕获），
// 成功后以 markdown 图片语法回填原选区；失败/取消的提示由宿主回调负责，组件保证不插入残缺内容
const uploadAndInsert = (file: File) => {
  const upload = props.uploadImage;
  if (!upload) {
    console.warn('[MarkdownEditor] 未提供 uploadImage 回调，图片上传已忽略');
    return;
  }
  const el = taRef.value;
  const start = el ? el.selectionStart : content.value.length;
  const end = el ? el.selectionEnd : content.value.length;
  uploading.value = true;
  upload(file)
    .then((url) => {
      if (url) {
        replaceRange(start, end, `![${file.name}](${url})`);
      }
    })
    .catch(() => {
      // 宿主已提示，这里不吞错也不插入
    })
    .finally(() => {
      uploading.value = false;
      if (imgInput.value) {
        imgInput.value.value = '';
      }
    });
};

// 供宿主外部插入内容（如裁剪回调回填）
const insertText = (text: string) => {
  const el = taRef.value;
  const start = el ? el.selectionStart : content.value.length;
  const end = el ? el.selectionEnd : content.value.length;
  replaceRange(start, end, text);
};

defineExpose({ insertText });
</script>

<style lang="less">
// 颜色走宿主 CSS 变量并提供回退默认值（参照 @nest-acticle/markdown 的做法）：client 深浅主题经
// tokens 切换生效；admin 无该变量体系，回退值即浅色主题。样式以 .na-md-editor 命名空间隔离。
.na-md-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;

  // ---------- 工具栏 ----------
  &-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 44px;
    padding: 0 12px;
    background-color: var(--color-surface, #ffffff);
    border-bottom: 1px solid var(--color-border-light, #f0f1f3);
    overflow-x: auto;

    .na-md-editor-tool-btn {
      flex-shrink: 0;
      width: 34px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: var(--radius-sm, 4px);
      background-color: transparent;
      color: var(--color-text-2, #4e5969);
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;

      &:hover:not(:disabled) {
        background-color: var(--color-bg, #f7f8fa);
        color: var(--color-text-1, #1f2329);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .na-md-editor-tool-text {
      font-size: 14px;
      font-weight: 600;
      font-family: Georgia, serif;

      i {
        font-weight: 400;
      }
    }

    .na-md-editor-tool-code {
      font-size: 11px;
      font-family: Consolas, Monaco, monospace;
      font-weight: 400;
    }

    .na-md-editor-tool-divider {
      flex-shrink: 0;
      width: 1px;
      height: 16px;
      margin: 0 6px;
      background-color: var(--color-border-light, #f0f1f3);
    }
  }

  // 隐藏原生文件选择框
  .na-md-editor-img-input {
    display: none;
  }

  // ---------- 编辑区 ----------
  &-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  &-input {
    flex: 1;
    min-width: 0;
    padding: 24px 32px;
    border: 0;
    outline: none;
    resize: none;
    background-color: var(--color-surface, #ffffff);
    font-size: 15px;
    line-height: 1.9;
    font-family: inherit;
    color: var(--color-text-1, #1f2329);
    caret-color: var(--color-primary, #4f6bff);

    &::placeholder {
      color: var(--color-text-3, #86909c);
    }
  }

  &-preview {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 24px 40px;
    background-color: var(--color-surface, #ffffff);
    border-left: 1px solid var(--color-border-light, #f0f1f3);
  }

  // ---------- 状态栏 ----------
  &-status {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    height: 28px;
    padding: 0 20px;
    background-color: var(--color-surface, #ffffff);
    border-top: 1px solid var(--color-border-light, #f0f1f3);
    font-size: 12px;
    color: var(--color-text-3, #86909c);
  }
}

// 窄屏隐藏预览（与原 client 编辑页行为一致）
@media (max-width: 900px) {
  .na-md-editor-preview {
    display: none;
  }
}
</style>
