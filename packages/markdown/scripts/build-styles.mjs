// 构建样式产物 dist/style.css：less 源码编译 + 内联 highlight.js 主题。
// 两端壳只 import '@nest-acticle/markdown/style.css' 这一个文件，无需各自安装 less；
// 内联主题避免让 client/admin 直连 highlight.js 的样式子路径（它们不是两端的直接依赖）。
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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

// 层叠顺序与原 client 壳一致：hljs 主题 → github-markdown 基础 → 站点补丁与代码块增强
const hljsTheme = await readFile(require.resolve('highlight.js/styles/github-dark.css'), 'utf8');
const css = [hljsTheme, await compileLess('github-markdown.less'), await compileLess('markdown.less')].join('\n');

await mkdir(join(pkgRoot, 'dist'), { recursive: true });
await writeFile(join(pkgRoot, 'dist', 'style.css'), css);
console.log('dist/style.css written');
