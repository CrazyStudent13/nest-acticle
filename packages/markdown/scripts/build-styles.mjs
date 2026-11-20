// 构建样式产物 dist/style.css：less 源码编译 + 内联 highlight.js 主题 + 内联 katex 样式与字体。
// 两端壳只 import '@nest-acticle/markdown/style.css' 这一个文件，无需各自安装 less/katex；
// 内联主题避免让 client/admin 直连 highlight.js/katex 的样式子路径（它们不是两端的直接依赖）。
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import less from 'less';

const require = createRequire(import.meta.url);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const compileLess = async (file) => {
  const filename = join(pkgRoot, 'src/styles', file);
  const { css } = await less.render(await readFile(filename, 'utf8'), { filename });
  return css;
};

// 层叠顺序与原 client 壳一致：hljs 主题 → github-markdown 基础 → 站点补丁与代码块增强 → katex 公式
const hljsTheme = await readFile(require.resolve('highlight.js/styles/github-dark.css'), 'utf8');
const katexCssPath = require.resolve('katex/dist/katex.min.css');
const katexCss = await readFile(katexCssPath, 'utf8');
const css = [hljsTheme, await compileLess('github-markdown.less'), await compileLess('markdown.less'), katexCss].join('\n');

await mkdir(join(pkgRoot, 'dist'), { recursive: true });
await writeFile(join(pkgRoot, 'dist', 'style.css'), css);

// katex 字体随包分发：katex.min.css 里的 url(fonts/…) 相对本文件解析，两端打包器会把这些字体
// 作为普通资源发射，浏览器只按需下载实际用到的字形
await cp(join(dirname(katexCssPath), 'fonts'), join(pkgRoot, 'dist', 'fonts'), { recursive: true });
console.log('dist/style.css written (katex css + fonts included)');
