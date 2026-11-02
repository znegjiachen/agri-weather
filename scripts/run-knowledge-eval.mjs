#!/usr/bin/env node
/**
 * 对指定智能体运行 RAG 检索评测。
 *
 * 用法：
 *   AGRI_TOKEN=xxx node scripts/run-knowledge-eval.mjs <agentId> [evalSetPath]
 */
import fs from 'node:fs';

const TOKEN = process.env.AGRI_TOKEN || '';
const API_BASE = (process.env.AGRI_API_BASE || 'http://localhost:8082').replace(/\/$/, '');
const agentId = process.argv[2];
const evalSetPath = process.argv[3] || 'docs/ai-eval-set.json';

if (!TOKEN || !agentId) {
  console.error('用法：AGRI_TOKEN=xxx node scripts/run-knowledge-eval.mjs <agentId> [evalSetPath]');
  process.exit(1);
}

const body = fs.readFileSync(evalSetPath, 'utf8');
const response = await fetch(`${API_BASE}/api/agents/${agentId}/knowledge/eval`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  },
  body,
});

const data = await response.json().catch(() => null);
if (!response.ok) {
  console.error(data?.message || data?.error || `HTTP ${response.status}`);
  process.exit(1);
}

console.log(`total=${data.total} hits=${data.hits} hitRate=${data.hitRate}%`);
for (const item of data.cases) {
  console.log(`${item.hit ? 'PASS' : 'FAIL'}  ${item.question}`);
}
