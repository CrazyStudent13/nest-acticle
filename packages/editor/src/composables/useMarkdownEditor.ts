// Markdown 编辑器核心：纯 textarea 选区操作——工具栏全部插入/包裹/行变换动作与 Ctrl+B/I 快捷键，
// 外加字数/行数统计。只依赖 content 状态与 textarea 元素引用（ref 传引用保持响应式），不含网络与弹窗逻辑；
// replaceRange 同时供组件内图片插入复用（光标恢复语义不变）。
// 行为契约（两端编辑页与既有用户习惯依赖，勿擅自变更）：快捷键集合（Ctrl+B / Ctrl+I）、
// 标题三级循环、引用/列表行变换、字数（去空白）统计口径。
import { computed, nextTick } from 'vue';
import type { Ref } from 'vue';

export const useMarkdownEditor = (content: Ref<string>, taRef: Ref<HTMLTextAreaElement | null>) => {
  // 字数（去空白字符）/ 行数统计 / 预计阅读时长（中文口径约 400 字/分钟）
  const charCount = computed(() => content.value.replace(/\s/g, '').length);
  const lineCount = computed(() => (content.value ? content.value.split('\n').length : 0));
  const readingMinutes = computed(() => Math.ceil(charCount.value / 400) || 0);

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

  // Tab 缩进：无选区/单行选区在光标处插两空格；跨行选区扩到整行后逐行加缩进（选区覆盖缩进后的整块）
  const indentSelection = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    if (start === end || !value.slice(start, end).includes('\n')) {
      replaceRange(start, end, '  ');
      return;
    }
    let lineStart = start;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') {
      lineStart--;
    }
    const lines = value.slice(lineStart, end).split('\n');
    const text = lines.map((line) => `  ${line}`).join('\n');
    replaceRange(lineStart, end, text, lineStart, lineStart + text.length);
  };

  // Shift+Tab 反缩进：逐行去掉最多两个行首空格（无可去内容的行保持原样）
  const unindentSelection = () => {
    const el = taRef.value;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    let lineStart = start;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') {
      lineStart--;
    }
    const lines = value.slice(lineStart, end).split('\n');
    const text = lines.map((line) => line.replace(/^ {1,2}/, '')).join('\n');
    if (text === lines.join('\n')) {
      return;
    }
    replaceRange(lineStart, end, text, lineStart, lineStart + text.length);
  };

  // 快捷键：Tab 缩进（阻止默认焦点跳转）+ Ctrl+B / Ctrl+I
  const handleShortcut = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        unindentSelection();
      } else {
        indentSelection();
      }
      return;
    }
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
    readingMinutes,
    replaceRange,
    wrapInline,
    cycleHeading,
    toggleLinePrefix,
    toggleOrderedList,
    insertCodeBlock,
    insertTable,
    insertHr,
    handleShortcut
  };
};
