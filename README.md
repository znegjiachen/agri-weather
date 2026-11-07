# 问田

面向农业生产的**气象 + 农事**一体化平台。把实时天气、作物生长模型、灾害预警和 AI 农事顾问整合到同一个工作台，回答的是种地实际会问的问题——「明天适合打药吗」「这块地该防冻了吗」。

后端 Spring Boot + 前端 React，天气数据取自 Open-Meteo（免费、无需密钥），农事问答由 DeepSeek 驱动，模型自主调用工具查真实数据，不编造。

> 桌面端驾驶舱效果图：[design/desktop-dashboard.png](design/desktop-dashboard.png)

## 仓库与演示

- 代码仓库（Public）：<https://github.com/znegjiachen/agri-weather>
- 在线演示：<http://47.96.25.53>（HTTP 演示环境；语音、PWA 安装、Web Push 需要 HTTPS）
- 演示账号请自行注册，或在评审时联系团队获取

---

## 功能

| 模块 | 说明 |
|---|---|
| 📊 桌面驾驶舱 | 大屏三栏布局：今日天气、地块卡片、7 日趋势、预警与今日农事一屏呈现；宽屏下助农手常驻右侧 |
| 🧑‍🌾 智能体控制台 | 每块地自动生成一个专属助农手，可改人设、恢复默认、查看内置作物档案；桌面端侧栏「助农手」进入 |
| 📚 知识库 | 每个助农手独立知识库：粘贴文本或上传 TXT / Markdown / PDF / Word（≤5MB），向量 + 关键词混合检索后注入对话，回答标注引用了哪几篇 |
| 🤖 助农手 | 多模态对话顾问。能看作物照片识别植物、生长阶段和病虫害，自主调用工具查询真实数据，并实时展示每轮思考与工具调用轨迹 |
| 🌱 播种适配 | 64 种常见作物的适宜播种期与生长阶段；自动带入地块实时气象，给出播期与当前天气的匹配度分析 |
| 🔔 预警中心 | 对地块执行灾害检查：冻害、热害、涝害、大风、病虫害（病虫害阈值内置在预警规则中）；后台每 30 分钟自动检查，支持 Web Push 后台推送（需 HTTPS + VAPID），移动端首页有入口与未读角标 |
| 📍 地块管理 | 地块增删改查，绑定作物与种植日期 |
| 🗺️ 地块地图 | 卫星底图圈地：点击边界点围成地块，自动计算亩数并保存，支持定位 |
| 🌤️ 天气预报 | 逐小时 / 逐日预报、天气详情、单位切换 |

### 农事智能体

与「把数据拼进提示词」的普通问答不同，这里的模型自己决定查什么：

```
用户问「明天适合打药吗」
  → 模型决定：先看看有哪些地块          [调用 list_farmlands]
  → 模型看到地块 ID=5，决定查天气        [调用 get_weather]
  → 拿到真实风速 9.7 km/h
  → 模型作答：「风速偏大，药液易飘移，建议延后」
```

全程没有编造数据——风速是 Open-Meteo 的实时值。

**多模态识图**：在对话里直接上传作物照片（最多 3 张），视觉模型会先识别植物名称、生长阶段、健康状态和可见的病害/虫害/缺素，再由助农手结合地块天气和农事工具给出建议。识别结果以卡片展示，低置信度或无法判断时会明确提示补拍。

**语音提问**：输入框右侧的 🎤 按钮支持录音转文字，田间不方便打字时直接说话即可。配置 `ASR_*` 后由后端调用 Whisper / 兼容的 `/audio/transcriptions`；未配置时自动回退到浏览器语音识别（Chrome / Edge），两种方式都不可用时会给出明确提示。

**对话内看文档**：📄 按钮可上传 PDF / Word / TXT / Markdown（≤5MB，最多同时引用 3 份）。上传时复用知识库解析器切块并建立向量索引，提问时按问题检索相关片段注入，不再截断整篇正文；文档保留 7 天后自动清理，不进入知识库。附件会持续作为后续提问的参考资料，刷新后可从历史消息重新引用，点 × 可解除。

可用工具（7 个）：`list_farmlands` · `get_farmland_detail` · `get_weather` · `get_crop_stage` · `get_operation_advice` · `check_alerts` · `search_crop`

### 一块地一个助农手

每块地会自动生成一个专属智能体，桌面端从侧栏「助农手」进入**智能体控制台**：

