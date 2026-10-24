# 农事智能体（DeepSeek）

给平台加的一个能**自主调用工具查真实数据**的农事顾问。

## 它和普通问答的区别

普通问答是把数据拼进提示词，问什么得先猜它要什么。这里是模型自己决定：

```
用户问「明天适合打药吗」
  → 模型决定：先看看有哪些地块          [调用 list_farmlands]
  → 模型看到地块ID=5，决定查天气        [调用 get_weather]
  → 拿到真实风速 9.7km/h
  → 模型作答：「风速偏大，药液易飘移，建议延后」
```

模型全程没编造数据 —— 风速是 open-meteo 的实时值。

## 配置

### 1. 拿 API Key

去 https://platform.deepseek.com/api_keys 申请。

### 2. 设置环境变量

**不要**把密钥写进 `application.yml`（那个文件会进 Git）。

Windows：
```cmd
setx DEEPSEEK_API_KEY sk-你的密钥
```

Linux / macOS：
```bash
export DEEPSEEK_API_KEY=sk-你的密钥
```

设完**重开终端**才生效。

### 3. 启动

```bash
mvn spring-boot:run
```

访问 `http://localhost:8082/api/agent/status` 确认 `"configured": true`。

**没配密钥也能启动**，只是调用智能体接口时会返回明确提示，不影响平台其它功能。

### 可选配置

`application.yml` 的 `app.deepseek` 节点：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `model` | `deepseek-chat` | 也可用 `deepseek-reasoner`（R1，推理更强但慢） |
| `base-url` | `https://api.deepseek.com` | 走中转服务时改这里 |
| `max-iterations` | 6 | 工具调用轮数上限，防止死循环 |
| `temperature` | 0.3 | 农事建议需要稳定，不建议调高 |
| `timeout-seconds` | 60 | 单次请求超时 |

## 接口

### POST /api/agent/chat —— 与智能体对话

**需要登录**（智能体只能查你自己的地块）。

```bash
curl -X POST http://localhost:8082/api/agent/chat \
  -H "Authorization: Bearer <你的token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "我那块地明天适合打药吗"}'
```

带历史对话（多轮）：
```json
{
  "message": "那后天呢？",
  "history": [
    {"role": "user", "content": "我那块地明天适合打药吗"},
    {"role": "assistant", "content": "明天风速偏大，不建议打药。"}
  ]
}
```

响应：
```json
{
  "reply": "明天风速 14km/h，药液会飘移，建议改到周四上午。",
  "toolCalls": [
    {"tool": "list_farmlands", "arguments": "{}", "resultSummary": "[...]", "elapsedMs": 32},
    {"tool": "get_weather", "arguments": "{\"farmlandId\": 5}", "resultSummary": "{...}", "elapsedMs": 1561}
  ],
  "rounds": 3,
  "truncated": false,
  "model": "deepseek-chat"
}
```

`toolCalls` 字段很有用 —— 前端可以展示"它查了什么"，排查问题时也能一眼看出模型到底调了什么。

### POST /api/agent/vision —— 作物照片识别（多模态）

**需要登录**。multipart 上传 1-3 张 JPG/PNG，可附带用户文字备注。

```bash
curl -X POST http://localhost:8082/api/agent/vision \
  -H "Authorization: Bearer <你的token>" \
  -F "files=@leaf.jpg" \
  -F "note=番茄下部叶片有褐斑"
```

返回结构化识别结果：

```json
{
  "plantName": "番茄",
  "scientificName": "Solanum lycopersicum",
  "growthStage": "结果期",
  "healthStatus": "明显异常",
  "issues": [
    {"type": "disease", "name": "早疫病", "confidence": 0.82,
     "symptoms": "下部叶片同心轮纹褐斑", "suggestion": "摘除病叶，改善通风"}
  ],
  "overallAssessment": "疑似早疫病早期。",
  "careAdvice": ["减少叶面浇水", "按标签使用登记药剂"],
  "model": "deepseek-v4-flash-vision-exp",
  "imageCount": 1
}
```

