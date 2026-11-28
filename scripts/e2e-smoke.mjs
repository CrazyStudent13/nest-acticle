#!/usr/bin/env node
// E2E 冒烟测试：注册 → 登录 → getInfo → 游客文章列表 → 清理测试数据
//
// 前置（本机 compose 栈）：blog-nginx 8888 / blog-redis / blog-mysql 在跑
//   · 注册验证码无条件生成，明文存栈内 Redis：docker exec blog-redis redis-cli get "captcha_codes:<uuid>"
//     （值经 JSON 序列化带字面引号，需剥掉；图片是 SVG path 无法 OCR，Redis 是唯一取值通道）
//   · 测试账号用户名用邮箱样式：前台登录弹窗强制邮箱格式校验
//   · GET /api/getInfo 信封是平铺的（user/roles/permissions 在顶层，不在 data 下）
//   · 清理范围：sys_user / sys_user_role / sys_logininfor / post_collection（注册同事务建的默认收藏夹）/ post_notify_read
//
// 用法：node scripts/e2e-smoke.mjs [baseUrl]   （默认 http://127.0.0.1:8888）
// 注意：注册有按 IP 的频控，短时间反复跑会撞限流（报「操作频繁」属预期，等窗口过去再跑）

import { execSync } from 'node:child_process';

const BASE = process.argv[2] || 'http://127.0.0.1:8888';
const USERNAME = `smoke-${Date.now()}@qq.com`; // 邮箱样式：前台登录弹窗强制邮箱格式
const PASSWORD = `Smoke${Date.now() % 100000}`; // 字母+数字两类，满足复杂度（≥6 位两类字符）

let token = null;
let step = 0;
const ok = (msg) => console.log(`  [${++step}] ✓ ${msg}`);
const fail = (msg, detail) => {
  console.error(`  [${step + 1}] ✗ ${msg}`);
  if (detail) console.error(`    ${String(detail).slice(0, 300)}`);
  cleanup();
  process.exit(1);
};

/** 断言信封成功并返回 data；失败即终止 */
function assertEnvelope(json, label) {
  if (json?.code !== 200) fail(`${label} 失败`, `${json?.code} ${json?.msg}`);
  ok(label);
  return json.data;
}

function cleanup() {
  // 尽力清理，清理失败不影响退出码（残留靠 user_name 可查）。
  // SQL 走 stdin 管道而非 -e 参数：Node 在 Windows 上 execSync 走 cmd.exe，嵌套引号会被吞
  try {
    const sql = [
      // 会话变量默认走连接 collation（MySQL8 的 utf8mb4_0900_ai_ci），与列的 utf8mb4_unicode_ci
      // 混比会报 ERROR 1267——SET NAMES 同步为列的 collation 后再建变量
      `SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      `SET @uname='${USERNAME}';`,
      `SET @uid=(SELECT user_id FROM sys_user WHERE user_name=@uname);`,
      `DELETE FROM sys_user_role WHERE user_id=@uid;`,
      `DELETE FROM post_collection WHERE user_id=@uid;`,
      `DELETE FROM post_notify_read WHERE user_id=@uid;`,
      `DELETE FROM sys_logininfor WHERE user_name=@uname;`,
      `DELETE FROM sys_user WHERE user_id=@uid;`,
    ].join('\n');
    execSync('docker exec -i -e MYSQL_PWD=root123 blog-mysql mysql -uroot --default-character-set=utf8mb4 nest-db', {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`  [$] 已清理测试账号 ${USERNAME}`);
  } catch (err) {
    console.error(`  [$] 清理失败（可按 user_name 手查）：${err.message?.slice(0, 120)}`);
  }
}

console.log(`E2E 冒烟：${BASE} · 账号 ${USERNAME}\n`);

// ── 1. 注册验证码（type=register 无条件生成；响应为标准信封，uuid 在 data 下）────────
let uuid, code;
try {
  const res = await fetch(`${BASE}/api/captchaImage?username=${encodeURIComponent(USERNAME)}&type=register`);
  const json = await res.json();
  if (json?.data?.uuid) {
    uuid = json.data.uuid;
    ok(`验证码已下发 uuid=${uuid.slice(0, 8)}…`);
  } else {
    fail('获取注册验证码失败', JSON.stringify(json).slice(0, 200));
  }
} catch (err) {
  fail('captchaImage 请求异常', err);
}

// ── 2. 从栈内 Redis 读明文验证码（SVG 无法 OCR，值带 JSON 引号需剥掉）──────
try {
  const raw = execSync(`docker exec blog-redis redis-cli get "captcha_codes:${uuid}"`, { encoding: 'utf8' });
  code = raw.replace(/[\r\n"']/g, '');
  if (!code) fail('Redis 中未取到验证码', raw);
  ok(`验证码明文=${code}`);
} catch (err) {
  fail('读 Redis 验证码异常（栈在跑吗？）', err);
}

// ── 3. 注册 ────────────────────────────────────────────────────────────────
try {
  const res = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, code, uuid }),
  });
  const json = await res.json();
  if (json?.code === 429 || /频繁|稍后/.test(json?.msg || '')) fail('注册被限流（同 IP 频控，等窗口再跑）', json?.msg);
  assertEnvelope(json, '注册成功');
} catch (err) {
  fail('register 请求异常', err);
}

// ── 4. 登录（首次登录无失败计数，不触发验证码）──────────────────────────────
try {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = assertEnvelope(await res.json(), '登录成功');
  token = data?.token;
  if (!token) fail('登录响应缺 token', JSON.stringify(data));
} catch (err) {
  fail('login 请求异常', err);
}

// ── 5. getInfo（平铺信封：user/roles/permissions 在顶层）───────────────────
try {
  const res = await fetch(`${BASE}/api/getInfo`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  const userId = json?.user?.userId;
  if (!userId || !Array.isArray(json?.roles) || !Array.isArray(json?.permissions)) {
    fail('getInfo 平铺信封缺字段', JSON.stringify(json).slice(0, 200));
  }
  ok(`getInfo userId=${userId} roles=${json.roles.length} permissions=${json.permissions.length}`);
} catch (err) {
  fail('getInfo 请求异常', err);
}

// ── 6. 游客文章列表（公开链路）─────────────────────────────────────────────
try {
  const res = await fetch(`${BASE}/api/post/article/guest/list?pageNum=1&pageSize=1`);
  const json = await res.json();
  const data = assertEnvelope(json, '游客文章列表');
  if (!Array.isArray(data?.list)) fail('guest/list 缺 list 字段', JSON.stringify(data));
  ok(`guest list total=${data.total}`);
} catch (err) {
  fail('guest/list 请求异常', err);
}

// ── 清理 + 结果 ────────────────────────────────────────────────────────────
cleanup();
console.log('\nE2E 冒烟全部通过 ✅');