- **人设独立**：名称、欢迎语、专属人设可编辑；作物或面积变化时会同步默认人设，用户改过的人设不会被覆盖。
- **知识库独立**：支持粘贴文本或上传 TXT / Markdown / PDF / Word（UTF-8/GB18030，≤5MB），中文关键词 + 向量混合检索，最多注入 4 段资料；回答下方会标注「参考知识」。
- **工具可调配**：每个助农手可启用/停用 7 个农事工具；关闭后模型看不到该工具。
- **历史持久化**：对话记录存后端，刷新页面或换设备后仍可恢复；每个智能体独立会话。
- **季节与农事记录**：地块可新增多个种植季（作物、播种/预计收获/实际收获、状态、备注），换茬不覆盖历史；施肥、打药、灌溉等农事操作单独记录。
- **方案任务闭环**：上传种植方案 → AI 抽取农事任务 → 用户确认 → 到期 Web Push 提醒 → 完成/跳过 → 自动生成农事记录，并统计完成率、按时率、逾期和延误天数。
- **账号安全**：access token 2 小时、refresh token 30 天自动轮换；支持退出全部设备（旧 token 立即失效）和密码确认后注销账号。
- **范围独立**：智能体的工具只能查询它负责的那块地，跨地块查询会被拒绝；前端浮窗和对话页按智能体分别切换会话。
- **内置知识**：每轮自动附带该地块的作物档案和当前生长阶段，无需手工维护。

详见 [agri-weather-server/AI_AGENT.md](agri-weather-server/AI_AGENT.md)。

---

## 技术栈

**后端** — Spring Boot 3.5.2 · Java 17 · Spring Security + JWT (jjwt 0.12.6) · Spring Data JPA · MySQL 8 · Flyway（数据库版本管理）· Lombok

**前端** — React 19 · Vite 8 · react-router-dom 7 · 原生 CSS（玻璃拟态）· PWA/Workbox · 页面层已迁移 TypeScript（`npm run typecheck`；`npm run typecheck:strict` 对 types/utils/核心组件开启 strict）· Playwright 冒烟测试

