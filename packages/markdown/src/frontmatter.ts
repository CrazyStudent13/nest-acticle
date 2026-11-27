// YAML front matter（Hexo/Hugo 等静态博客导出的文章头）解析：
// --- 开头、--- 或 ... 结尾，仅支持扁平的 key: value 与 [a, b] 数组。
// 渲染与目录提取都先剥离它；编辑器导入 .md 时用它回填标题等信息。
export type MarkdownFrontMatterValue = string | string[];

export interface MarkdownFrontMatter {
  data: Record<string, MarkdownFrontMatterValue>;
  content: string;
}

const FRONT_MATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

const unquote = (value: string) => {
  const text = value.trim();
  if (text.length >= 2 && ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')))) {
    return text.slice(1, -1);
  }
  return text;
};

const parseScalar = (raw: string): MarkdownFrontMatterValue => {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map(unquote)
      .filter(Boolean);
  }
  return unquote(value);
};

const parseData = (raw: string) => {
  const data: Record<string, MarkdownFrontMatterValue> = {};
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) {
      continue;
    }
    const colon = text.indexOf(':');
    if (colon <= 0) {
      continue;
    }
    const key = text.slice(0, colon).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      continue;
    }
    data[key] = parseScalar(text.slice(colon + 1));
  }
  return data;
};

export const parseMarkdownFrontMatter = (source?: string): MarkdownFrontMatter => {
  const input = (source || '').replace(/^\uFEFF/, '');
  if (!input.startsWith('---')) {
    return { data: {}, content: input };
  }
  const match = FRONT_MATTER_PATTERN.exec(input);
  if (!match) {
    return { data: {}, content: input };
  }
  const data = parseData(match[1] || '');
  // 没有任何 key: value 时不当作 front matter（避免把以 --- 分割线的正文误剥）
  if (Object.keys(data).length === 0) {
    return { data: {}, content: input };
  }
  return { data, content: input.slice(match[0].length) };
};

export const stripMarkdownFrontMatter = (source?: string): string => parseMarkdownFrontMatter(source).content;