#!/usr/bin/env node
/**
 * 问田 MCP Server（stdio）。
 *
 * 把地块、天气、农事建议、作物检索包装成标准 MCP tools，
 * 供 Claude Desktop / Claude Code / 其他 MCP 客户端调用。
 *
 * 环境变量：
 *   AGRI_API_BASE  后端地址，默认 http://localhost:8082
 *   AGRI_TOKEN     可选，JWT；不填时用账号密码自动登录
 *   AGRI_USERNAME  可选，配合 AGRI_PASSWORD 自动登录/续期
 *   AGRI_PASSWORD  可选
 */

import readline from 'node:readline';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API_BASE = (process.env.AGRI_API_BASE || 'http://localhost:8082').replace(/\/$/, '');
const USERNAME = process.env.AGRI_USERNAME || '';
const PASSWORD = process.env.AGRI_PASSWORD || '';
const AUDIT_LOG = process.env.AGRI_MCP_AUDIT_LOG
  || path.join(os.homedir(), '.agri-weather-mcp-audit.jsonl');
let TOKEN = process.env.AGRI_TOKEN || '';

function writeAudit(entry) {
  try {
    fs.appendFileSync(AUDIT_LOG, `${JSON.stringify({
      time: new Date().toISOString(),
      ...entry,
    })}\n`, 'utf8');
  } catch (error) {
    console.error('MCP 审计日志写入失败:', error.message);
  }
}

function auditArgs(args) {
  const copy = { ...args };
  delete copy.confirm;
  return copy;
}

async function login() {
  if (!USERNAME || !PASSWORD) return false;
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.token) {
    throw new Error(data?.message || data?.error || 'MCP 自动登录失败');
  }
  TOKEN = data.token;
  return true;
}

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
  {
    name: 'create_farm_operation',
    description: '写操作：为地块创建一条农事记录。首次调用请传 confirm=false 获取预览，确认后再传 confirm=true 真正写入。',
    inputSchema: {
      type: 'object',
      properties: {
        farmlandId: { type: 'integer', description: '地块 ID' },
        operationType: {
          type: 'string',
          enum: ['施肥', '打药', '灌溉', '播种', '除草', '其他'],
          description: '农事类型',
        },
        operationDate: { type: 'string', description: '作业日期 YYYY-MM-DD，默认今天' },
        detail: { type: 'string', description: '作业详情' },
        fertilizer: { type: 'string', description: '肥料名称' },
        pesticide: { type: 'string', description: '农药名称' },
        operator: { type: 'string', description: '操作人' },
        notes: { type: 'string', description: '备注' },
        confirm: { type: 'boolean', description: '确认写入，必须为 true 才执行' },
      },
      required: ['farmlandId', 'operationType', 'confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_season',
    description: '写操作：为地块创建一季种植记录（作物、播种日期、预计收获）。首次调用请传 confirm=false 获取预览，确认后再传 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        farmlandId: { type: 'integer', description: '地块 ID' },
        cropId: { type: 'integer', description: '作物 ID' },
        seasonName: { type: 'string', description: '季名，如 2027 早稻' },
        plantDate: { type: 'string', description: '播种日期 YYYY-MM-DD' },
        expectedHarvestDate: { type: 'string', description: '预计收获日期 YYYY-MM-DD' },
        status: { type: 'string', enum: ['PLANTED', 'HARVESTED', 'FALLOW'], description: '季节状态，默认 PLANTED' },
        notes: { type: 'string', description: '备注' },
        confirm: { type: 'boolean', description: '确认写入，必须为 true 才执行' },
      },
      required: ['farmlandId', 'cropId', 'plantDate', 'confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_reminder',
    description: '写操作：给地块安排一条带日期的农事提醒（进入计划任务，到期由后台推送）。首次调用请传 confirm=false 获取预览，确认后再传 confirm=true。',
    inputSchema: {
      type: 'object',
      properties: {
        farmlandId: { type: 'integer', description: '地块 ID' },
        title: { type: 'string', description: '提醒标题，如 追施分蘖肥' },
        plannedDate: { type: 'string', description: '提醒日期 YYYY-MM-DD' },
        taskType: {
          type: 'string',
          enum: ['SOW', 'FERTILIZE', 'SPRAY', 'IRRIGATE', 'HARVEST', 'OTHER'],
          description: '任务类型，默认 OTHER',
        },
        notes: { type: 'string', description: '补充说明' },
        confirm: { type: 'boolean', description: '确认写入，必须为 true 才执行' },
      },
      required: ['farmlandId', 'title', 'plannedDate', 'confirm'],
      additionalProperties: false,
    },
  },
];

async function api(path, options = {}, retried = false) {
  if (!TOKEN && USERNAME && PASSWORD) await login();
  const method = options.method || 'GET';
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 401 && !retried && USERNAME && PASSWORD) {
    await login();
    return api(path, options, true);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }
  return data;
}

function previewWrite(tool, action, args) {
  writeAudit({ tool, status: 'preview', args: auditArgs(args) });
  return {
    requiresConfirmation: true,
    tool,
    action,
    arguments: auditArgs(args),
    message: '这是写操作。确认无误后请把 confirm 设为 true 再次调用，才会真正写入。',
  };
}

async function callTool(name, args = {}) {
  try {
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
      case 'create_farm_operation': {
        if (args.confirm !== true) {
          return previewWrite(name, '创建农事记录', args);
        }
        const { farmlandId, confirm, ...body } = args;
        const record = await api(`/api/farmlands/${encodeURIComponent(farmlandId)}/operations`, {
          method: 'POST',
          body,
        });
        writeAudit({
          tool: name, status: 'success', args: auditArgs(args), recordId: record?.id,
        });
        return { ok: true, record, auditLogged: true };
      }
      case 'create_season': {
        if (args.confirm !== true) {
          return previewWrite(name, '创建种植季', args);
        }
        const { farmlandId, confirm, ...body } = args;
        const season = await api(`/api/farmlands/${encodeURIComponent(farmlandId)}/seasons`, {
          method: 'POST',
          body: { ...body, status: body.status || 'PLANTED' },
        });
        writeAudit({
          tool: name, status: 'success', args: auditArgs(args), recordId: season?.id,
        });
        return { ok: true, season, auditLogged: true };
      }
      case 'create_reminder': {
        if (args.confirm !== true) {
          return previewWrite(name, '安排农事提醒', args);
        }
        const { farmlandId, confirm, title, plannedDate, taskType, notes } = args;
        const tasks = await api(`/api/farmlands/${encodeURIComponent(farmlandId)}/tasks/confirm`, {
          method: 'POST',
          body: {
            tasks: [{
              title,
              taskType: taskType || 'OTHER',
              plannedDate,
              notes,
            }],
            sourceName: 'MCP 提醒',
          },
        });
        writeAudit({
          tool: name, status: 'success', args: auditArgs(args), recordId: tasks?.[0]?.id,
        });
        return { ok: true, task: tasks?.[0] || null, auditLogged: true };
      }
      default:
        throw new Error(`未知工具：${name}`);
    }
  } catch (error) {
    if (name.startsWith('create_')) {
      writeAudit({
        tool: name, status: 'error', args: auditArgs(args), error: error.message,
      });
    }
    throw error;
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

if (!TOKEN && !(USERNAME && PASSWORD)) {
  console.error('缺少 AGRI_TOKEN，或同时设置 AGRI_USERNAME / AGRI_PASSWORD 自动登录');
} else if (!TOKEN) {
  login().catch((error) => console.error('MCP 自动登录失败:', error.message));
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