# 智慧农业天气系统

面向农业生产的**气象 + 农事**一体化平台。把实时天气、作物生长模型、灾害预警和 AI 农事顾问整合到同一个工作台，回答的是种地实际会问的问题——「明天适合打药吗」「这块地该防冻了吗」。

后端 Spring Boot + 前端 React，天气数据取自 Open-Meteo（免费、无需密钥），农事问答由 DeepSeek 驱动，模型自主调用工具查真实数据，不编造。

---

## 功能

| 模块 | 说明 |
|---|---|
| 📊 工作台 | 汇总各地块当日天气、生长阶段与待处理预警 |
| 🤖 AgriChat / 助农手 | 多模态对话顾问。能看作物照片识别植物、生长阶段和病虫害，自主调用工具查询真实数据，并展示每轮思考与工具调用轨迹 |
| 🌱 作物适配 | 34 种常见作物的知识库，含生长阶段划分与「当前天气是否适合该作物」的匹配度分析 |
| 🐛 病虫害库 | 按类型检索病虫害，关联防治建议 |
| 🔔 预警中心 | 对地块执行灾害检查：冻害、热害、涝害、大风、病虫害 |
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

可用工具（7 个）：`list_farmlands` · `get_farmland_detail` · `get_weather` · `get_crop_stage` · `get_operation_advice` · `check_alerts` · `search_crop`

详见 [agri-weather-server/AI_AGENT.md](agri-weather-server/AI_AGENT.md)。

---

## 技术栈

**后端** — Spring Boot 3.5.2 · Java 17 · Spring Security + JWT (jjwt 0.12.6) · Spring Data JPA · MySQL 8 · Lombok

**前端** — React 19 · Vite 8 · react-router-dom 7 · 原生 CSS（玻璃拟态）

**外部服务** — [Open-Meteo](https://open-meteo.com/)（天气，免费无密钥）· [DeepSeek](https://platform.deepseek.com/)（农事智能体）

**部署** — Docker Compose（MySQL + 后端 + Nginx）

---

## 快速开始

### 方式一：Docker 一键部署

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入数据库密码和 JWT 密钥
#   JWT 密钥生成：openssl rand -base64 64

# 2. 构建前端静态文件
cd weather-app-react && npm install && npm run build && cd ..

# 3. 启动
docker-compose up -d
```

访问 http://localhost 即可。`sql/schema.sql` 会在容器首次启动时自动建表。

```bash
docker-compose logs -f    # 查看日志
docker-compose down       # 停止
```

### 方式二：本地开发

**前置**：JDK 17+、Node.js 18+、MySQL 8

```bash
# 1. 建库并导入表结构
mysql -u root -p -e "CREATE DATABASE agri_weather DEFAULT CHARSET utf8mb4;"
mysql -u root -p agri_weather < agri-weather-server/sql/schema.sql

# 已有旧库升级（新库可跳过）：社区富文本/图片 + 地块边界 + 作物库扩充
mysql -u root -p agri_weather < agri-weather-server/sql/migrations/20261023_community_rich_text.sql
mysql -u root -p agri_weather < agri-weather-server/sql/migrations/20261024_farmland_boundary.sql
mysql -u root -p agri_weather < agri-weather-server/sql/migrations/20261026_more_crops.sql

# 2. 设置 DeepSeek 密钥（Windows 用 setx，改完需重开终端）
export DEEPSEEK_API_KEY=sk-你的密钥

# 3. 启动后端（默认 8082 端口）
cd agri-weather-server && ./mvnw spring-boot:run

# 4. 启动前端（默认 5173 端口）
cd weather-app-react && npm install && npm run dev
```

未设置 `CORS_ORIGINS` 时后端默认放行 `http://localhost:*` 的任意端口，本地开发无需额外配置跨域。

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
| 认证 `/api/auth` | `POST /register` · `POST /login` |
| 地块 `/api/farmlands` | `GET /` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /{id}/weather` · `GET /{id}/alerts` · `GET /{id}/advice`（创建/更新支持 `boundary` 边界数组） |
| 作物 `/api/crops` | `GET /` · `GET /{id}` · `GET /search` · `GET /{id}/stages` · `GET /{id}/weather-match` · `GET /{id}/current-stage` |
| 预警 `/api/alerts` | `GET /` · `GET /check/{farmlandId}` · `GET /unread-count` · `PUT /{id}/read` · `PUT /read-all` |
| 病虫害 `/api/pests` | `GET /` · `GET /type/{type}` |
| 农事建议 `/api/operations` | `POST /advice/{farmlandId}` |
| 智能体 `/api/agent` | `POST /chat` · `POST /vision`（multipart，需要登录）· `GET /tools` · `GET /status` |
| 社区 `/api/community` | `GET /posts` · `POST /posts` · `GET /posts/{id}` · `POST /posts/{id}/comments` · `POST`/`DELETE /posts/{id}/like` · `DELETE /posts/{id}` |
| 社区图片 `/api/community/images` | `POST /`（multipart，需登录）· `GET /{publicId}`（公开） |

社区发帖支持富文本（Quill 编辑器，HTML 经服务端白名单净化后入库）和图片：JPG/PNG、单张 ≤5MB、每帖 ≤9 张，图片存 MySQL 并由后端出图；上传后 24 小时未发布会被定时清理。

### 数据库表

`sys_user` · `crop_info` · `crop_growth_stage` · `farmland` · `pest_knowledge` · `weather_alert` · `farm_operation` · `solar_term_guide` · `community_post` · `community_comment` · `community_like` · `community_image`

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
| `VISION_API_KEY` | 可选，视觉模型密钥；不填默认复用 `DEEPSEEK_API_KEY` |
| `VISION_MODEL` | 可选，默认 `deepseek-v4-flash-vision-exp` |
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

## 说明

- 天气数据来自 Open-Meteo 免费接口，无需申请密钥，但有调用频率限制。
- 智能体单次对话最多 6 轮工具调用（`max-iterations`），超时 60 秒，可在 `application.yml` 调整。
- 灾害预警基于作物适宜参数与实际气象的阈值比对，结论仅供参考，实际农事决策请结合田间情况。