调用 `/chat` 时把 `formatVision(...)` 的文字放进 `visionContext`，后端会把它附在本轮用户消息后面交给文本智能体，由智能体结合地块天气和农事工具生成最终建议。视觉模型默认复用 `DEEPSEEK_API_KEY`，可用 `VISION_API_KEY` / `VISION_MODEL` 单独配置。

### GET /api/agent/tools —— 查看可用工具（调试）

### GET /api/agent/status —— 运行状态

## 智能体能用的工具

| 工具 | 作用 |
|---|---|
| `list_farmlands` | 列出当前用户的地块 |
| `get_farmland_detail` | 地块详情（面积、土壤、灌溉、作物） |
| `get_weather` | 实时天气 + 未来7天预报 |
| `get_crop_stage` | 当前生长阶段及适宜温湿度 |
| `get_operation_advice` | 平台的农事决策引擎（规则库） |
| `check_alerts` | 灾害预警检查 |
| `search_crop` | 作物知识库检索 |

## 设计要点

**农学判断走确定性规则，模型只负责调度和表达。**
涉及"能不能打药"这类问题，智能体会调用 `get_operation_advice`，
用平台已有的 `OperationAdvisor` 规则引擎算，而不是让模型自由发挥。
模型编不出"风速 3m/s 可以打药"这种结论 —— 阈值是代码写死的。

**错误不中断对话。**
工具执行失败会作为 JSON 错误返回给模型，模型能看到"这个工具为什么失败"
并自行换思路，而不是整个请求崩掉。

**地块权限在工具层校验。**
每个涉及地块的工具都会核对 `userId`，防止用户 A 通过智能体查到用户 B 的地块。

**轮数上限 + 强制收敛。**
模型最多调用 6 轮工具。若仍未收敛，会禁用工具逼它基于已有信息作答，
并在响应的 `truncated` 字段标记 —— 前端可据此提示"回答可能不完整"。

## 前端页面

已接入，侧边栏「🤖 助农手」，页面标题「🤖 AgriChat · 助农手」。

| 文件 | 说明 |
|---|---|
| `weather-app-react/src/pages/AgentPage.jsx` | 聊天页面 |
| `weather-app-react/src/api/index.js` | 新增 `agent` API 对象 |
| `weather-app-react/src/App.jsx` | 注册路由与导航入口 |
| `weather-app-react/src/App.css` | 页面样式（追加在文件末尾） |

功能：
- 对话气泡，用户/助手左右分栏
- **工具调用轨迹可视化** —— 折叠展示智能体查了哪些数据、参数、耗时、原始返回
- 4 个建议问题，点击即问
- 多轮对话，自动携带历史
- 未配置密钥时显示明确提示，而不是静默失败
- **多模态**：上传最多 3 张作物照片，自动压缩到 1600px 后识别；识别结果以卡片展示（植物/阶段/健康状态/问题/置信度/照护建议），再交给智能体结合地块和天气作答
- 后续追问会带上之前的图片识别结果
- Enter 发送、Shift+Enter 换行
- 发送失败自动回填输入框与照片，不留孤立的用户消息

前端请求地址由 `VITE_API_BASE` 决定（见 `api/index.js`），默认 `http://localhost:8082`。

## 测试

```bash
mvn test -Dtest=AgriAgentIntegrationTest
```

7 个测试用本地假模型服务跑，**不需要真实 API Key、不消耗额度**，覆盖：
完整工具调用链、越权防护、参数错误容错、轮数上限、提示词注入防护、
未配置密钥处理、工具 schema 格式。

## 费用

`deepseek-chat` 便宜，一次农事咨询约 3 轮模型调用 + 若干工具执行，
单次成本在**分币级别**。天气数据来自 open-meteo（免费）。
