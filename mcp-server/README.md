# 问田 MCP Server

把问田的地块、天气、农事建议、作物检索包装成标准 MCP tools，供 Claude Desktop / Claude Code 等客户端调用。

## 启动

```bash
cd mcp-server
AGRI_TOKEN=你的JWT AGRI_API_BASE=http://localhost:8082 node server.mjs
```

`AGRI_TOKEN` 来自登录接口返回的 `token`，也可以从浏览器的 `localStorage.getItem('token')` 获取。

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

| 工具 | 说明 |
|---|---|
| `list_farmlands` | 列出当前用户地块 |
| `get_weather` | 查询地块天气 |
| `get_farm_advice` | 查询地块农事建议 |
| `search_crops` | 按名称检索作物 |
| `get_crop_stages` | 查询作物生长阶段 |

注意：MCP Server 与后端使用同一套 JWT 权限；它只代理当前用户有权访问的地块，不绕过任何鉴权。