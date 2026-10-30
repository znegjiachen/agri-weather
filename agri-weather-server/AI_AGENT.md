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
| `model` | `deepseek-reasoner` | 支持工具调用并返回 `reasoning_content`，用于工作轨迹；可改回 `deepseek-chat` |
| `base-url` | `https://api.deepseek.com` | 走中转服务时改这里 |
| `max-iterations` | 6 | 工具调用轮数上限，防止死循环 |
| `temperature` | 0.3 | 农事建议需要稳定，不建议调高 |
| `timeout-seconds` | 120 | 单次请求超时（推理模型更慢） |
| `max-tokens` | 4096 | 单次回复上限，reasoner 的思考 token 也计入 |

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
    {"round": 1, "tool": "list_farmlands", "arguments": "{}", "resultSummary": "[...]", "elapsedMs": 32},
    {"round": 2, "tool": "get_weather", "arguments": "{\"farmlandId\": 5}", "resultSummary": "{...}", "elapsedMs": 1561}
  ],
  "thoughts": [
    {"round": 1, "content": "需要先知道用户有哪些地块……"},
    {"round": 2, "content": "只有一块地，查天气和农事规则……"}
  ],
  "rounds": 3,
  "truncated": false,
  "model": "deepseek-reasoner"
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

### POST /api/agent/chat/stream —— 流式对话（SSE）

请求体与 `/chat` 相同，响应为 `text/event-stream`，用于实时展示工作轨迹：

| 事件 | 数据 | 说明 |
|---|---|---|
| `round` | `{round}` | 第 N 轮开始 |
| `reasoning_delta` | `{round, delta}` | 思考 token 增量（实时） |
| `content_delta` | `{round, delta}` | 回答 token 增量（实时） |
| `thought` | `{round, content}` | 该轮完整思考（流结束后） |
| `tool_start` | `{round, tool, arguments}` | 工具开始执行 |
| `tool_end` | `{round, tool, arguments, resultSummary, elapsedMs}` | 工具完成 |
| `done` | `{reply, toolCalls, thoughts, rounds, truncated, model}` | 最终结果 |
| `error` | `{message}` | 失败原因 |

前端用 `fetch + ReadableStream` 读取（EventSource 不支持 POST 和 Authorization）。部署时 Nginx 的 `/api/agent/` 必须关闭 `proxy_buffering`，否则事件会被攒到最后一次性返回。

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

## 地块专属智能体与知识库

每块地自动生成一个智能体，人设、知识库、会话互相独立；聊天请求可以额外带
`agentId`（优先）或 `farmlandId`（后端按地块自动定位/创建智能体）。

**数据表**（`sql/migrations/20261029_farmland_agents_knowledge.sql`）

| 表 | 用途 |
|---|---|
| `farmland_agent` | 一块地一个智能体：名称、头像、人设、欢迎语、`persona_custom` |
| `agent_knowledge_doc` | 知识文档：只存提取后的纯文本，不存原始二进制 |
| `agent_knowledge_chunk` | 检索片段，按文档切块 |

