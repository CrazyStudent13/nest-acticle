/**
 * gen:api 前置新鲜度检查：防止契约重生成跑在陈旧的 openApi.json dump 上。
 *
 * 背景：apps/server/openApi.json 被 .gitignore、不入库，且只有 server 进程启动时
 * 才会把 Swagger spec 写到「进程 CWD」（见 apps/server/src/common/utils/api-docs.ts：
 * writeFileSync(join(process.cwd(), 'openApi.json'))），再人工拷回 apps/server/。
 * 因此 gen:api 之前必须保证：这份 dump 由「当前最新代码」的 server 启动落盘过。
 * 历史上 2026-11-23 之后连续多次「重生成」都跑在陈旧 dump 上，契约系统性滞后。
 *
 * 判据：nest build 会清空重建 dist，dist/main.js 的 mtime 即最近一次 server 构建
 * 完成时间；openApi.json 只会在构建之后的 server 启动中落盘。若 dump 早于构建，
 * spec 必然不含最新代码，直接拒绝生成。
 *
 * 正确流程：
 *   1. pnpm --filter server build
 *   2. 以最新代码启动一次 server（NODE_ENV=development，启动即把 openApi.json
 *      落盘到进程 CWD，通常是 apps/server/，若换目录启动记得拷回）
 *   3. 确认 apps/server/openApi.json 已更新 → pnpm --filter @nest-acticle/shared gen:api
 *   4. pnpm --filter @nest-acticle/shared build
 *
 * 确需跳过本检查（自担风险）：SKIP_OPENAPI_FRESHNESS_CHECK=1
 */
const { statSync } = require('fs');
const { join } = require('path');

if (process.env.SKIP_OPENAPI_FRESHNESS_CHECK === '1') {
  console.warn('[gen:api] 已按 SKIP_OPENAPI_FRESHNESS_CHECK=1 跳过新鲜度检查，请自行确认 openApi.json 由最新代码落盘。');
  process.exit(0);
}

const repoRoot = join(__dirname, '..', '..', '..');
const dumpPath = join(repoRoot, 'apps', 'server', 'openApi.json');
const distEntry = join(repoRoot, 'apps', 'server', 'dist', 'main.js');

const fail = (reason) => {
  console.error(`\n[gen:api] 拒绝重生成契约：${reason}`);
  console.error('[gen:api] 正确流程：pnpm --filter server build → 以最新代码启动一次 server（启动即落盘 openApi.json 到进程 CWD）→ 拷回 apps/server/openApi.json → 重跑 gen:api。');
  console.error('[gen:api] 确需跳过本检查：SKIP_OPENAPI_FRESHNESS_CHECK=1');
  process.exit(1);
};

let dump;
let dist;
try {
  dump = statSync(dumpPath);
} catch {
  fail('apps/server/openApi.json 不存在（该文件不入库，须由 dev server 启动落盘后拷回）。');
}
try {
  dist = statSync(distEntry);
} catch {
  fail(`无法判断新鲜度：${distEntry} 不存在，请先执行 pnpm --filter server build。`);
}

if (dump.mtimeMs < dist.mtimeMs) {
  fail(
    `openApi.json 落盘时间（${dump.mtime.toISOString()}）早于 server dist 构建时间（${dist.mtime.toISOString()}），` +
      'spec 不含最新代码。请用最新代码启动一次 server 触发重新落盘。',
  );
}

console.log(
  `[gen:api] openApi.json 新鲜度 OK：落盘 ${dump.mtime.toISOString()} 晚于 dist 构建 ${dist.mtime.toISOString()}。`,
);
