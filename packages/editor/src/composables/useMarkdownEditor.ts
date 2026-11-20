// Markdown 编辑器核心：纯 textarea 选区操作——工具栏全部插入/包裹/行变换动作与 Ctrl+B/I 快捷键，
// 外加字数/行数统计。自 client composables/useMarkdownEditor.ts 迁入（会话 M 编辑器统一），
// 只依赖 content 状态与 textarea 元素引用（ref 传引用保持响应式），不含网络与弹窗逻辑；
// replaceRange 同时供组件内图片插入复用（光标恢复语义不变）。
// 逻辑逐字保留：快捷键集合（Ctrl+B / Ctrl+I）、标题三级循环、引用/列表行变换、字数（去空白）统计。
import { computed, nextTick } from 'vue';
import type { Ref } from 'vue';

export const useMarkdownEditor = (content: Ref<string>, taRef: Ref<HTMLTextAreaElement | null>) => {
  // 字数（去空白字符）/ 行数统计
  const charCount = computed(() => content.value.replace(/\s/g, '').length);
  const lineCount = computed(() => (content.value ? content.value.split('\n').length : 0));

  // 选区替换：优先 execCommand('insertText') 写入——它走浏览器的输入路径，保留 textarea 原生撤销栈
  // （Ctrl+Z 可撤销工具栏插入/包裹操作），直接赋值 v-model 会清空撤销历史；execCommand 不可用时
  // 回退直赋值（牺牲撤销保插入成功），此时需在 nextTick 等 v-model 回写后再恢复焦点与光标
  const replaceRange = (start: number, end: number, text: string, caretStart?: number, caretEnd?: number) => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    el.focus();
    el.setSelectionRange(start, end);
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch {
      inserted = false;
    }
    if (inserted) {
      // execCommand 同步更新 DOM 值并经 input 事件驱动 v-model，直接恢复光标
      // （包裹类操作要把选区落回包裹内容，如加粗后选中粗体文本便于继续输入）
      const s = caretStart ?? start + text.length;
      const e = caretEnd ?? start + text.length;
      el.setSelectionRange(s, e);
      return;
    }
    content.value = el.value.slice(0, start) + text + el.value.slice(end);
    nextTick(() => {
      el.focus();
      const s = caretStart ?? start + text.length;
      const e = caretEnd ?? start + text.length;
      el.setSelectionRange(s, e);
    });
  };

  // 行内包裹：加粗 / 斜体 / 行内代码
  const wrapInline = (before: string, after: string, placeholder: string) => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    const inner = selected || placeholder;
    const caretStart = start + before.length;
    replaceRange(start, end, before + inner + after, caretStart, caretStart + inner.length);
  };

  // 选区扩展到整行后逐行处理（引用 / 列表 / 标题）
  const transformLines = (transform: (line: string, index: number) => string) => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const value = el.value;
    let start = el.selectionStart;
    const end = el.selectionEnd;
    while (start > 0 && value[start - 1] !== '\n') {
      start--;
    }
    const lines = value.slice(start, end).split('\n');
    const text = lines.map(transform).join('\n');
    replaceRange(start, end, text, start, start + text.length);
  };

  // 标题：无 → # → ## → ### → 无 循环（按首行当前级别推进）
  const cycleHeading = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const lineStart = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const currentLine = el.value.slice(lineStart, el.selectionEnd);
    const level = currentLine.match(/^(#{1,3})\s/);
    const levelMark = level?.[1];
    const next = levelMark ? (levelMark.length >= 3 ? '' : '#'.repeat(levelMark.length + 1) + ' ') : '# ';
    transformLines((line) => next + line.replace(/^#{1,3}\s/, ''));
  };

  // 引用 / 无序列表：有前缀则去掉，没有则加上
  const toggleLinePrefix = (prefix: string) => {
    transformLines((line) => {
      if (line.startsWith(prefix)) {
        return line.slice(prefix.length);
      }
      return prefix + line;
    });
  };

  // 有序列表：按行编号 1. 2. 3.，已编号则还原
  const toggleOrderedList = () => {
    let index = 0;
    transformLines((line) => {
      const stripped = line.replace(/^\d+\.\s/, '');
      if (stripped !== line) {
        return stripped;
      }
      index += 1;
      return `${index}. ${line}`;
    });
  };

  // 链接：选中文本作为标题，弹窗输入地址
  const insertLink = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
    const url = window.prompt('请输入链接地址', 'https://');
    if (!url || url === 'https://') {
      return;
    }
    wrapInline('[', `](${url})`, selected || '链接标题');
  };

  // 代码块
  const insertCodeBlock = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    const text = `\n\`\`\`\n${selected || '// 代码'}\n\`\`\`\n`;
    replaceRange(start, end, text);
  };

  // 表格模板
  const insertTable = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = `\n| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n`;
    replaceRange(start, end, text);
  };

  // 分割线
  const insertHr = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    replaceRange(el.selectionStart, el.selectionEnd, '\n\n---\n\n');
  };

  // 快捷键：Ctrl+B / Ctrl+I
  const handleShortcut = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      wrapInline('**', '**', '加粗文本');
    } else if (key === 'i') {
      event.preventDefault();
      wrapInline('*', '*', '斜体文本');
    }
  };

  return {
    charCount,
    lineCount,
    replaceRange,
    wrapInline,
    cycleHeading,
    toggleLinePrefix,
    toggleOrderedList,
    insertLink,
    insertCodeBlock,
    insertTable,
    insertHr,
    handleShortcut
  };
};
