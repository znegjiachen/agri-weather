#!/usr/bin/env node
/**
 * 把两组 Agent 评测结果打乱成人工盲评表。
 *
 * 输入是 run-agent-eval.mjs 产出的两个 JSON 文件（例如 Agent 组与裸答组），
 * 输出 CSV 只保留题目和回答，不暴露组别；review_id 与组别的对应关系
 * 写入单独的 key 文件，评审结束后再揭盲。
 *
 * 用法：
 *   node scripts/build-blind-review.mjs \
 *     --a a.json --b b.json \
 *     --out docs/eval-results/blind-review.csv \
 *     --key docs/eval-results/blind-review-key.json
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
if (!args.a || !args.b || !args.out) {
  fail('用法：node scripts/build-blind-review.mjs --a a.json --b b.json --out review.csv [--key key.json]');
}

const groupA = readResults(args.a, 'A');
const groupB = readResults(args.b, 'B');
const common = [...groupA.keys()].filter((id) => groupB.has(id));

if (common.length === 0) fail('两组结果没有相同的 caseId，无法配对');

const rows = [];
const key = {};
for (const caseId of common) {
  const a = groupA.get(caseId);
  const b = groupB.get(caseId);
  const pair = Math.random() < 0.5
    ? [{ group: 'A', row: a }, { group: 'B', row: b }]
    : [{ group: 'B', row: b }, { group: 'A', row: a }];
  for (const item of pair) {
    const reviewId = crypto.randomUUID().slice(0, 8);
    rows.push({
      reviewId,
      question: item.row.question || a.question,
      answer: item.row.reply || item.row.answer || '',
    });
    key[reviewId] = { group: item.group, caseId, question: item.row.question };
  }
}

shuffle(rows);
const csv = [
  'review_id,question,answer,score_1_5,notes',
  ...rows.map((r) => [r.reviewId, r.question, r.answer]
    .map(csvCell).join(',') + ',,') ,
].join('\n') + '\n';

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, csv, 'utf8');
const keyPath = args.key || args.out.replace(/\.csv$/i, '-key.json');
fs.writeFileSync(keyPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  inputs: { a: args.a, b: args.b },
  mapping: key,
}, null, 2), 'utf8');

console.log(`配对题目：${common.length}`);
console.log(`盲评表：${args.out}`);
console.log(`揭盲表：${keyPath}`);
if (common.length < Math.max(groupA.size, groupB.size)) {
  console.warn('提示：两组 caseId 不完全一致，仅对交集生成盲评表。');
}

function readResults(file, group) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`${group} 组结果读取失败 ${file}：${e.message}`);
  }
  const cases = Array.isArray(data) ? data : data.cases;
  if (!Array.isArray(cases)) fail(`${group} 组结果缺少 cases 数组`);
  const map = new Map();
  for (const row of cases) {
    const id = row.caseId || row.id;
    if (id && !map.has(id)) map.set(id, row);
  }
  if (map.size === 0) fail(`${group} 组结果没有可用 caseId`);
  return map;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}
