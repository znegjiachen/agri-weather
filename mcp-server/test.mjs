#!/usr/bin/env node
/** MCP 协议自检：启动 server，完成 initialize / tools/list，不访问后端 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const dir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(dir, 'server.mjs')], {
  env: {
    ...process.env,
    AGRI_TOKEN: 'test-token',
    AGRI_MCP_AUDIT_LOG: path.join(os.tmpdir(), 'agri-mcp-test-audit.jsonl'),
  },
  stdio: ['pipe', 'pipe', 'inherit'],
});

const pending = new Map();
const rl = readline.createInterface({ input: child.stdout });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message);
  }
});

function request(id, method, params) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`MCP 请求超时: ${method}`)), 5000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

try {
  const init = await request(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'self-test', version: '1.0.0' },
  });
  assert.equal(init.result.serverInfo.name, 'agri-weather-mcp');

  const tools = await request(2, 'tools/list', {});
  assert.ok(Array.isArray(tools.result.tools));
  assert.ok(tools.result.tools.length >= 8);
  const names = tools.result.tools.map((tool) => tool.name);
  for (const name of [
    'list_farmlands', 'get_weather', 'search_crops',
    'create_farm_operation', 'create_season', 'create_reminder',
  ]) {
    assert.ok(names.includes(name), `缺少工具 ${name}`);
  }

  const preview = await request(3, 'tools/call', {
    name: 'create_farm_operation',
    arguments: { farmlandId: 1, operationType: '施肥', confirm: false },
  });
  assert.equal(preview.result.isError, false);
  const previewData = JSON.parse(preview.result.content[0].text);
  assert.equal(previewData.requiresConfirmation, true);

  console.log(`MCP self-test passed: ${names.length} tools, write confirmation ok`);
} finally {
  child.kill();
}