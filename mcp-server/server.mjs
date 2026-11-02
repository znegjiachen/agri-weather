#!/usr/bin/env node
/**
 * 问田 MCP Server（stdio）。
 *
 * 把地块、天气、农事建议、作物检索包装成标准 MCP tools，
 * 供 Claude Desktop / Claude Code / 其他 MCP 客户端调用。
 *
 * 环境变量：
 *   AGRI_API_BASE  后端地址，默认 http://localhost:8082
 *   AGRI_TOKEN     登录后拿到的 JWT，必填
 */

import readline from 'node:readline';

const API_BASE = (process.env.AGRI_API_BASE || 'http://localhost:8082').replace(/\/$/, '');
const TOKEN = process.env.AGRI_TOKEN || '';

const TOOLS = [
  {
    name: 'list_farmlands',
    description: '列出当前用户的地块（ID、名称、作物、面积、坐标）',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_weather',
    description: '查询指定地块未来 7 天的天气与未来 24 小时极值',
    inputSchema: {
      type: 'object',
      properties: { farmlandId: { type: 'integer', description: '地块 ID' } },
      required: ['farmlandId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_farm_advice',
    description: '查询指定地块未来几天的农事建议（适宜/禁忌作业）',
    inputSchema: {
      type: 'object',
      properties: { farmlandId: { type: 'integer', description: '地块 ID' } },
      required: ['farmlandId'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_crops',
    description: '按名称检索作物及品种',
    inputSchema: {
      type: 'object',
      properties: { keyword: { type: 'string', description: '作物名称关键词，如 水稻' } },
      required: ['keyword'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_crop_stages',
    description: '查询指定作物的生长阶段、适宜温湿度与病虫害风险',
    inputSchema: {
      type: 'object',
      properties: { cropId: { type: 'integer', description: '作物 ID' } },
      required: ['cropId'],
      additionalProperties: false,
    },
  },
];

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }
  return data;
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'list_farmlands':
      return api('/api/farmlands');
    case 'get_weather':
      return api(`/api/farmlands/${encodeURIComponent(args.farmlandId)}/weather`);
    case 'get_farm_advice':
      return api(`/api/farmlands/${encodeURIComponent(args.farmlandId)}/advice`);
    case 'search_crops':
      return api(`/api/crops/search?keyword=${encodeURIComponent(args.keyword)}`);
    case 'get_crop_stages':
      return api(`/api/crops/${encodeURIComponent(args.cropId)}/stages`);
    default:
      throw new Error(`未知工具：${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agri-weather-mcp', version: '1.0.0' },
      },
    });
    return;
  }
  if (method === 'notifications/initialized' || isNotification) return;
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }
  if (method === 'tools/call') {
    const name = params?.name;
    try {
      const result = await callTool(name, params?.arguments || {});
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        },
      });
    } catch (error) {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: error.message || '工具调用失败' }],
          isError: true,
        },
      });
    }
    return;
  }

  send({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

if (!TOKEN) {
  console.error('缺少 AGRI_TOKEN，请先登录问田并设置环境变量');
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const text = line.trim();
  if (!text) return;
  try {
    handle(JSON.parse(text)).catch((error) => {
      console.error('处理 MCP 请求失败:', error);
    });
  } catch (error) {
    console.error('无法解析 MCP 消息:', error.message);
  }
});