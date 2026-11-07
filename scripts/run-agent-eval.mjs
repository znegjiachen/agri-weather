#!/usr/bin/env node
/**
 * 助农手 Agent 可重复评测。
 *
 * 默认读取 docs/agent-eval-set-v2.json，逐题调用 /api/agent/chat，
 * 记录实际工具序列、墙钟耗时和回答，计算工具选择准确率与耗时分布。
 *
 * 用法：
 *   AGRI_TOKEN=xxx node scripts/run-agent-eval.mjs \
 *     --base http://47.96.25.53 --agent-id 12 \
 *     --out docs/eval-results/2026-11-07-agent-eval.json
 *
 * 仅校验数据集、不调用模型：
 *   node scripts/run-agent-eval.mjs --dry-run
 *
 * 可选参数：
 *   --set <path>        评测集，默认 docs/agent-eval-set-v2.json
 *   --farmland-id <id>  地块 ID（与 --agent-id 至少给一个）
 *   --repeat <n>        每题重复次数，默认 1
 *   --delay <ms>        题间隔，默认 1500，避免触发限流
 *   --case <id,id>      只跑指定题目
 *   --timeout <ms>      单题超时，默认 120000
 */
import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const BASE = (args.base || process.env.AGRI_API_BASE || 'http://localhost:8082').replace(/\/$/, '');
const TOKEN = args.token || process.env.AGRI_TOKEN || '';
const SET_PATH = args.set || 'docs/agent-eval-set-v2.json';
const OUT_PATH = args.out || `docs/eval-results/${new Date().toISOString().slice(0, 10)}-agent-eval.json`;
const AGENT_ID = numberOrNull(args['agent-id'] ?? process.env.AGRI_AGENT_ID);
const FARMLAND_ID = numberOrNull(args['farmland-id'] ?? process.env.AGRI_FARMLAND_ID);
const REPEAT = Math.max(1, Number(args.repeat || 1));
const DELAY_MS = Math.max(0, Number(args.delay ?? 1500));
const TIMEOUT_MS = Math.max(1000, Number(args.timeout || 120000));
const ONLY = args.case ? new Set(String(args.case).split(',').map((s) => s.trim())) : null;
const DRY_RUN = Boolean(args['dry-run']);

const evalSet = readJson(SET_PATH);
validateSet(evalSet);

const selected = evalSet.cases.filter((c) => !ONLY || ONLY.has(c.id));
if (ONLY && selected.length !== ONLY.size) {
  const found = new Set(selected.map((c) => c.id));
  const missing = [...ONLY].filter((id) => !found.has(id));
  fail(`评测集中不存在这些题目：${missing.join(', ')}`);
}

const stats = summarizeSet(evalSet);
console.log(`评测集：${SET_PATH}`);
console.log(`题目：${evalSet.cases.length} 条，${stats.categories.size} 个类别`);
for (const [category, count] of stats.categories) {
  console.log(`  ${category}: ${count}`);
}
console.log(`工具覆盖：${[...stats.tools].sort().join(', ')}`);

if (DRY_RUN) {
  console.log('\n数据集校验通过（dry-run，未调用模型）。');
  process.exit(0);
}

if (!TOKEN) fail('缺少登录令牌：设置 AGRI_TOKEN 或传 --token');
if (!AGENT_ID && !FARMLAND_ID) {
  fail('缺少对话上下文：传 --agent-id 或 --farmland-id（至少一个）');
}

if (AGENT_ID || FARMLAND_ID) {
  await warnUnknownTools();
}

const startedAt = new Date();
const results = [];
let quotaHit = false;

for (const item of selected) {
  for (let run = 1; run <= REPEAT; run += 1) {
    if (quotaHit) break;
    const label = REPEAT > 1 ? `${item.id}#${run}` : item.id;
    process.stdout.write(`[${label}] ${item.question} ... `);
    const row = await runCase(item, run);
    results.push(row);
    console.log(row.error
      ? `ERROR ${row.error}`
      : `${row.hit ? 'HIT' : 'MISS'} ${row.latencyMs}ms tools=[${row.actualTools.join(', ')}]`);
    if (row.quotaExceeded) {
      quotaHit = true;
      console.log('检测到额度用尽，停止后续题目。');
    }
    if (DELAY_MS > 0 && !quotaHit) await sleep(DELAY_MS);
  }
  if (quotaHit) break;
}

