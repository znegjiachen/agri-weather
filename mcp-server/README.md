# 问田 MCP Server

把问田的地块、天气、农事建议、作物检索包装成标准 MCP tools，供 Claude Desktop / Claude Code 等客户端调用。

## 启动

```bash
cd mcp-server
AGRI_TOKEN=你的JWT AGRI_API_BASE=http://localhost:8082 node server.mjs
```

`AGRI_TOKEN` 来自登录接口返回的 `token`，也可以从浏览器的 `localStorage.getItem('token')` 获取。

JWT 24 小时后过期。长期运行建议改用账号密码自动登录/续期：

```bash
cd mcp-server
AGRI_USERNAME=你的用户名 AGRI_PASSWORD=你的密码 AGRI_API_BASE=http://localhost:8082 node server.mjs
```

## 客户端配置

```json
{
  "mcpServers": {
    "agri-weather": {
      "command": "node",
      "args": ["D:/智慧农业天气系统/mcp-server/server.mjs"],
      "env": {
        "AGRI_API_BASE": "http://localhost:8082",
        "AGRI_TOKEN": "替换为你的 JWT"
      }
    }
  }
}
```

## 工具

| 工具 | 类型 | 说明 |
|---|---|---|
| `list_farmlands` | 只读 | 列出当前用户地块 |
| `get_weather` | 只读 | 查询地块天气 |
| `get_farm_advice` | 只读 | 查询地块农事建议 |
| `search_crops` | 只读 | 按名称检索作物 |
| `get_crop_stages` | 只读 | 查询作物生长阶段 |
| `create_farm_operation` | 写入 | 创建农事记录 |
| `create_season` | 写入 | 创建种植季 |
| `create_reminder` | 写入 | 创建带日期的计划任务，到期由后台推送提醒 |

## 写操作的确认与审计

写工具必须显式传 `confirm`：

1. 第一次调用传 `confirm: false`，只返回参数预览，不写数据库
2. 确认无误后传 `confirm: true`，才会真正调用后端接口
3. 每次预览、成功、失败都会追加一行 JSONL 审计日志

审计日志默认位置：`~/.agri-weather-mcp-audit.jsonl`，可用 `AGRI_MCP_AUDIT_LOG` 指定。

注意：MCP Server 与后端使用同一套 JWT 权限；它只代理当前用户有权访问的地块，不绕过任何鉴权。