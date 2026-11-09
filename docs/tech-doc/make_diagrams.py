# -*- coding: utf-8 -*-
"""生成技术文档所需示意图（Matplotlib，输出 PNG）。

图幅按最终排版宽度（约 16.5cm）设计，避免缩放后字号过小。
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "assets")
os.makedirs(ASSETS, exist_ok=True)

FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_B = "C:/Windows/Fonts/msyhbd.ttc"
FP = FontProperties(fname=FONT)
FPB = FontProperties(fname=FONT_B)

INK = "#22352B"
GREEN = "#2F6B4F"
GREEN2 = "#5A9474"
LGREEN = "#EAF3ED"
BLUE = "#35658F"
LBLUE = "#EAF1F8"
AMBER = "#B9802C"
LAMBER = "#FBF2E3"
GRAY = "#66717A"
LGRAY = "#F5F7F8"
BORDER = "#C9D3D9"


def canvas(w, h):
    fig = plt.figure(figsize=(w, h), dpi=200)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")
    ax.set_facecolor("white")
    return fig, ax


def box(ax, x, y, w, h, title, lines=None, fc=LGREEN, ec=GREEN2, tc=INK,
        fs=9.3, lfs=7.7, lw=0.9, bold=True, radius=0.55):
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad=0.2,rounding_size={radius}",
                       linewidth=lw, edgecolor=ec, facecolor=fc, zorder=2)
    ax.add_patch(p)
    lines = lines or []
    tx = x + w / 2
    if lines:
        title_y = y + h - 2.35
        ax.text(tx, title_y, title, ha="center", va="center", fontsize=fs,
                color=tc, fontproperties=(FPB if bold else FP), zorder=3)
        gap = 2.45
        start = title_y - 3.4
        for i, line in enumerate(lines):
            ax.text(tx, start - i * gap, line, ha="center", va="center",
                    fontsize=lfs, color=INK, fontproperties=FP, zorder=3)
    else:
        ax.text(tx, y + h / 2, title, ha="center", va="center", fontsize=fs,
                color=tc, fontproperties=(FPB if bold else FP), zorder=3)


def arrow(ax, x1, y1, x2, y2, color=GREEN2, lw=1.05, style="-|>", ls="-",
          rad=0.0, label=None, lcolor=GRAY, lfs=7.0, lpos=0.5, loff=(0, 0)):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style,
                        mutation_scale=9, linewidth=lw, color=color,
                        linestyle=ls, connectionstyle=f"arc3,rad={rad}",
                        zorder=4, shrinkA=1, shrinkB=1)
    ax.add_patch(a)
    if label:
        lx = x1 + (x2 - x1) * lpos + loff[0]
        ly = y1 + (y2 - y1) * lpos + loff[1]
        ax.text(lx, ly, label, ha="center", va="center", fontsize=lfs,
                color=lcolor, fontproperties=FP,
                bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.95),
                zorder=6)


def band(ax, y, h, label, color, fs=7.9):
    ax.add_patch(Rectangle((1.2, y), 97.6, h, facecolor=color, edgecolor="none",
                           alpha=0.55, zorder=0))
    ax.text(5.4, y + h / 2, label, ha="center", va="center",
            fontsize=fs, color=GREEN, fontproperties=FPB, zorder=1)


# ---------------------------------------------------------------- 图1 总体架构
def fig_architecture():
    fig, ax = canvas(7.2, 5.7)
    ax.text(2, 97.4, "问田系统总体架构", fontsize=12.6, color=INK, fontproperties=FPB)
    ax.text(2, 94.2, "分层解耦；外部服务可替换、可降级", fontsize=7.5, color=GRAY, fontproperties=FP)

    # 外部服务
    box(ax, 83.5, 30, 15, 62, "外部服务", [
        "Open-Meteo",
        "和风（备源）",
        "DeepSeek Chat",
        "DeepSeek Vision",
        "Embedding",
        "ASR（可选）",
    ], fc="#F8F2E9", ec=AMBER, fs=8.9, lfs=7.6)

    # 接入层
    band(ax, 82.5, 9.5, "接入层", "#F0F4F1")
    box(ax, 9.5, 83.6, 31, 7.0, "浏览器 / PWA", ["桌面 · 移动 · 离线缓存"], fc="white", ec=GREEN2, fs=9.1, lfs=7.7)
    box(ax, 44.5, 83.6, 31, 7.0, "Nginx :80 / :443", ["静态资源 · /api · SSE"], fc="white", ec=GREEN2, fs=9.1, lfs=7.7)
    arrow(ax, 40.7, 87.1, 44.0, 87.1)

    # 前端层
    band(ax, 69.5, 10.8, "前端层", "#F0F4F1")
    fe = ["驾驶舱", "地块/地图", "作物/播种", "预警中心", "助农手", "社区", "个人中心"]
    x = 9.5
    for name in fe:
        box(ax, x, 71.2, 9.55, 6.6, name, None, fc="white", ec=GREEN2, fs=7.6)
        x += 10.1
    ax.text(9.5, 68.4, "React 19 · Vite 8 · TS strict · 路由拆分 · Workbox PWA",
            fontsize=7.0, color=GRAY, fontproperties=FP)
    arrow(ax, 26, 83.2, 26, 78.2)

    # 应用服务层
    band(ax, 48, 17.5, "应用服务层", "#EDF2F7")
    svc = [
        ("认证与地块", ["JWT · 限流", "边界 · 季节"]),
        ("天气与预警", ["缓存 · 双源", "规则 · 推送"]),
        ("作物与任务", ["64 种作物", "方案 · 提醒"]),
        ("社区与内容", ["净化 · 图片"]),
        ("AI 指标", ["延迟 · 反馈"]),
    ]
    x = 9.5
    for title, lines in svc:
        box(ax, x, 50.0, 13.2, 12.2, title, lines, fc="white", ec=BLUE, fs=8.7, lfs=7.5)
        x += 14.2
    arrow(ax, 26, 69.2, 26, 62.5)

    # 智能体层
    band(ax, 27.5, 17.8, "智能体层", "#F0F4F1")
    box(ax, 9.5, 29.2, 18.0, 13.2, "AgentHarness", ["工具循环", "6 轮 + 收敛", "SSE 观察者"], fc="white", ec=GREEN, fs=8.9, lfs=7.6)
    box(ax, 29.5, 29.2, 21.0, 13.2, "ToolRegistry · 9 工具", ["地块 / 天气 / 阶段", "预警 / 作物 / 病虫", "越权校验 · 错误回喂"], fc="white", ec=GREEN, fs=8.7, lfs=7.5)
    box(ax, 52.5, 29.2, 17.5, 13.2, "RAG 知识库", ["bigram + IDF", "本地 / 外部向量", "Top4 + 引用"], fc="white", ec=GREEN, fs=8.9, lfs=7.6)
    box(ax, 72.0, 29.2, 9.2, 13.2, "多模态", ["识图", "语音", "文档"], fc="white", ec=GREEN, fs=8.5, lfs=7.5)
    arrow(ax, 26, 47.7, 26, 45.4)

    # 数据层
    band(ax, 10, 14.5, "数据层", "#EDF2F7")
    box(ax, 9.5, 11.6, 24, 10.0, "MySQL 8 · 23 张表", ["用户 / 地块 / 作物", "知识 / 对话 / 社区"], fc="white", ec=BLUE, fs=8.9, lfs=7.6)
    box(ax, 36.0, 11.6, 22, 10.0, "Redis 7", ["缓存 / 锁 / 限流", "30 min 新鲜"], fc="white", ec=BLUE, fs=8.9, lfs=7.6)
    box(ax, 60.5, 11.6, 19, 10.0, "Flyway", ["版本化迁移", "schema 基线"], fc="white", ec=BLUE, fs=8.9, lfs=7.6)
    arrow(ax, 26, 27.2, 26, 24.8)

    # 外部调用
    arrow(ax, 75.7, 87.1, 83.2, 87.1, color=AMBER, style="<|-|>", label="HTTPS", lfs=6.4)
    arrow(ax, 81.5, 56.5, 83.2, 58.0, color=AMBER, style="<|-|>")
    arrow(ax, 81.4, 35.5, 83.2, 39.0, color=AMBER, style="<|-|>")
    ax.text(20.0, 25.6, "外部依赖可通过配置替换或降级；未配置时对应能力关闭，不影响核心链路。",
            fontsize=7.0, color=GRAY, fontproperties=FP)

    fig.savefig(os.path.join(ASSETS, "fig1-architecture.png"), dpi=300,
                facecolor="white", bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)


# ---------------------------------------------------------------- 图2 智能体循环
def fig_agent_loop():
    fig, ax = canvas(7.2, 4.9)
    ax.text(2, 96.0, "农事智能体的工具调用循环", fontsize=12.6, color=INK, fontproperties=FPB)
    ax.text(2, 92.2, "模型自主决定查什么，平台负责真实数据、权限边界与收敛保护",
            fontsize=7.5, color=GRAY, fontproperties=FP)

    box(ax, 3, 66, 18, 15.5, "① 用户提问", ["自然语言 / 语音", "作物照片识别", "对话内文档"], fc="white", ec=GREEN2, fs=8.9, lfs=7.6)
    box(ax, 24, 66, 23.5, 15.5, "② 上下文组装", ["system + 人设", "历史裁剪（20 条）", "知识片段 + 边界"], fc=LGREEN, ec=GREEN, fs=8.9, lfs=7.6)
    box(ax, 51, 66, 21.5, 15.5, "③ 模型决策", ["DeepSeek reasoner", "温度 0.3 · 4096 tokens", "判断是否需要工具"], fc=LBLUE, ec=BLUE, fs=8.9, lfs=7.6)
    box(ax, 77, 66, 19.5, 15.5, "⑥ 最终回答", ["建议 + 依据", "工具轨迹", "思考摘要"], fc=LGREEN, ec=GREEN, fs=8.9, lfs=7.6)

    box(ax, 51, 36, 21.5, 17.5, "④ 工具执行", ["9 个农事工具", "归属 / 范围校验", "失败转 JSON"], fc="white", ec=BLUE, fs=8.9, lfs=7.6)
    box(ax, 24, 36, 23.5, 17.5, "⑤ 结果回喂", ["天气 / 阶段 / 规则", "结果摘要 300 字", "进入下一轮"], fc="white", ec=BLUE, fs=8.9, lfs=7.6)

    arrow(ax, 21.2, 73.7, 23.7, 73.7)
    arrow(ax, 47.7, 73.7, 50.6, 73.7)
    arrow(ax, 61.7, 65.7, 61.7, 54.0, label="需要真实数据", lpos=0.5, loff=(8.4, 0))
    arrow(ax, 50.6, 44.7, 47.8, 44.7, label="tool 消息", lpos=0.5, loff=(0, 2.2))
    arrow(ax, 36, 54.0, 36, 65.7, label="下一轮", lpos=0.5, loff=(-3.8, 0))
    arrow(ax, 72.6, 73.7, 76.6, 73.7, label="无需工具", lpos=0.5, loff=(0, 2.2), lfs=6.4)

    box(ax, 3, 16.5, 94, 14.5, "收敛与容错", [
        "轮数上限 6：仍未收敛则禁用工具再问一次，响应标记 truncated，前端提示“回答可能不完整”。",
        "工具异常以可读 JSON 回喂模型，由模型自行换思路；SSE 可取消，取消后停止后续工具调用。",
    ], fc=LAMBER, ec=AMBER, fs=8.9, lfs=7.6)
    arrow(ax, 61.7, 35.4, 61.7, 31.2, color=AMBER, ls=(0, (3, 2)), lw=0.9)
    ax.text(63.6, 32.7, "轮数耗尽", fontsize=6.3, color=AMBER, fontproperties=FP)

    ax.text(3, 11.5, "SSE 事件：round · reasoning_delta · content_delta · thought · tool_start · tool_end · done · error",
            fontsize=7.0, color=GRAY, fontproperties=FP)
    ax.text(3, 6.3, "每轮记录轮次、工具名、参数、结果摘要与耗时；前端可展开查看，排查与演示共用同一份轨迹。",
            fontsize=7.0, color=GRAY, fontproperties=FP)

    fig.savefig(os.path.join(ASSETS, "fig2-agent-loop.png"), dpi=300,
                facecolor="white", bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)


# ---------------------------------------------------------------- 图3 RAG 链路
def fig_rag():
    fig, ax = canvas(7.2, 5.1)
    ax.text(2, 96, "地块知识库的入库与检索链路", fontsize=12.6, color=INK, fontproperties=FPB)
    ax.text(2, 92, "词法信号与向量语义信号混合；宁可少注入，也不塞低相关内容",
            fontsize=7.4, color=GRAY, fontproperties=FP)

    ax.text(3.0, 85.8, "离线：知识入库", fontsize=8.2, color=GREEN, fontproperties=FPB)
    ax.text(55.0, 85.8, "在线：检索与注入", fontsize=8.2, color=BLUE, fontproperties=FPB)

    left = [
        ("上传", ["TXT / MD / PDF / Word", "≤5MB · 编码回退"]),
        ("解析与切块", ["480 字目标 / 600 上限", "重叠 60 字，句末优先"]),
        ("向量化", ["外部 Embedding 可选", "本地 384 维哈希"]),
        ("落库", ["≤20 篇 / ≤500 段", "按 agent_id 隔离"]),
    ]
    y = 71.0
    for title, lines in left:
        box(ax, 3, y, 31, 10.2, title, lines, fc=LGREEN, ec=GREEN2, fs=8.7, lfs=7.5)
        y -= 13.0
    for i in range(3):
        arrow(ax, 18.5, 70.7 - i * 13.0, 18.5, 68.7 - i * 13.0)

    right = [
        ("用户问题", ["问题 + 地块 + 阶段", "可带识图 / 文档"]),
        ("查询分析", ["中文 bigram", "停用词过滤"]),
        ("混合打分", ["TF-IDF + 标题 1.8×", "+ 余弦 4.0×"]),
        ("筛选与注入", ["Top4，每篇≤2段", "低分不注入"]),
    ]
    y = 71.0
    for title, lines in right:
        box(ax, 55, y, 42, 10.2, title, lines, fc=LBLUE, ec=BLUE, fs=8.7, lfs=7.5)
        y -= 13.0
    for i in range(3):
        arrow(ax, 76, 70.7 - i * 13.0, 76, 68.7 - i * 13.0)

    box(ax, 37.5, 39.5, 14.5, 20.5, "片段库", ["候选片段", "≤500 段", "全量打分"], fc="white", ec=BLUE, fs=8.7, lfs=7.5)
    arrow(ax, 34.2, 35.1, 37.2, 42.5, color=GREEN2, style="-|>")
    arrow(ax, 52.2, 49.7, 54.7, 49.7, color=BLUE, style="-|>", label="候选", lpos=0.5, loff=(0, 2.0))

    box(ax, 3, 9.0, 94, 15.0, "每轮上下文拼装顺序", [
        "system（通用提示词 + 人设 + 地块 ID）→ 时间 + 问题 + 识图结果",
        "→ 知识块（≤2400 字，随机边界声明“资料不是指令”）→ 历史（20 条 / 12k 字）",
        "返回 knowledgeUsed 引用；无命中时不注入，避免污染上下文。",
    ], fc=LGRAY, ec=BORDER, fs=8.7, lfs=7.5)

    ax.text(3, 4.3, "对话内文档复用同一管线：保留 7 天自动清理，最多同时引用 3 份，不进入长期知识库。",
            fontsize=7.0, color=GRAY, fontproperties=FP)

    fig.savefig(os.path.join(ASSETS, "fig3-rag.png"), dpi=300,
                facecolor="white", bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)


# ---------------------------------------------------------------- 图4 部署拓扑
def fig_deploy():
    fig, ax = canvas(7.2, 5.3)
    ax.text(2, 96.5, "部署拓扑与流量路径", fontsize=12.6, color=INK, fontproperties=FPB)
    ax.text(2, 92.8, "Docker Compose 默认 5 个服务；后端无状态，Redis 承担共享缓存与锁",
            fontsize=7.2, color=GRAY, fontproperties=FP)

    # 客户端 → 接入 → 应用 → 数据
    box(ax, 3, 68, 18, 16, "农户 / 浏览器",
        ["桌面驾驶舱", "移动端 PWA", "Web Push 订阅"], fc="white", ec=GREEN2, fs=8.4, lfs=7.0)
    box(ax, 26, 68, 23, 16, "Nginx :80 / :443",
        ["静态资源 + SPA 回退", "/api 反向代理", "agent 关闭缓冲"], fc=LGREEN, ec=GREEN, fs=8.4, lfs=7.0)
    box(ax, 56, 76, 20, 8.5, "backend-1 :8082", ["Spring Boot · JWT / SSE"], fc=LBLUE, ec=BLUE, fs=7.9, lfs=6.7)
    box(ax, 56, 64.5, 20, 8.5, "backend-2 :8082", ["同镜像 · least_conn"], fc=LBLUE, ec=BLUE, fs=7.9, lfs=6.7)
    box(ax, 82, 64.5, 15, 20, "数据层",
        ["MySQL 8", "Redis 7", "持久卷"], fc=LGRAY, ec=GRAY, fs=8.4, lfs=7.0)

    arrow(ax, 21.3, 76.0, 25.7, 76.0)
    arrow(ax, 49.2, 80.5, 55.7, 80.0)
    arrow(ax, 49.2, 71.0, 55.7, 69.0)
    arrow(ax, 76.2, 80.2, 81.7, 78.0)
    arrow(ax, 76.2, 69.0, 81.7, 69.8)

    # 外部服务：两个后端共用同一条出口，避免箭头穿过下方实例
    box(ax, 56, 36, 41, 14, "外部服务",
        ["两实例共用：Open-Meteo / 和风", "DeepSeek Chat / Vision", "Embedding / ASR（可选）"],
        fc=LAMBER, ec=AMBER, fs=8.4, lfs=7.0)
    arrow(ax, 70, 64.2, 70, 50.5, color=AMBER, style="<|-|>",
          label="HTTPS", lpos=0.5, loff=(4.0, 0), lfs=6.4)

    # Web Push：从后端绕到浏览器，走下方，避免穿过 Nginx
    ax.plot([57, 57, 12, 12], [64.3, 58.5, 58.5, 67.8],
            color=GREEN2, linewidth=1.0, linestyle=(0, (3, 2)), zorder=4)
    arrow(ax, 12, 62.0, 12, 67.7, color=GREEN2, lw=1.0, style="-|>")
    ax.text(34.5, 59.2, "Web Push / VAPID（HTTPS）", ha="center", va="center",
            fontsize=6.4, color=GRAY, fontproperties=FP,
            bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.95), zorder=6)

    # 单机替代方案：不并入主流程，单独说明
    ax.text(3, 32.0, "单机替代：systemd 后端 + Nginx 前端\n密钥通过 Environment 注入（非 Docker）",
            fontsize=6.6, color=GRAY, fontproperties=FP, va="top")

    box(ax, 3, 10, 94, 16, "运维与可观测", [
        "/actuator/health · restart=always · upstream 故障转移（max_fails）",
        "Flyway 迁移 + Hibernate validate；CI 用全新 MySQL 校验初始化链路",
        "/api/agent/metrics：请求、成功率、延迟、工具、知识命中、反馈",
    ], fc=LGRAY, ec=BORDER, fs=8.0, lfs=6.8)

    ax.text(3, 4.8, "HTTPS 是语音识别、PWA 安装、Web Push 的前置条件；HTTP 演示环境会降级并明确提示。",
            fontsize=6.6, color=GRAY, fontproperties=FP)

    fig.savefig(os.path.join(ASSETS, "fig4-deploy.png"), dpi=300,
                facecolor="white", bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)


if __name__ == "__main__":
    fig_architecture()
    fig_agent_loop()
    fig_rag()
    fig_deploy()
    print("diagrams done:", sorted(os.listdir(ASSETS)))