const finishedAt = new Date();
const summary = aggregate(results, { startedAt, finishedAt, model: results.find((r) => r.model)?.model });
const payload = {
  meta: {
    evalSet: SET_PATH,
    base: BASE,
    agentId: AGENT_ID,
    farmlandId: FARMLAND_ID,
    repeat: REPEAT,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    delayMs: DELAY_MS,
  },
  summary,
  cases: results,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
const csvPath = OUT_PATH.replace(/\.json$/i, '.csv');
fs.writeFileSync(csvPath, toCsv(results), 'utf8');

console.log('\n结果');
console.log(`  完成：${summary.completed}/${summary.total}，错误：${summary.errors}`);
console.log(`  工具选择准确率：${summary.toolSelectionAccuracy}% (${summary.hits}/${summary.completed})`);
console.log(`  平均耗时：${summary.latency.avgMs}ms，中位数：${summary.latency.medianMs}ms，P95：${summary.latency.p95Ms}ms`);
console.log(`  超过单题时限：${summary.latencyOverLimit}/${summary.completed}`);
console.log(`  平均工具调用：${summary.avgToolCallsPerCase}`);
console.log(`\n已写入：\n  ${OUT_PATH}\n  ${csvPath}`);

async function runCase(item, run) {
  const body = {
    message: item.question,
    history: [],
    ...(AGENT_ID ? { agentId: AGENT_ID } : {}),
    ...(FARMLAND_ID ? { farmlandId: FARMLAND_ID } : {}),
  };
  const started = Date.now();
  let response;
  let error = null;
  let quotaExceeded = false;
  try {
    response = await fetch(`${BASE}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    error = e?.name === 'TimeoutError' ? `timeout ${TIMEOUT_MS}ms` : String(e?.message || e);
  }
  const latencyMs = Date.now() - started;

  let data = null;
  if (response) {
    data = await response.json().catch(() => null);
    if (!response.ok) {
      error = data?.message || data?.error || `HTTP ${response.status}`;
      quotaExceeded = response.status === 429;
    }
  }

  const toolCalls = Array.isArray(data?.toolCalls) ? data.toolCalls : [];
  const actualTools = toolCalls.map((t) => t.tool);
  const verdict = judge(item, actualTools);
  return {
    caseId: item.id,
    run,
    category: item.category,
    question: item.question,
    expectedRequired: item.requiredTools || [],
    expectedAnyOf: item.anyOfTools || [],
    expectedNoTool: Boolean(item.expectNoTool),
    actualTools,
    toolCallDetails: toolCalls,
    missingRequired: verdict.missingRequired,
    anyOfSatisfied: verdict.anyOfSatisfied,
    forbiddenCalled: verdict.forbiddenCalled,
    unnecessaryTools: verdict.unnecessaryTools,
    hit: verdict.hit,
    latencyMs,
    maxLatencyMs: item.maxLatencyMs || evalSet.defaults.maxLatencyMs || null,
    withinLatency: latencyMs <= (item.maxLatencyMs || evalSet.defaults.maxLatencyMs || 30000),
    safetyReview: Boolean(item.safety),
    safetyWarnings: item.safety ? safetyWarnings(data?.reply || '') : [],
    reply: data?.reply || '',
    rounds: data?.rounds ?? null,
    truncated: data?.truncated ?? null,
    model: data?.model || null,
    error,
    quotaExceeded,
  };
}

function judge(item, actualTools) {
  const actual = new Set(actualTools);
  const required = item.requiredTools || [];
  const anyOf = item.anyOfTools || [];
  const forbidden = item.forbiddenTools || [];
  const missingRequired = required.filter((t) => !actual.has(t));
  const anyOfSatisfied = anyOf.length === 0 || anyOf.some((t) => actual.has(t));
  const forbiddenCalled = forbidden.filter((t) => actual.has(t));
  const allowed = new Set([...required, ...anyOf]);
  const unnecessaryTools = [...new Set(actualTools.filter((t) => !allowed.has(t)))];

  let hit;
  if (item.expectNoTool) {
    hit = actualTools.length === 0;
  } else {
    hit = missingRequired.length === 0 && anyOfSatisfied && forbiddenCalled.length === 0;
  }
  return { missingRequired, anyOfSatisfied, forbiddenCalled, unnecessaryTools, hit };
}

function aggregate(rows, meta) {
  const completed = rows.filter((r) => !r.error);
  const hits = rows.filter((r) => r.hit && !r.error);
  const latencies = completed.map((r) => r.latencyMs).sort((a, b) => a - b);
  const rounds = completed.map((r) => r.rounds).filter((n) => Number.isFinite(n));
  const toolCounts = completed.map((r) => r.actualTools.length);
  const byCategory = {};
  for (const row of rows) {
    const bucket = byCategory[row.category] || (byCategory[row.category] = {
      total: 0, completed: 0, hits: 0, errors: 0, latencySum: 0,
    });
    bucket.total += 1;
    if (row.error) {
      bucket.errors += 1;
      continue;
    }
    bucket.completed += 1;
    bucket.hits += row.hit ? 1 : 0;
    bucket.latencySum += row.latencyMs;
  }
  for (const bucket of Object.values(byCategory)) {
    bucket.toolSelectionAccuracy = bucket.completed
      ? `${Math.round((bucket.hits / bucket.completed) * 1000) / 10}%` : 'n/a';
    bucket.avgLatencyMs = bucket.completed ? Math.round(bucket.latencySum / bucket.completed) : null;
    delete bucket.latencySum;
  }

  return {
    total: rows.length,
    completed: completed.length,
    errors: rows.length - completed.length,
    hits: hits.length,
    toolSelectionAccuracy: completed.length
      ? Math.round((hits.length / completed.length) * 1000) / 10 : 0,
    latency: {
      avgMs: average(latencies),
      medianMs: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95),
      maxMs: latencies.length ? latencies[latencies.length - 1] : null,
    },
    latencyOverLimit: rows.filter((r) => {
      const limit = r.maxLatencyMs || 30000;
      return !r.error && r.latencyMs > limit;
    }).length,
    avgToolCallsPerCase: average(toolCounts),
    avgRounds: average(rounds),
    unnecessaryToolRate: completed.length
      ? `${Math.round((rows.filter((r) => r.unnecessaryTools.length > 0).length / completed.length) * 1000) / 10}%`
      : 'n/a',
    safetyReviewCases: rows.filter((r) => r.safetyReview).length,
    safetyWarningCases: rows.filter((r) => r.safetyWarnings.length > 0).length,
    byCategory,
    startedAt: meta.startedAt.toISOString(),
    finishedAt: meta.finishedAt.toISOString(),
    durationMs: meta.finishedAt.getTime() - meta.startedAt.getTime(),
  };
}

function safetyWarnings(reply) {
  if (!reply) return [];
  const rules = [
    { re: /(保证|肯定|一定)[^。！？\n]{0,12}(丰收|增产|高产)/, label: '绝对化丰收承诺' },
    { re: /增产\s*\d{2,}\s*%|产量翻倍/, label: '承诺增产幅度' },
    { re: /(百分之百|100%)\s*(有效|防治|增收)/, label: '绝对化效果承诺' },
  ];
  return rules.filter((r) => r.re.test(reply)).map((r) => r.label);
}

function validateSet(set) {
  if (!set || !Array.isArray(set.cases) || set.cases.length < 30) {
    fail('评测集至少需要 30 条题目');
  }
  const ids = new Set();
  for (const [i, c] of set.cases.entries()) {
    const where = `cases[${i}]`;
    if (!c.id || ids.has(c.id)) fail(`${where} 的 id 缺失或重复`);
    ids.add(c.id);
    if (!c.question || typeof c.question !== 'string') fail(`${where} 缺少 question`);
    if (!c.category) fail(`${where} 缺少 category`);
    for (const key of ['requiredTools', 'anyOfTools', 'forbiddenTools']) {
      if (c[key] != null && !Array.isArray(c[key])) fail(`${where}.${key} 必须是数组`);
    }
    if (c.expectNoTool !== true
        && !(c.requiredTools || []).length
        && !(c.anyOfTools || []).length) {
      fail(`${where} 未声明任何期望工具；若期望不调用工具请设 expectNoTool=true`);
    }
    for (const t of [...(c.requiredTools || []), ...(c.anyOfTools || [])]) {
      if (!c.expectNoTool && (c.forbiddenTools || []).includes(t)) {
        fail(`${where} 中 ${t} 同时出现在期望和禁用列表`);
      }
    }
  }
}

function summarizeSet(set) {
  const categories = new Map();
  const tools = new Set();
  for (const c of set.cases) {
    categories.set(c.category, (categories.get(c.category) || 0) + 1);
    for (const t of [...(c.requiredTools || []), ...(c.anyOfTools || [])]) tools.add(t);
  }
  return { categories, tools };
}

async function warnUnknownTools() {
  try {
    const res = await fetch(`${BASE}/api/agent/tools`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const available = new Set((Array.isArray(data) ? data : [])
      .map((t) => t.name || t.function?.name)
      .filter(Boolean));
    if (available.size === 0) return;
    const covered = summarizeSet(evalSet).tools;
    const unknown = [...covered].filter((t) => !available.has(t));
    if (unknown.length) {
      console.warn(`警告：评测集引用了后端未注册的工具：${unknown.join(', ')}`);
    }
  } catch {
    // 工具清单接口不可用不影响评测主流程
  }
}

function toCsv(rows) {
  const header = [
    'caseId', 'run', 'category', 'question', 'expectedRequired', 'expectedAnyOf',
    'expectedNoTool', 'actualTools', 'hit', 'missingRequired', 'forbiddenCalled',
    'unnecessaryTools', 'latencyMs', 'maxLatencyMs', 'withinLatency', 'error', 'reply',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.caseId, r.run, r.category, r.question,
      r.expectedRequired.join('|'), r.expectedAnyOf.join('|'), r.expectedNoTool,
      r.actualTools.join('|'), r.hit, r.missingRequired.join('|'), r.forbiddenCalled.join('|'),
      r.unnecessaryTools.join('|'), r.latencyMs, r.maxLatencyMs ?? '', r.withinLatency,
      r.error ?? '', String(r.reply || '').replace(/\s+/g, ' ').slice(0, 300),
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`无法读取评测集 ${file}：${e.message}`);
  }
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}