**外部服务** — [Open-Meteo](https://open-meteo.com/)（天气，免费无密钥）· [DeepSeek](https://platform.deepseek.com/)（农事智能体）· 可选 OpenAI 兼容 Embedding（不配置时使用本地向量）

**部署** — Docker Compose（MySQL + 后端 + Nginx）

### 依赖与环境

| 依赖 | 版本/说明 |
|---|---|
| JDK | 17（后端编译与运行） |
| Maven | 3.9+，仓库自带 `mvnw` 包装器 |
| Node.js | 18+（CI 使用 22），npm |
| MySQL | 8.0+ |
| Redis | 7+（天气缓存、限流、调度锁） |
| Docker + Compose | 可选，推荐用于一键部署 |
| Python / Playwright | 可选，前端 E2E 冒烟测试 |

后端依赖清单见 [agri-weather-server/pom.xml](agri-weather-server/pom.xml)，前端依赖清单见 [weather-app-react/package.json](weather-app-react/package.json)，环境变量模板见 [.env.example](.env.example)。

---

## 快速开始

### 方式一：Docker 一键部署

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入数据库密码和 JWT 密钥
#   JWT 密钥生成：openssl rand -hex 32

# 2. 构建前端静态文件
cd weather-app-react && npm install && npm run build && cd ..

# 3. 启动
docker-compose up -d
```

访问 http://localhost 即可。MySQL 容器首次启动会自动执行 `sql/schema.sql` 和 `sql/seed-current.sql` 建表并补齐播种/作物数据，后端以 Flyway V9 为基线继续后续迁移。

```bash
docker-compose logs -f    # 查看日志
docker-compose down       # 停止
```

### 方式二：本地开发

**前置**：JDK 17+、Node.js 18+、MySQL 8

```bash
# 1. 初始化全新数据库：先建表，再补齐 V6-V9 的播种/作物数据
mysql -u root -p < agri-weather-server/sql/schema.sql
mysql -u root -p agri_weather < agri-weather-server/sql/seed-current.sql

# 老库升级：先备份，再启动后端；Flyway 会校验已有历史并补齐后续迁移。
# 以 schema.sql 初始化的库已到 V9，application.yml 的 Flyway 基线也是 V9。

# 2. 设置 DeepSeek 密钥（Windows 用 setx，改完需重开终端）
export DEEPSEEK_API_KEY=sk-你的密钥

# 3. 启动后端（默认 8082 端口）
cd agri-weather-server && ./mvnw spring-boot:run

# 4. 启动前端（默认 5173 端口）
cd weather-app-react && npm install && npm run dev
```

未设置 `CORS_ORIGINS` 时后端默认放行 `http://localhost:*` 的任意端口，本地开发无需额外配置跨域。

前端检查：`npm run typecheck`（TypeScript）、`npm run lint`（ESLint）、`npm run e2e`（Playwright 冒烟测试，使用本机 Chrome，自动启动 Vite）。

开发环境数据库连接在 [application.yml](agri-weather-server/src/main/resources/application.yml) 中配置，默认 `localhost:3306` / `root` / `root`。

---

## 目录结构

```
.
├── agri-weather-server/              # Spring Boot 后端
│   ├── src/main/java/com/agriweather/
│   │   ├── agent/                    # 智能体框架（工具调用循环，零领域知识、可复用）
│   │   ├── ai/                       # 应用层：DeepSeek 适配、Spring 装配、提示词
│   │   │   └── tool/                 # 7 个农事工具实现 + 地块归属校验
│   │   ├── config/                   # 安全配置、JWT 过滤器
│   │   ├── controller/               # REST 接口
│   │   ├── dto/  entity/  repository/  service/
│   │   └── utils/
│   ├── src/test/                     # 智能体集成测试
│   ├── sql/schema.sql                # 建表 + 初始数据
│   └── Dockerfile
├── weather-app-react/                # React 前端
│   └── src/
│       ├── api/          # 请求封装，统一附加 token、处理 401 登录失效
│       ├── components/   # 天气展示组件
│       ├── context/      # 登录态
│       ├── hooks/  utils/
│       └── pages/        # 7 个业务页面
├── docker-compose.yml
├── nginx.conf                        # 静态文件 + /api 反代
├── deploy.sh
├── agri-weather.service              # systemd 单元（非 Docker 部署用）
└── .env.example
```

---

## API 概览

所有业务接口以 `/api` 开头，除注册登录外均需 `Authorization: Bearer <token>`。

| 分组 | 接口 |
|---|---|
| 认证 `/api/auth` | `POST /register` · `POST /login` · `POST /refresh`（轮换 refresh token）· `POST /logout` · `POST /logout-all` · `DELETE /account` · `GET/PUT /profile` · `PUT /password` |
| 地块 `/api/farmlands` | `GET /` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /{id}/weather` · `GET /{id}/alerts` · `GET /{id}/advice` · `GET/POST /{id}/seasons` · `PUT/DELETE /{id}/seasons/{seasonId}` · `GET/POST /{id}/operations` · `PUT/DELETE /{id}/operations/{operationId}` · `GET /{id}/tasks` · `POST /{id}/tasks/extract` · `POST /{id}/tasks/confirm` · `PUT/DELETE /{id}/tasks/{taskId}` · `GET /{id}/tasks/summary`（创建/更新支持 `boundary` 边界数组） |
| 天气 `/api/weather` | `GET /?lat=&lng=`（统一走服务端缓存与 Open-Meteo / 和风备源） |
| 作物 `/api/crops` | `GET /` · `GET /{id}` · `GET /search` · `GET /{id}/stages` · `GET /{id}/weather-match` · `GET /{id}/current-stage` |
| 预警 `/api/alerts` | `GET /` · `GET /check/{farmlandId}` · `GET /unread-count` · `PUT /{id}/read` · `PUT /read-all` |
| 病虫害 `/api/pests` | `GET /` · `GET /type/{type}` |
| 农事建议 `/api/operations` | `POST /advice/{farmlandId}` |
| 智能体 `/api/agent` | `POST /chat` · `POST /chat/stream`（SSE 实时轨迹）· `POST /vision`（multipart，需要登录）· `POST /transcribe`（multipart 音频转文字）· `POST /document`（multipart 文档解析并建索引，返回 `documentId`）· `GET /tools` · `GET /status` · `GET /metrics`（成功率/延迟/工具/检索/安全/反馈指标） |
| 推送 `/api/push` | `GET /public-key` · `POST /subscribe` · `DELETE /subscribe`（Web Push，需要 HTTPS） |
| 智能体控制台 `/api/agents` | `GET /` · `GET/PUT /{id}` · `POST /{id}/reset` · `POST /sync` · `GET/DELETE /{id}/messages` · `POST /{id}/feedback`（点赞/点踩）· 知识库 `/knowledge`（文本/文件/检索/重建向量） |
| 社区 `/api/community` | `GET /posts` · `POST /posts` · `GET /posts/{id}` · `POST /posts/{id}/comments` · `POST`/`DELETE /posts/{id}/like` · `DELETE /posts/{id}` |
| 社区图片 `/api/community/images` | `POST /`（multipart，需登录）· `GET /{publicId}`（公开） |

社区发帖支持富文本（Quill 编辑器，HTML 经服务端白名单净化后入库）和图片：JPG/PNG、单张 ≤5MB、每帖 ≤9 张，图片存 MySQL 并由后端出图；上传后 24 小时未发布会被定时清理。

### AI 评测与安全

- **运行指标**：`GET /api/agent/metrics` 返回请求数、成功率、平均延迟、工具调用数、知识命中、文档轮次、安全提示次数、点赞/点踩数；智能体控制台顶部同步展示并每 30 秒刷新
- **接口限流与额度**：登录/注册、智能体对话、上传接口按用户或 IP 每分钟限流；每用户每日对话额度默认 80 次，Redis 不可用时自动放行
- **用户反馈**：回答下方 👍/👎 写入 `agent_feedback`，可按消息去重更新
- **安全兜底**：`AgriSafetyGuard` 检测高毒/禁用农药、绝对化承诺，并自动隐去手机号/身份证号
- **RAG 质量评测**：`POST /api/agents/{id}/knowledge/eval`，用问题 + 期望关键词统计检索命中率；样例见 [docs/ai-eval-set.json](docs/ai-eval-set.json)，实测报告见 [docs/ai-eval-report.md](docs/ai-eval-report.md)（10 条水稻问题、8 份资料，hit@5 10/10）
- **推送指标**：`/api/agent/metrics` 的 `push` 字段包含推送成功、失败、失效订阅数
- **演示材料**：[docs/demo-script.md](docs/demo-script.md)（5 分钟答辩脚本）· [docs/pilot-guide.md](docs/pilot-guide.md)（小范围试点与指标口径）· [docs/pilot-report.sql](docs/pilot-report.sql)（试点数据导出）

### MCP 工具服务

[mcp-server/](mcp-server/) 把地块、天气、农事建议、作物检索封装成标准 MCP tools（stdio），并提供创建农事记录、种植季、提醒 3 个写工具；写操作需显式 `confirm=true`，每次调用写本地审计日志。配置见 [mcp-server/README.md](mcp-server/README.md)。

### 数据库迁移

表结构由 Flyway 管理，脚本在 `agri-weather-server/src/main/resources/db/migration/`：

- `V1__baseline.sql`：完整基线（建表 + 种子数据）
- `V2__agent_document_ids.sql`：多文档引用
- `V3__account_security.sql`：token 版本号 + refresh token
- `V4__farmland_seasons.sql`：地块季节历史
- `V5__farm_plan_tasks.sql`：方案农事任务
- 新增结构变更时添加 `V{n}__描述.sql`，启动时自动执行

老库首次接入 Flyway 时会被标记为 V1 基线，不会重复建表；升级旧版本仍需先执行 `sql/migrations/` 中尚未运行的手工脚本。

### 数据库表

`sys_user` · `crop_info` · `crop_growth_stage` · `farmland` · `pest_knowledge` · `weather_alert` · `farm_operation` · `solar_term_guide` · `community_post` · `community_comment` · `community_like` · `community_image` · `farmland_agent` · `agent_knowledge_doc` · `agent_knowledge_chunk` · `agent_chat_message` · `agent_document` · `agent_document_chunk` · `push_subscription` · `agent_feedback`

---

## 环境变量

生产环境（`--spring.profiles.active=prod`）全部敏感信息从环境变量读取：

| 变量 | 说明 |
|---|---|
| `DB_URL` | 数据库连接地址 |
| `DB_USER` / `DB_PASSWORD` | 数据库账号 |
| `JWT_SECRET` | JWT 签名密钥，至少 256 位随机串 |
| `CORS_ORIGINS` | 允许的前端域名，逗号分隔 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（[申请地址](https://platform.deepseek.com/api_keys)） |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` | 可选，OpenAI 兼容的 Embedding 服务；不配置时使用本地字词向量 |
| `VISION_API_KEY` | 可选，视觉模型密钥；不填默认复用 `DEEPSEEK_API_KEY` |
| `VISION_MODEL` | 可选，默认 `deepseek-v4-flash-vision-exp` |
| `ASR_BASE_URL` / `ASR_API_KEY` / `ASR_MODEL` | 可选，OpenAI 兼容的语音识别服务（如 Whisper）；不配置时前端回退浏览器语音识别 |
| `ASR_LANGUAGE` | 可选，识别语言，默认 `zh` |
| `ALERT_REFRESH_INTERVAL_MS` | 可选，后台预警检查间隔，默认 1800000（30 分钟） |
| `RATE_LIMIT_AUTH_PER_MINUTE` / `RATE_LIMIT_AGENT_PER_MINUTE` / `RATE_LIMIT_UPLOAD_PER_MINUTE` | 可选，登录/智能体/上传接口每分钟限流，默认 20 / 10 / 6 |
| `AI_DAILY_CHAT_QUOTA` | 可选，每用户每日 AI 对话额度，默认 80，0 表示不限制 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | 可选，Web Push 后台推送；生成一次后固定使用，多实例共享。生成：`./mvnw -q org.codehaus.mojo:exec-maven-plugin:3.1.0:java -Dexec.mainClass=com.agriweather.push.VapidKeyGenerator` |
| `DOCUMENT_TTL_DAYS` / `DOCUMENT_MAX_CHUNKS` | 可选，对话文档保留天数（默认 7）与最多索引片段数（默认 120） |
| `SERVER_PORT` | 后端端口，默认 8082 |

**不要把密钥写进 `application.yml` 并提交**——该文件会进 Git。本地开发用环境变量注入。

---

## 部署

### Nginx 架构

前端静态文件由 Nginx 托管，`/api` 反向代理到后端，同域部署无需跨域配置：

```
浏览器 → Nginx :80
           ├── /            → 前端静态文件
           └── /api/*       → 后端 :8082
```

配置见 [nginx.conf](nginx.conf)。启用 HTTPS 需取消 `docker-compose.yml` 中 443 端口的注释并挂载证书。

### 非 Docker 部署（systemd + Nginx）

`deploy.sh` 分两步，首次用 `setup`，之后每次更新用 `deploy`：

```bash
chmod +x deploy.sh

# 首次：检查 JDK/MySQL/Nginx、建目录、初始化数据库、注册 systemd 与 Nginx
./deploy.sh setup

# ⚠️ 按提示编辑服务文件填入真实密码和密钥
sudo vi /etc/systemd/system/agri-weather.service   # 改 DB_PASSWORD、JWT_SECRET、CORS_ORIGINS
sudo systemctl daemon-reload && sudo systemctl start agri-weather

# 之后每次发布：构建前后端、部署、重启服务
./deploy.sh deploy
```

服务单元见 [agri-weather.service](agri-weather.service)（以 `prod` profile 运行，敏感信息全部走 `Environment` 行）。日志用 `sudo journalctl -u agri-weather -f` 查看。

---

## 团队信息

- 学校：湖南第一师范学院
- 专业：数据科学与大数据技术

| 成员 | 角色 | 主要分工 |
|---|---|---|
| 曾嘉晨 | 项目负责人 / 后端与 AI | 后端架构、Spring Boot 接口、Agent 工具链、RAG、数据库设计与服务器部署 |
| 贺宇豪 | 前端与交互 | React 页面与组件、桌面驾驶舱、地块地图、PWA、语音/文档交互与响应式适配 |
| 魏敬轩 | 数据与算法 | 作物与病虫害数据整理、播种适配算法、检索评测、测试与数据校验 |

三人共同参与需求分析、功能联调、测试验收和答辩准备。项目代码仓库保留了从初始化到当前版本的完整提交历史。

---

## 说明

- 天气数据来自 Open-Meteo 免费接口，无需申请密钥，但有调用频率限制。
- 智能体单次对话最多 6 轮工具调用（`max-iterations`），超时 60 秒，可在 `application.yml` 调整。
- 灾害预警基于作物适宜参数与实际气象的阈值比对，结论仅供参考，实际农事决策请结合田间情况。