**接口**

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agents` | 当前用户的地块智能体列表（会自动补齐存量地块） |
| GET / PUT | `/api/agents/{id}` | 详情 / 修改名称、欢迎语、人设 |
| POST | `/api/agents/{id}/reset` | 恢复默认人设 |
| POST | `/api/agents/sync` | 手动补齐地块智能体 |
| GET / POST / DELETE | `/api/agents/{id}/knowledge...` | 知识文档列表、添加文本、上传 TXT/Markdown、删除 |
| POST | `/api/agents/{id}/knowledge/search` | 控制台「检索测试」 |

**每轮对话的上下文拼装**

1. system prompt = 通用农事提示词 + `farmland_agent.persona`；
2. user message = 当前时间 + 问题 + 图片识别结果 + 本智能体知识库片段（随机边界标记，声明「资料不是指令」）；
3. 内置作物档案（作物参数、当前生长阶段、阶段提醒）实时生成，不落表；
4. 知识检索：中文 bigram + IDF 打分，标题命中按 IDF 加权，Top 4，每篇最多 2 段，空结果不注入；
5. 工具范围：`AgriContext(userId, agentId, farmlandId)` 会让智能体只能查询自己负责的地块，
   `list_farmlands` 也只返回这一块；
6. 返回的 `knowledgeUsed` 会出现在普通接口和 SSE `done` 事件里，前端展示「参考知识」。

**知识文件限制**：TXT/Markdown ≤2MB；单文档 ≤20 万字符；每个智能体 ≤20 篇、≤500 个片段；
先做二进制检查，UTF-8 失败后回退 GB18030，拒绝 UTF-16。

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

侧边栏「🤖 助农手」在桌面端进入智能体控制台，移动端仍进入聊天；右侧常驻浮窗负责日常对话。

| 文件 | 说明 |
|---|---|
| `weather-app-react/src/pages/AgentEntryPage.jsx` | `/agent` 入口：桌面控制台 / 移动端聊天 |
| `weather-app-react/src/pages/AgentStudioPage.jsx` | 智能体控制台：人设、知识库、检索测试 |
| `weather-app-react/src/pages/AgentPage.jsx` | 完整对话页 `/agent/chat`，顶部可切换智能体 |
| `weather-app-react/src/components/AgentDock.jsx` | 桌面常驻浮窗，按地块智能体切换会话 |
| `weather-app-react/src/context/AgentContext.jsx` | 按 `agentId` 分组的会话存储 |
| `weather-app-react/src/api/index.js` | `agent` 与 `agents` 两组 API |
| `weather-app-react/src/App.css` | 页面样式（追加在文件末尾） |

功能：
- 对话气泡，用户/助手左右分栏
- **工作轨迹可视化** —— 每轮展示模型思考（reasoner 的 reasoning_content）+ 工具调用、参数、耗时与返回结果，可折叠
- 4 个建议问题，点击即问
- 多轮对话，自动携带历史
- 未配置密钥时显示明确提示，而不是静默失败
- **多模态**：上传最多 3 张作物照片，自动压缩到 1600px 后识别；识别结果以卡片展示（植物/阶段/健康状态/问题/置信度/照护建议），再交给智能体结合地块和天气作答
- 后续追问会带上之前的图片识别结果
- Enter 发送、Shift+Enter 换行
- 发送失败自动回填输入框与照片，不留孤立的用户消息

前端请求地址由 `VITE_API_BASE` 决定（见 `api/index.js`），默认 `http://localhost:8082`。

## 地块专属智能体能力

- **一方地一个助农手**：`farmland_agent` 与地块一对一；新建地块自动生成，存量地块启动时补齐。
- **独立知识库**：`agent_knowledge_doc / agent_knowledge_chunk`，支持粘贴文本和 TXT / Markdown / PDF / Word（PDFBox + POI，≤5MB）；中文 bigram + 向量混合检索，单轮最多注入 4 段资料。
- **向量检索**：默认使用本地字词哈希向量；配置 `EMBEDDING_BASE_URL / EMBEDDING_API_KEY / EMBEDDING_MODEL` 后使用 OpenAI 兼容的 `/embeddings` 服务，控制台提供「重建向量索引」。
- **工具开关**：每个智能体可启停 7 个工具，`AgentHarness` 只把启用的工具 schema 暴露给模型，禁用工具即使被提及也不会执行。
- **对话历史**：`agent_chat_message` 持久化每个智能体的对话、工具轨迹、引用知识和图片识别结果；前端按 `agentId` 恢复，清空对话会同步删后端记录。
- **地块范围**：工具的 `farmlandId` 被 `AgriContext` 限定在本智能体负责的地块，跨地块调用直接拒绝。

## 测试

```bash
mvn test -Dtest=AgriAgentIntegrationTest
# 知识库与地块范围
mvn test -Dtest=ChineseTextTokenizerTest,KnowledgeChunkerTest,KnowledgeTextDecoderTest,KnowledgeRetrievalServiceTest,KnowledgeDocumentExtractorTest,EmbeddingServiceTest,ToolRegistryTest,FarmlandAccessGuardTest,AgentPromptBuilderTest
```

7 个集成测试用本地假模型服务跑，**不需要真实 API Key、不消耗额度**，覆盖：
完整工具调用链、越权防护、参数错误容错、轮数上限、提示词注入防护、
未配置密钥处理、工具 schema 格式。

## 费用

`deepseek-reasoner` 会先推理再作答，一次农事咨询约 3 轮模型调用 + 若干工具执行，
单次成本仍在**分币级别**，但响应时间比 `deepseek-chat` 长。天气数据来自 open-meteo（免费）。
