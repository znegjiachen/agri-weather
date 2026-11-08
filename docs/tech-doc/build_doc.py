# -*- coding: utf-8 -*-
"""生成《问田 · 智慧农业天气系统技术文档》PDF。"""
import os
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Frame, HRFlowable,
                                Image, KeepTogether, LongTable, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "assets")
OUT = os.path.join(os.path.dirname(os.path.dirname(BASE)), "问田-智慧农业天气系统-技术文档.pdf")
SHOT = os.path.join(os.path.dirname(os.path.dirname(BASE)), "design", "desktop-dashboard.png")
COVER_IMG = os.path.join(ASSETS, "cover-composed.jpg")

# ---------------- 字体 ----------------
pdfmetrics.registerFont(TTFont("MSYH", "C:/Windows/Fonts/msyh.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("MSYHB", "C:/Windows/Fonts/msyhbd.ttc", subfontIndex=0))
pdfmetrics.registerFontFamily("MSYH", normal="MSYH", bold="MSYHB",
                              italic="MSYH", boldItalic="MSYHB")

# ---------------- 配色 ----------------
GREEN = HexColor("#2F6B4F")
GREEN2 = HexColor("#5A9474")
DARK = HexColor("#1F2D26")
GRAY = HexColor("#5F6B73")
LGRAY = HexColor("#F3F6F4")
LBLUE = HexColor("#EDF3F8")
BLUE = HexColor("#35658F")
AMBER = HexColor("#B9802C")
LAMBER = HexColor("#FBF3E6")
RULE = HexColor("#D6E0DA")

PAGE_W, PAGE_H = A4
LM = RM = 2.25 * cm
TM = 2.15 * cm
BM = 1.95 * cm
FRAME_W = PAGE_W - LM - RM  # 16.5cm

# ---------------- 样式 ----------------
S = {}
S["Body"] = ParagraphStyle("Body", fontName="MSYH", fontSize=9.7, leading=16.1,
                           textColor=DARK, alignment=TA_JUSTIFY, wordWrap="CJK",
                           spaceBefore=0, spaceAfter=4.0, firstLineIndent=19.4)
S["BodyNoIndent"] = ParagraphStyle("BodyNoIndent", parent=S["Body"], firstLineIndent=0)
S["H1"] = ParagraphStyle("H1", fontName="MSYHB", fontSize=16.5, leading=22,
                         textColor=GREEN, spaceBefore=2, spaceAfter=2, keepWithNext=1)
S["H2"] = ParagraphStyle("H2", fontName="MSYHB", fontSize=12.2, leading=17,
                         textColor=DARK, spaceBefore=10, spaceAfter=4, keepWithNext=1)
S["H3"] = ParagraphStyle("H3", fontName="MSYHB", fontSize=10.3, leading=15,
                         textColor=GREEN, spaceBefore=6, spaceAfter=2, keepWithNext=1)
S["Bullet"] = ParagraphStyle("Bullet", parent=S["Body"], leftIndent=14,
                             bulletIndent=3, spaceAfter=3.0, firstLineIndent=0)
S["Caption"] = ParagraphStyle("Caption", fontName="MSYH", fontSize=7.9, leading=11.5,
                              textColor=GRAY, alignment=TA_CENTER, spaceBefore=3, spaceAfter=7)
S["TableCaption"] = ParagraphStyle("TableCaption", fontName="MSYHB", fontSize=8.2, leading=11,
                                   textColor=DARK, spaceBefore=4, spaceAfter=3)
S["TableText"] = ParagraphStyle("TableText", fontName="MSYH", fontSize=7.9, leading=11.4,
                                textColor=DARK, wordWrap="CJK")
S["TableHead"] = ParagraphStyle("TableHead", parent=S["TableText"], fontName="MSYHB",
                                textColor=colors.white)
S["TableLabel"] = ParagraphStyle("TableLabel", parent=S["TableText"], fontName="MSYHB",
                                 textColor=DARK)
S["Small"] = ParagraphStyle("Small", fontName="MSYH", fontSize=8.1, leading=12,
                            textColor=GRAY, wordWrap="CJK")
S["Callout"] = ParagraphStyle("Callout", fontName="MSYH", fontSize=8.6, leading=13,
                              textColor=DARK, wordWrap="CJK")
S["Formula"] = ParagraphStyle("Formula", fontName="MSYH", fontSize=8.8, leading=14,
                              textColor=DARK, alignment=TA_CENTER, spaceBefore=3, spaceAfter=4)
S["FrontHead"] = ParagraphStyle("FrontHead", fontName="MSYHB", fontSize=13.5, leading=19,
                                textColor=GREEN, spaceBefore=4, spaceAfter=8)
S["CoverMeta"] = ParagraphStyle("CoverMeta", fontName="MSYH", fontSize=8.8, leading=14,
                                textColor=GRAY)


class Doc(BaseDocTemplate):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.toc_entries = []

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            if flowable.style.name == "H1":
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page))
            elif flowable.style.name == "H2":
                self.notify("TOCEntry", (1, flowable.getPlainText(), self.page))


# ---------------- 画封面 ----------------
def _draw_cover_photo(c, path, x, y, w, h):
    """按 cover 方式裁切图片，填满指定区域。"""
    img = ImageReader(path)
    iw, ih = img.getSize()
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, w, h)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(img, dx, dy, dw, dh, mask="auto")
    c.restoreState()


def draw_cover(c, doc):
    c.saveState()
    h = 12.2 * cm
    top = PAGE_H - h

    # 预先合成的封面底图：真实田野照片 + 左侧绿色渐变 + 底部压暗
    _draw_cover_photo(c, COVER_IMG, 0, top, PAGE_W, h)

    c.setFillColor(AMBER)
    c.rect(0, top - 0.14 * cm, PAGE_W, 0.14 * cm, fill=1, stroke=0)

    # 封面标题
    c.setFillColor(colors.white)
    c.setFont("MSYH", 8.2)
    c.drawString(2.2 * cm, PAGE_H - 2.3 * cm, "SMART AGRICULTURE  ·  FIELD WEATHER  ·  AI ADVISOR")

    c.setFont("MSYHB", 37)
    c.drawString(2.2 * cm, PAGE_H - 5.2 * cm, "问田")
    c.setFont("MSYH", 17)
    c.drawString(2.2 * cm, PAGE_H - 6.6 * cm, "智慧农业天气系统技术文档")
    c.setFont("MSYH", 9.2)
    c.setFillAlpha(0.92)
    c.drawString(2.2 * cm, PAGE_H - 8.1 * cm,
                 "项目概述 · 需求分析 · 系统架构 · AI 方案 · 核心实现 · 测试部署 · 总结展望")
    c.setFillAlpha(1)

    c.setFont("MSYH", 8.0)
    c.drawRightString(PAGE_W - 2.2 * cm, PAGE_H - 11.25 * cm, "Technical Documentation   V1.0")
    c.setFillAlpha(0.65)
    c.setFont("MSYH", 6.4)
    c.drawRightString(PAGE_W - 2.2 * cm, PAGE_H - 11.75 * cm, "封面图：Unsplash（免费许可）")
    c.setFillAlpha(1)

    # 封面信息
    c.setFillColor(DARK)
    c.setFont("MSYHB", 10.5)
    c.drawString(2.2 * cm, PAGE_H - 13.7 * cm, "把实时天气、作物生长模型、灾害预警和 AI 农事顾问，放进同一个工作台。")

    c.setFont("MSYH", 8.6)
    c.setFillColor(GRAY)
    meta = [
        ("文档编号", "QT-TD-2026-001"),
        ("文档版本", "V1.0"),
        ("编制日期", "2026 年 11 月"),
        ("项目仓库", "github.com/znegjiachen/agri-weather"),
        ("演示环境", "http://47.96.25.53"),
    ]
    y = PAGE_H - 15.4 * cm
    for k, v in meta:
        c.setFillColor(GRAY)
        c.drawString(2.2 * cm, y, k)
        c.setFillColor(DARK)
        c.drawString(4.4 * cm, y, v)
        y -= 0.62 * cm

    # 关键数字卡片
    card_y = PAGE_H - 20.9 * cm
    cards = [("64", "种常见作物档案"), ("9", "个可调用农事工具"), ("23", "张业务数据表")]
    x = 2.2 * cm
    for num, label in cards:
        c.setFillColor(LGRAY)
        c.roundRect(x, card_y, 4.6 * cm, 2.3 * cm, 0.22 * cm, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont("MSYHB", 19)
        c.drawString(x + 0.42 * cm, card_y + 1.25 * cm, num)
        c.setFillColor(GRAY)
        c.setFont("MSYH", 7.8)
        c.drawString(x + 0.42 * cm, card_y + 0.55 * cm, label)
        x += 5.05 * cm

    c.setStrokeColor(RULE)
    c.setLineWidth(0.8)
    c.line(2.2 * cm, 3.35 * cm, PAGE_W - 2.2 * cm, 3.35 * cm)

    c.setFillColor(DARK)
    c.setFont("MSYHB", 9.2)
    c.drawString(2.2 * cm, 2.55 * cm, "湖南第一师范学院  ·  数据科学与大数据技术")
    c.setFillColor(GRAY)
    c.setFont("MSYH", 8.3)
    c.drawString(2.2 * cm, 1.95 * cm, "曾嘉晨（项目负责人 / 后端与 AI）  ·  贺宇豪（前端与交互）  ·  魏敬轩（数据与算法）")
    c.drawRightString(PAGE_W - 2.2 * cm, 2.55 * cm, "内部技术资料")
    c.restoreState()


def draw_body(c, doc):
    c.saveState()
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    c.line(LM, PAGE_H - 1.55 * cm, PAGE_W - RM, PAGE_H - 1.55 * cm)
    c.setFont("MSYH", 7.4)
    c.setFillColor(GRAY)
    c.drawString(LM, PAGE_H - 1.35 * cm, "问田 · 智慧农业天气系统技术文档")
    c.drawRightString(PAGE_W - RM, PAGE_H - 1.35 * cm, "V1.0  ·  2026.11")
    c.line(LM, 1.45 * cm, PAGE_W - RM, 1.45 * cm)
    c.drawString(LM, 1.05 * cm, "湖南第一师范学院 · 数据科学与大数据技术")
    c.restoreState()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.setFont("MSYH", 7.6)
                self.setFillColor(GRAY)
                self.drawRightString(PAGE_W - RM, 1.05 * cm,
                                     f"第 {self._pageNumber} 页 / 共 {total} 页")
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)


# ---------------- 内容辅助 ----------------
FIG_NO = [0]
TBL_NO = [0]


def P(text, style="Body"):
    return Paragraph(text, S[style])


def B(text):
    return Paragraph(text, S["Bullet"], bulletText="•")


def H1(text):
    return [CondPageBreak(5.2 * cm), Paragraph(text, S["H1"]),
            HRFlowable(width="100%", thickness=1.1, color=GREEN,
                       spaceBefore=1, spaceAfter=7)]


def H2(text):
    return Paragraph(text, S["H2"])


def H3(text):
    return Paragraph(text, S["H3"])


def FIG(path, width, caption):
    FIG_NO[0] += 1
    img = Image(path)
    ratio = img.imageHeight / img.imageWidth
    img.drawWidth = width
    img.drawHeight = width * ratio
    return [Spacer(1, 2), KeepTogether([img, Paragraph(f"图 {FIG_NO[0]}  {caption}", S["Caption"])])]


def cell(text, head=False):
    return Paragraph(text, S["TableHead"] if head else S["TableText"])


def T(rows, widths, caption=None, head=True, font_size=7.9, zebra=True,
      align_first_left=True):
    TBL_NO[0] += 1
    data = []
    for r, row in enumerate(rows):
        data.append([cell(str(x), head and r == 0) for x in row])
    t = LongTable(data, colWidths=widths, repeatRows=1 if head else 0, hAlign="LEFT")
    style = [
        ("GRID", (0, 0), (-1, -1), 0.35, HexColor("#D7E1DB")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.2),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
    ]
    if head:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ]
    if zebra:
        style.append(("ROWBACKGROUNDS", (0, 1 if head else 0), (-1, -1),
                      [colors.white, HexColor("#F6FAF7")]))
    t.setStyle(TableStyle(style))
    out = [CondPageBreak(3.3 * cm)]
    if caption:
        out.append(Paragraph(f"表 {TBL_NO[0]}  {caption}", S["TableCaption"]))
    out += [t, Spacer(1, 7)]
    return out


def CALLOUT(title, body):
    inner = [Paragraph(f'<font color="#2F6B4F"><b>{title}</b></font>　{body}', S["Callout"])]
    t = Table([[inner]], colWidths=[FRAME_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F2F8F4")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GREEN),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return [t, Spacer(1, 7)]


# =====================================================================
# 文档内容
# =====================================================================
story = []

# ---------------- 封面占位 ----------------
story.append(Spacer(1, 1))
story.append(NextPageTemplate("body"))
story.append(PageBreak())

# ---------------- 文档信息 ----------------
story.append(Paragraph("文档信息", S["FrontHead"]))
info = [
    ["文档名称", "问田 · 智慧农业天气系统技术文档"],
    ["文档编号 / 版本", "QT-TD-2026-001 / V1.0"],
    ["编制单位", "湖南第一师范学院 · 数据科学与大数据技术"],
    ["项目类型", "面向农业生产的“气象 + 农事”一体化 Web / PWA 平台"],
    ["技术栈", "Spring Boot 3.5 · Java 17 · React 19 · MySQL 8 · Redis 7 · DeepSeek · Open-Meteo"],
    ["代码规模", "后端 195 个 Java 文件、约 1.36 万行；前端 55 个 TS/TSX 文件、约 1.19 万行；REST 端点 88 个；数据表 23 张"],
    ["文档状态", "V1.0 交付版，与 2026-11-07 主线代码一致"],
]
t = Table([[Paragraph(a, S["TableLabel"]), cell(b)] for a, b in info], colWidths=[3.3 * cm, FRAME_W - 3.3 * cm])
t.setStyle(TableStyle([
    ("GRID", (0, 0), (-1, -1), 0.35, RULE),
    ("BACKGROUND", (0, 0), (0, -1), LGRAY),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
]))
story += [t, Spacer(1, 10)]

story.append(Paragraph("摘要", S["FrontHead"]))
story.append(P("“问田”是一套面向农业生产的“气象 + 农事”一体化平台。它把地块档案、实时与逐日天气、作物生育期、灾害预警、农事任务和 AI 农事顾问整合到同一个工作台，回答的不是“明天天气怎么样”，而是“我这块地明天能不能打药”“这块水稻该防冻了吗”这类直接影响作业决策的问题。"))
story.append(P("系统后端采用 Spring Boot 3.5 + Java 17，前端采用 React 19 + TypeScript，数据层使用 MySQL 8 与 Redis 7，天气数据来自 Open-Meteo（和风天气作为备源），AI 能力由 DeepSeek 提供。项目的技术重点不在“接入一个大模型”，而在把模型接到真实数据与可执行工具上：每块地拥有独立的助农手，模型可自主调用 9 个农事工具查询天气、生育期、预警与规则结论；知识库采用中文 bigram + IDF 与向量混合检索；农学阈值由确定性规则引擎计算，模型负责调度与表达；全流程具备地块权限校验、输出安全兜底、运行指标与可复现评测。"))
story.append(P("在测试环境中，知识库检索评测 hit@5 为 10/10（10 条水稻问题、8 份资料），Agent 模拟评测的 5 个场景均正确选择了工具并基于真实数据作答；与同模型无工具方案、其他通用模型裸答的对照实验表明，本系统能回答需要地块数据的问题，而通用模型只能要求用户补充信息。上述结果样本较小，仅用于验证技术路线，不代表田间效果。"))

kw = Paragraph("<b>关键词：</b>智慧农业；农业气象；大语言模型；工具调用；检索增强生成；灾害预警；Spring Boot；React", S["BodyNoIndent"])
story += [kw, Spacer(1, 8)]

story.append(Paragraph("文档结构", S["FrontHead"]))
structure = [
    ["第 1 章", "项目概述：背景、定位、目标、功能概览与团队"],
    ["第 2 章", "需求分析：角色、场景、功能与非功能需求、约束与取舍"],
    ["第 3 章", "系统架构设计：分层架构、技术选型、数据模型、关键链路"],
    ["第 4 章", "AI 技术方案：选型理由、集成方式、优化策略、评测与局限"],
    ["第 5 章", "核心功能实现：地块、天气、作物、预警、助农手、任务、社区、MCP"],
    ["第 6 章", "测试与部署：测试体系、CI、Docker / systemd、运维"],
    ["第 7 章", "总结与展望：成果、技术创新点、应用创新点、不足与路线"],
]
t = Table([[Paragraph(a, S["TableLabel"]), cell(b)] for a, b in structure], colWidths=[2.6 * cm, FRAME_W - 2.6 * cm])
t.setStyle(TableStyle([
    ("LINEBELOW", (0, 0), (-1, -1), 0.3, RULE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 3.2),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
    ("LEFTPADDING", (0, 0), (-1, -1), 3),
]))
story += [t, Spacer(1, 6)]
story.append(P("阅读建议：关注 AI 方案的读者可直接阅读第 4 章；关注工程实现的读者可结合第 3、5、6 章阅读；第 7 章集中列出项目的技术创新点与应用创新点。", "Small"))

story.append(PageBreak())

# ---------------- 目录 ----------------
story.append(Paragraph("目　录", S["FrontHead"]))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle("TOC1", fontName="MSYHB", fontSize=10.2, leading=18,
                   textColor=DARK, spaceBefore=3),
    ParagraphStyle("TOC2", fontName="MSYH", fontSize=9.1, leading=14.2,
                   textColor=GRAY, leftIndent=16, firstLineIndent=0),
]
toc.dotsMinLevel = 0
story += [toc, Spacer(1, 10)]
story.append(P("说明：本目录页码为 PDF 物理页码，封面为第 1 页。", "Small"))
story.append(PageBreak())

# =====================================================================
# 1 项目概述
# =====================================================================
story += H1("1  项目概述")

story.append(H2("1.1  项目背景"))
story.append(P("农业生产高度依赖天气，但农户真正需要的并不是一份“全县明天多云转晴”的预报。同样 25℃、同样 3 级风，处在苗期的水稻和处在收获期的水稻，能做的农事完全不同；同一块地，打药、施肥、灌溉、采收对风速、降水、温度的要求也并不一致。传统天气应用给出了气象要素，却没有给出“这块地、这个生育期、这个作业”能不能做的结论。"))
story.append(P("另一方面，通用大模型虽然掌握了大量农业知识，却不知道用户有几块地、每块地种了什么、什么时候播种、未来 24 小时是否霜冻。它只能给出“打药应避开大风和降雨”这样的通用原则，用户仍要自己查天气、判断生育期、换算阈值。知识库、地方栽培指南、植保情报又分散在不同载体中，农户很难在田间按需检索。"))
story.append(P("项目由此出发：以地块为最小服务单元，把公开气象数据、作物生长参数、确定性农事规则和可调用工具的 AI 顾问组合起来，让系统回答“明天适合打药吗”并给出具体依据，而不是把判断成本重新推回给农户。"))

story.append(H2("1.2  产品定位与建设目标"))
story.append(P("“问田”定位为面向小农户、合作社和基层农技员的地块级“气象 + 农事”工作台。它不替代气象部门发布的官方预警，也不替代当地植保站的病虫情报；它的价值在于把公开数据、标准资料和规则引擎组织成可执行、可解释、可追溯的农事建议。"))
story.append(B("<b>地块级天气：</b>按经纬度获取实时与 7 日预报，30 分钟内命中缓存；上游异常时自动切换备源或返回过期缓存，避免“天气服务一挂，整个平台不可用”。"))
story.append(B("<b>风险预警闭环：</b>冻害、热害、涝害、大风、阶段温度异常与病虫害阈值检查；后台每 30 分钟巡检，站内未读与 Web Push 推送联动，形成“发现—提醒—已读”的最小闭环。"))
story.append(B("<b>生育期与播种适配：</b>64 种常见作物的适宜播种期与生长阶段；结合地块实时气象给出播期匹配度，并标注数据来源与置信度。"))
story.append(B("<b>可执行农事建议：</b>围绕打药、施肥、灌溉、播种、采收给出未来 7 天的适宜窗口与禁令，说明温度、降水、风速等具体理由。"))
story.append(B("<b>可信 AI 顾问：</b>模型自主调用工具查询真实数据，农学判断由规则引擎计算；全流程可查看工具轨迹，输出经过安全兜底。"))
story.append(B("<b>工程可交付：</b>数据库版本化迁移、CI 质量门禁、容器化与 systemd 双部署路径、健康检查与 AI 运行指标。"))

story.append(H2("1.3  功能概览"))
story += T([
    ["模块", "主要能力", "关键实现"],
    ["桌面驾驶舱", "今日天气、地块卡片、7 日趋势、预警与今日农事一屏呈现；宽屏常驻助农手", "React 响应式布局；多数据源聚合"],
    ["智能体控制台", "每块地自动生成专属助农手；人设、知识库、工具开关、会话历史、反馈与指标", "farmland_agent 1:1；RAG；SSE 轨迹"],
    ["助农手", "多模态对话顾问；自主调用 9 个工具；流式展示思考与工具调用；支持点赞/点踩", "AgentHarness；DeepSeek；Tool SPI"],
    ["播种适配", "64 种作物的播期与生育期；结合实时气象给出匹配度分析", "QX/T 734—2024 + FAO EcoCrop 思路"],
    ["预警中心", "冻害、热害、涝害、大风、病虫害检查；后台巡检与 Web Push", "规则引擎；Redis 锁；VAPID"],
    ["地块管理", "增删改查、作物与播期、卫星底图圈地、亩数计算、种植季历史", "Leaflet；边界点几何计算"],
    ["天气预报", "逐小时 / 逐日预报、趋势、单位切换、PWA 离线缓存", "Open-Meteo；Redis；Workbox"],
    ["方案任务", "上传种植方案 → AI 抽取任务 → 确认 → 到期提醒 → 完成/跳过 → 农事记录", "JSON 抽取 + 人工确认；定时提醒"],
    ["社区", "富文本发帖、图片上传、评论与点赞；服务端白名单净化", "Quill；jsoup；MySQL 图片托管"],
    ["MCP 服务", "把地块、天气、建议、作物与写操作封装为标准 MCP 工具", "stdio；confirm 二次确认；JSONL 审计"],
], [2.4 * cm, 8.4 * cm, FRAME_W - 10.8 * cm], "功能模块概览")
story += FIG(SHOT, 15.6 * cm, "桌面驾驶舱：左侧导航、中部天气与地块、右侧常驻助农手")

story.append(H2("1.4  项目概况与团队"))
story += T([
    ["项目", "内容"],
    ["代码仓库", "github.com/znegjiachen/agri-weather（Public）"],
    ["在线演示", "http://47.96.25.53（HTTP 演示环境；语音、PWA 安装、Web Push 需 HTTPS）"],
    ["开发周期", "2026-10-09 至 2026-11-07，119 次提交，保留完整迭代历史"],
    ["运行形态", "Web + PWA；桌面驾驶舱与移动端两套布局"],
    ["外部依赖", "Open-Meteo（天气，免费无密钥）、DeepSeek（对话与视觉）、可选 Embedding / ASR / 和风天气"],
], [2.8 * cm, FRAME_W - 2.8 * cm], "项目基本信息")
story.append(P("团队由三名数据科学与大数据技术专业学生组成，按后端与 AI、前端与交互、数据与算法分工，共同参与需求分析、联调、测试验收与答辩准备。"))
story += T([
    ["成员", "角色", "主要分工"],
    ["曾嘉晨", "项目负责人 / 后端与 AI", "后端架构、Spring Boot 接口、Agent 工具链、RAG、数据库设计与服务器部署"],
    ["贺宇豪", "前端与交互", "React 页面与组件、桌面驾驶舱、地块地图、PWA、语音/文档交互与响应式适配"],
    ["魏敬轩", "数据与算法", "作物与病虫害数据整理、播种适配算法、检索评测、测试与数据校验"],
], [2.3 * cm, 4.0 * cm, FRAME_W - 6.3 * cm], "团队分工")

# =====================================================================
# 2 需求分析
# =====================================================================
story.append(CondPageBreak(7 * cm))
story += H1("2  需求分析")

story.append(H2("2.1  用户角色与典型场景"))
story += T([
    ["角色", "核心诉求", "使用方式"],
    ["小农户", "“我这块地今天/明天能不能打药、施肥、防冻”；不想学复杂软件", "手机 PWA、语音提问、拍照识病、接收预警推送"],
    ["合作社 / 种植大户", "多地块管理、生育期跟踪、方案任务落地、作业记录与完成率", "桌面驾驶舱、地块地图、方案任务、智能体控制台"],
    ["基层农技员", "快速查作物参数、病虫害知识、验证建议依据；对外解释数据来源", "作物库、知识库、检索测试、数据来源与置信度"],
    ["平台运维者", "部署、迁移、限流、额度、故障降级、AI 质量与成本观测", "Docker / systemd、健康检查、AI 指标、日志"],
], [2.6 * cm, 8.6 * cm, FRAME_W - 11.2 * cm], "用户角色与核心诉求")

story.append(H2("2.2  典型业务场景"))
story.append(B("<b>打药窗口判断：</b>用户问“明天适合打药吗”。系统需要先定位地块，查询真实风速、降水与温度，再结合作物生育期和平台规则给出“不适合 / 建议改到某天上午”，并说明风速、降水数值。"))
story.append(B("<b>低温防冻：</b>未来 24 小时最低气温低于作物敏感阈值时，生成冻害预警，给出覆盖薄膜、熏烟增温等建议；用户可在站内查看，也可收到 Web Push。"))
story.append(B("<b>播种适配：</b>用户录入作物与计划播期，系统比较播期前后温度与作物适宜区间，给出匹配度和当前天气风险，而不是只给一张“适宜播种期表”。"))
story.append(B("<b>病虫害识别：</b>用户拍摄叶片照片，视觉模型识别植物、生育期、健康状态与可见病虫害；文本智能体再结合地块天气和知识库给出防治方向，低置信度时明确建议补拍。"))
story.append(B("<b>方案落地：</b>用户上传种植方案，AI 抽取农事任务，用户确认后入库；到期前推送提醒，完成后自动生成农事记录，并统计完成率、按时率与延误天数。"))

story.append(H2("2.3  功能需求"))
story += T([
    ["编号", "需求", "验收要点", "优先级"],
    ["FR-01", "账号与权限", "注册登录、JWT、刷新轮换、退出全部设备、注销账号；用户数据隔离", "高"],
    ["FR-02", "地块管理", "增删改查、作物与播期、地图边界与亩数、种植季历史", "高"],
    ["FR-03", "天气服务", "实时 + 逐小时 + 7 日；缓存与备源；异常可解释", "高"],
    ["FR-04", "作物与播种适配", "64 种作物、生育期推算、播期匹配、来源与置信度", "高"],
    ["FR-05", "灾害预警", "多类风险、分级、去重、未读、后台巡检", "高"],
    ["FR-06", "AI 助农手", "多轮对话、工具调用、地块范围、轨迹可视化、流式输出", "高"],
    ["FR-07", "知识库与 RAG", "文档上传、切块、检索、引用；每智能体独立", "中高"],
    ["FR-08", "多模态与语音", "最多 3 张照片识别；语音转写或浏览器回退", "中"],
    ["FR-09", "方案任务闭环", "抽取、确认、提醒、完成/跳过、记录与统计", "中"],
    ["FR-10", "社区与 MCP", "富文本净化、图片托管；标准 MCP 工具与审计", "中"],
], [1.5 * cm, 3.0 * cm, FRAME_W - 5.5 * cm, 1.2 * cm], "功能需求清单")

story.append(H2("2.4  非功能需求"))
story += T([
    ["维度", "要求", "实现方式"],
    ["性能", "常规接口 P95 低于 1s；AI 对话平均 15s 内可接受", "Redis 缓存、天气预取、SSE 流式、知识库内存打分"],
    ["可用性", "上游天气或 Redis 故障时不整体不可用", "双源降级、STALE 缓存、Redis 失败直连、限流 fail-open"],
    ["安全", "越权、注入、XSS、暴力登录、AI 滥用可控", "JWT + 归属校验、参数化查询、jsoup 白名单、限流与额度"],
    ["隐私", "手机号/身份证号不外泄；用户可删除数据", "输出脱敏、账号注销、文档 TTL、日志不记录密钥"],
    ["可维护", "结构变更可追溯；AI 行为可回归", "Flyway 迁移、单元/集成测试、评测集与脚本、CI"],
    ["兼容", "桌面与移动端；弱网可用", "响应式布局、PWA、Workbox 缓存、HTTP 明确降级"],
    ["成本", "AI 调用可控，不能无限刷", "每用户每日额度、每分钟限流、温度与 token 上限、历史裁剪"],
], [2.0 * cm, 6.7 * cm, FRAME_W - 8.7 * cm], "非功能需求")

story.append(H2("2.5  关键约束与设计取舍"))
story += T([
    ["约束", "影响", "设计取舍"],
    ["天气源免费且有频率限制", "不能每个请求都回源", "按经纬度网格缓存 30 分钟；20 分钟预取；失败用旧数据兜底"],
    ["大模型会幻觉，农学阈值不能猜", "不能让模型自由生成“能不能打药”", "规则引擎算结论，模型只负责选工具、组织语言与解释"],
    ["农村网络与手机性能有限", "页面重、离线不可用会流失用户", "路由级拆包、PWA 缓存、图片压缩、移动端独立布局"],
    ["AI 延迟与成本高于普通接口", "体验与账单压力", "SSE 流式、6 轮上限、结果摘要、历史裁剪、每日额度"],
    ["没有自建 GIS / 气象站", "无法提供地块级实测与小气候", "卫星底图圈地 + 公开网格预报；文案明确“以实地观测为准”"],
    ["团队规模小、周期短", "不能堆砌复杂中间件", "单体分层 + 两个无状态实例；自研轻量 Agent 框架，减少依赖"],
], [4.0 * cm, 5.0 * cm, FRAME_W - 9.0 * cm], "关键约束与设计取舍")

story.append(H2("2.6  需求实现映射"))
story.append(P("上述需求在代码中均有明确落点：地块与种植季对应 FarmlandController / FarmlandRecordController；天气与预警对应 WeatherClient、FarmlandWeatherService、AlertService；作物与播种对应 CropService；AI 能力对应 agent 包（循环与工具协议）与 ai 包（DeepSeek 适配、工具实现、安全兜底）；方案任务对应 FarmlandTaskController、PlanTaskExtractionService、FarmTaskReminderScheduler；社区对应 CommunityService 与图片处理链路。第 5 章按用户可见功能逐项说明。"))

story.append(H2("2.7  迭代批次与交付边界"))
story.append(P("项目按“先跑通、再增强、后闭环、最后工程化”的批次推进，每个批次都保留可演示、可回退的完整链路，避免一次性堆叠功能导致无法验收。"))
story += T([
    ["批次", "交付重点", "验收标志"],
    ["A 核心可用", "认证、地块、天气、作物、预警、基础驾驶舱", "能录入地块并看到实时天气、7 日预报与预警"],
    ["B AI 增强", "Agent 循环、9 个工具、SSE 轨迹、RAG、多模态、语音", "能回答需要地块数据的问题，且工具轨迹可见"],
    ["C 闭环与工程化", "任务、记录、推送、社区、CI、部署、MCP", "方案到记录闭环；全新环境可重复部署"],
], [2.3 * cm, 8.6 * cm, FRAME_W - 10.9 * cm], "迭代批次与交付边界")

# =====================================================================
# 3 系统架构设计
# =====================================================================
story.append(CondPageBreak(7 * cm))
story += H1("3  系统架构设计")

story.append(H2("3.1  总体架构"))
story.append(P("系统采用分层架构：接入层负责静态资源、反向代理与 SSE 透传；前端层是 React 单页应用与 PWA；应用服务层承载认证、地块、天气、作物、预警、任务、社区等业务；智能体层独立封装工具调用循环、RAG、多模态与安全兜底；数据层由 MySQL、Redis 与 Flyway 组成；外部服务通过配置接入，可替换、可降级。"))
story += FIG(os.path.join(ASSETS, "fig1-architecture.png"), 16.2 * cm,
             "问田系统总体架构：业务能力与智能体能力分层，外部依赖可替换")
story.append(P("分层的直接收益是“换模型不改业务、换天气源不改前端”。DeepSeek 通过 OpenAI 兼容协议接入，基座模型可用 base-url 与 model 切换；天气源抽象为 WeatherClient，主源失败自动切备源；Embedding 未配置时回退本地向量，ASR 未配置时回退浏览器识别。任何单一外部服务都不是系统的单点。"))

story.append(H2("3.2  技术选型"))
story += T([
    ["层次", "选型", "选择理由", "代价 / 应对"],
    ["后端", "Spring Boot 3.5.2 / Java 17", "成熟生态、Security/JPA/Validation 开箱即用；团队熟悉；长期维护性好", "启动与内存开销高于轻量框架；用多阶段镜像与两实例控制"],
    ["前端", "React 19 + Vite 8 + TypeScript", "组件化与生态成熟；Vite 构建快；TS 提升可维护性", "类型迁移有成本；已全量 strict 并通过 CI"],
    ["数据库", "MySQL 8 + Spring Data JPA", "关系模型适合地块、作物、任务等强关联数据；运维简单", "复杂空间计算能力有限；亩数用应用层几何计算"],
    ["缓存 / 协调", "Redis 7", "天气缓存跨实例共享；限流、额度、预取锁统一", "不可用时需降级；所有缓存访问失败均回退直连或放行"],
    ["迁移", "Flyway", "结构变更版本化，CI 可验证全新库初始化与迁移链", "历史脚本不可回改；用 schema.sql 作为全新库基线"],
    ["前端地图", "Leaflet", "轻量、无需商业密钥；卫星底图与多边形编辑够用", "不提供专业 GIS 分析；亩数按边界点自算"],
    ["PWA", "Vite PWA / Workbox", "离线缓存、安装、Web Push 一套完成", "缓存策略需处理鉴权隔离；用 token 指纹参与缓存键"],
    ["天气", "Open-Meteo（主）/ 和风（备）", "免费无密钥、字段完整；备源提升国内可用性", "有频率限制；缓存 + 预取 + 降级"],
    ["AI", "DeepSeek（OpenAI 兼容）", "工具调用与 reasoning_content 满足轨迹展示；中文与国内访问友好；可替换", "推理延迟较高；SSE、超时与轮数上限控制"],
], [2.1 * cm, 4.2 * cm, 6.3 * cm, FRAME_W - 12.6 * cm], "核心技术选型")

story.append(H2("3.3  后端模块划分"))
story += T([
    ["包 / 模块", "职责", "关键类"],
    ["agent", "领域无关的智能体框架：循环、工具协议、注册表、观察者、取消", "AgentHarness、Tool、ToolRegistry、AgentObserver"],
    ["ai", "应用层 AI 适配：DeepSeek、视觉、ASR、Embedding、提示词、安全兜底、Spring 装配", "DeepSeekClient、VisionClient、AgriAgentPrompts、AgriSafetyGuard"],
    ["ai.tool", "9 个农事工具实现与地块归属校验", "GetWeatherTool、SearchPestTool、FarmlandAccessGuard"],
    ["controller", "REST / SSE / multipart 接口与统一异常处理", "AgentController、FarmlandController、AuthController"],
    ["service", "业务服务：天气、作物、预警、知识库、任务、社区、指标", "FarmlandWeatherService、CropService、KnowledgeRetrievalService"],
    ["repository / entity / dto", "JPA 持久化、领域实体与传输对象", "23 张表对应实体；DTO 隔离接口与实体"],
    ["config / utils / push / weather", "安全、JWT、限流、Web Push、天气客户端与几何工具", "SecurityConfig、RateLimitFilter、WebPushService、WeatherClient"],
], [3.7 * cm, 7.6 * cm, FRAME_W - 11.3 * cm], "后端模块划分")

story.append(H2("3.4  数据模型设计"))
story.append(P("数据库共 23 张表，围绕“用户—地块—智能体—知识/对话”与“作物—生育期—预警/农事/任务”两条主线组织。地块是权限与业务的最小单元：每个地块属于一个用户，并自动对应一个 farmland_agent；智能体的知识文档、片段与对话消息都带 agent_id；涉及地块的工具在服务端再次校验 userId 与 agent 范围，避免仅靠前端约束。"))
story += T([
    ["数据域", "主要表", "设计要点"],
    ["账号", "sys_user", "BCrypt 密码；token_version 支持“退出全部设备”立即失效"],
    ["地块与种植", "farmland、farmland_season、farm_operation", "地块绑定作物与播期；季节保留换茬历史；农事记录独立留存"],
    ["作物与知识", "crop_info、crop_growth_stage、pest_knowledge、solar_term_guide", "作物含 data_source / confidence；阶段按天数累计推算"],
    ["预警", "weather_alert", "按地块、类型、日期去重；级别与已读状态可追踪"],
    ["智能体", "farmland_agent、agent_knowledge_doc、agent_knowledge_chunk、agent_chat_message", "一地块一智能体；知识只存提取文本；片段保留向量与模型名"],
    ["对话文档", "agent_document、agent_document_chunk", "对话内附件独立索引，7 天 TTL，不进入长期知识库"],
    ["任务与反馈", "farm_plan_task、agent_feedback、push_subscription", "任务状态与提醒；反馈按消息去重；订阅失效自动清理"],
    ["社区", "community_post、comment、like、image", "富文本白名单净化后入库；图片存 MySQL 并由后端出图"],
], [2.6 * cm, 7.0 * cm, FRAME_W - 9.6 * cm], "数据表分组与设计要点")
story.append(P("结构变更统一由 Flyway 管理：全新库通过 schema.sql + seed-current.sql 初始化到基线，后续以 V11+ 增量迁移；CI 使用全新 MySQL 实例执行初始化、启动后端、校验 flyway_schema_history 与 Hibernate ddl-auto=validate，并断言作物数据不少于 60 条、来源与置信度字段非空。"))

story.append(H2("3.5  关键链路设计"))
story.append(H3("3.5.1  天气获取与两级缓存"))
story.append(P("天气是高频只读数据，也是外部依赖中最容易抖动的一环。系统把经纬度按 3 位小数网格化（约 110 米）后作为缓存键，只缓存“天气本身”，不混入地块名、作物名等用户相关字段，避免不同用户共享缓存时串数据。"))
story.append(B("<b>HIT：</b>30 分钟内直接返回缓存，不回源；<b>MISS：</b>超过新鲜期回源并刷新；<b>STALE：</b>回源失败但仍有未过期的旧数据时返回旧值；<b>BYPASS：</b>缓存层不可用时直连上游，接口照常可用。"))
story.append(B("<b>预取：</b>每 20 分钟对已知地块坐标做一次强制刷新，最多 200 个坐标，间隔 250ms，减少用户请求时的冷启动；多实例通过 Redis 锁保证同一轮只有一个实例执行。"))
story.append(B("<b>双源：</b>Open-Meteo 为主源，配置和风天气 Key 后作为备源；两者都失败且有旧缓存时返回 STALE，否则返回 503 与可读错误。"))
story.append(H3("3.5.2  预警生成与推送"))
story.append(P("预警不是“当前温度低于阈值”这么简单。系统取未来 24 小时（今天与明天）的预报极值：最低温、最高温、累计降水、最大风速，再叠加作物敏感标记与当前生育期的适宜温湿度，生成冻害、热害、涝害、大风与阶段温度异常等提示。"))
story.append(B("<b>巡检：</b>后台默认每 30 分钟检查一次，启动后延迟 2 分钟首跑；多实例用 Redis 锁互斥。"))
story.append(B("<b>去重：</b>同一地块、同一类型、同一天只保留一条；条件变化时刷新级别并重新标为未读，避免重复轰炸。"))
story.append(B("<b>推送：</b>预警入库后异步发送 Web Push；404/410 视为订阅失效并删除；发送失败不影响入库与站内展示。"))
story.append(H3("3.5.3  认证、权限与配额"))
story.append(P("系统采用无状态 JWT：access token 默认 2 小时，refresh token 30 天并轮换；用户表保存 token_version，退出全部设备或修改关键安全信息后版本递增，旧 token 立即失效。接口层不依赖 session，便于 Nginx 轮询两个后端实例。"))
story.append(B("<b>密码与传输：</b>BCrypt 存储；CORS 白名单由环境变量配置；生产密钥全部从环境变量注入，禁止写入 application.yml。"))
story.append(B("<b>限流：</b>登录/注册、智能体对话、上传分别按用户或 IP 每分钟限流，默认 20 / 10 / 6 次；每用户每日 AI 对话额度默认 80 次，0 表示不限制。"))
story.append(B("<b>降级：</b>Redis 不可用时，限流与额度自动放行而不是拒绝服务；限流过滤器位于 JWT 之后，优先按 userId 计数，避免 NAT 下误伤。"))

story.append(H2("3.6  架构质量属性"))
story += T([
    ["属性", "设计手段", "验证方式"],
    ["可用性", "双源天气、STALE 缓存、Redis fail-open、无状态多实例、健康检查", "容器 healthcheck；CI 启动探活；故障注入手测"],
    ["可扩展性", "分层解耦；工具 SPI 新增工具零改框架；外部服务配置化", "新增工具仅实现 Tool 接口并注册为 Bean"],
    ["安全性", "JWT + 版本号、工具层归属校验、参数化查询、HTML 净化、限流与额度", "集成测试覆盖越权；安全用例；代码审查"],
    ["可观测性", "AI 指标、天气缓存指标、推送指标、结构化日志、健康端点", "/api/agent/metrics；日志按实例区分"],
    ["可维护性", "Flyway、DTO 隔离、统一异常、严格 TS、CI", "mvn test；typecheck:strict；lint；e2e"],
], [2.2 * cm, 8.9 * cm, FRAME_W - 11.1 * cm], "架构质量属性与验证")

# =====================================================================
# 4 AI 技术方案
# =====================================================================
story.append(CondPageBreak(7 * cm))
story += H1("4  AI 技术方案")
story.append(P("本章回答三个问题：为什么这样选型、AI 如何接入现有业务、做了哪些优化。核心判断是：AI 在系统中的角色不是“替代农技员”，而是把分散的数据与规则组织成一次可执行、可解释的对话。因此方案的重点是工具、上下文、权限与评测，而不是追求参数最大的基座模型。"))

story.append(H2("4.1  设计原则"))
story.append(B("<b>先判断是否需要工具：</b>只有涉及地块数据、天气、生育期、预警、任务等问题才调用工具；能力介绍、平台用法、闲聊直接回答，避免无意义的工具开销。"))
story.append(B("<b>农学结论走确定性规则：</b>“能不能打药”“是否冻害”由 OperationAdvisor、AlertService 等规则引擎计算；模型负责选择工具、解释原因、组织语言，不能自行编造阈值。"))
story.append(B("<b>没有数据就不编：</b>工具返回错误或数据缺失时如实说明；跨地块查询被工具层拒绝，模型只能转告用户切换地块。"))
story.append(B("<b>可解释、可回归：</b>每轮工具名、参数、结果摘要、耗时都可见；评测集与脚本可重复执行，避免“演示一次成功”式验证。"))

story.append(H2("4.2  技术选型理由"))
story.append(H3("4.2.1  对话模型：DeepSeek reasoner"))
story += T([
    ["候选", "优势", "不足 / 本项目考虑", "结论"],
    ["DeepSeek reasoner", "工具调用稳定；返回 reasoning_content 可展示思考轨迹；中文与国内访问友好；OpenAI 兼容，改造成本低", "推理延迟高于普通对话；思考 token 计入上限", "默认选型"],
    ["deepseek-chat", "更快、更便宜，适合简单问答", "缺少可展示的推理内容，复杂工具链稳定性略弱", "通过配置可切换"],
    ["Qwen / GLM 等国产模型", "OpenAI 兼容；中文能力强；可作对照", "选型时点工具调用与轨迹格式需逐项验证", "作为对照与备选"],
    ["GPT / Claude 等海外模型", "综合能力强，生态成熟", "国内部署的网络、成本与合规成本较高", "不作为默认"],
    ["自部署 7B–32B", "数据可控、可离线", "GPU 运维成本高；小模型工具调用稳定性不足", "后续评估"],
], [3.4 * cm, 6.0 * cm, 5.2 * cm, FRAME_W - 14.6 * cm], "对话模型选型对比")
story.append(P("选型的关键不是“谁的通用能力更强”，而是“谁能在可接受的延迟与成本下稳定完成工具调用，并把推理过程暴露出来”。reasoner 返回的 reasoning_content 只用于前端展示，不回传给上游，既满足可解释性，也不污染后续上下文。模型通过 base-url、model、temperature 等配置切换，系统能力不绑定某一家厂商。"))

story.append(H3("4.2.2  视觉、语音与向量模型"))
story.append(B("<b>视觉：</b>与文本智能体解耦，单独调用 OpenAI 兼容的多模态接口，输出固定 JSON（植物名、学名、生育期、健康状态、问题列表、置信度、照护建议）。温度固定 0.1，减少发散；默认复用 DeepSeek Key，也可用 VISION_API_KEY / VISION_MODEL 独立配置。识别结果只作为文本上下文，不直接决定农事结论。"))
story.append(B("<b>语音：</b>OpenAI 兼容 /audio/transcriptions，支持 Whisper 或 SenseVoice 等模型；未配置时前端回退浏览器语音识别（Chrome / Edge），两者都不可用时给出明确提示，而不是静默失败。"))
story.append(B("<b>向量：</b>优先使用外部 OpenAI 兼容 Embedding（如 BGE-M3），未配置时回退本地 384 维字词哈希向量。本地向量不追求语义精度，但保证知识库链路在无外部服务时仍可工作；两种向量用 embedding_model 字段区分，切换模型后旧向量会被忽略，需重建索引。"))

story.append(H3("4.2.3  为什么自研轻量 Agent 框架"))
story.append(P("项目没有引入 LangChain / LlamaIndex 等编排框架，而是在 agent 包内实现了约十余个类的轻量框架。原因有三：一是业务需要精确控制工具权限、轮数收敛、取消与 SSE 事件，黑盒编排难以逐项验证；二是框架不依赖 Spring，可在纯 Java 单元测试中直接 new，测试不消耗真实 API；三是依赖少、行为可读，答辩与运维时能解释清楚每一步。代价是需要自己维护协议解析与流式分片，但这部分恰好是项目最需要掌控的部分。"))

story.append(H2("4.3  集成方式"))
story.append(H3("4.3.1  工具调用循环"))
story.append(P("AgentHarness 是整个 AI 能力的核心。它不感知“地块”“打药”等业务概念，只负责：把 system prompt、历史消息与用户问题组装成消息列表；把 ToolRegistry 提供的工具描述交给模型；解析模型返回的 tool_calls；执行工具并把结果作为 tool 消息回喂；直到模型不再调用工具或达到轮数上限。"))
story += FIG(os.path.join(ASSETS, "fig2-agent-loop.png"), 16.2 * cm,
             "智能体工具调用循环：模型决策、工具执行、结果回喂与收敛保护")
story.append(P("循环之外还有一层保护：如果 6 轮后模型仍在调用工具，系统会追加一条“基于已有信息直接回答、不要再调用工具”的指令，并在响应中标记 truncated。这样即使模型陷入反复查询，也能给用户一个可读的结果，而不是超时或空响应。"))
story.append(H3("4.3.2  工具系统"))
story.append(P("工具通过 Tool 接口暴露名称、描述、参数 schema 与执行逻辑；ToolRegistry 统一包装为 OpenAI 协议格式，并把任何执行异常转成 JSON 错误回喂模型，而不是中断整个对话。每个涉及地块的工具都必须先经过 FarmlandAccessGuard：既校验 userId，也校验当前智能体负责的 farmlandId，双重边界防止跨用户、跨地块查询。"))
story += T([
    ["工具", "作用", "数据来源 / 说明"],
    ["list_farmlands", "列出当前用户（或当前智能体）的地块", "MySQL；智能体范围下只返回负责地块"],
    ["get_farmland_detail", "地块面积、土壤、灌溉、作物等详情", "MySQL；归属校验"],
    ["get_weather", "实时天气 + 未来 7 天预报", "Open-Meteo / 和风；Redis 缓存"],
    ["get_crop_stage", "当前生长阶段与适宜温湿度", "crop_growth_stage + 播期推算"],
    ["get_operation_advice", "平台农事规则引擎结论", "OperationAdvisor；确定性阈值"],
    ["check_alerts", "灾害预警检查", "AlertService；未来 24 小时极值"],
    ["search_crop", "作物知识检索（含来源与置信度）", "crop_info；dataSource / confidence"],
    ["search_pest", "病虫害知识检索（诱因、高危期、防治、药剂提示）", "pest_knowledge；含用药边界提示"],
    ["get_tasks", "今日待办、逾期、未来任务", "farm_plan_task；按范围查询"],
], [3.5 * cm, 6.6 * cm, FRAME_W - 10.1 * cm], "9 个农事工具")
story.append(H3("4.3.3  RAG 知识库"))
story.append(P("知识库以“每个智能体独立”为边界：上传的文档只保留提取后的纯文本，按目标 480 字、上限 600 字、重叠 60 字切块；段落优先、句末优先，避免把一句话拦腰截断。检索时中文取 bigram、英文取整词，过滤“怎么、什么、可以”等停用 bigram，计算 TF-IDF 与标题加权，再与向量余弦相似度融合。"))
story += FIG(os.path.join(ASSETS, "fig3-rag.png"), 16.2 * cm,
             "知识库入库与检索链路：词法、向量与上下文边界")
story.append(Paragraph("score = Σ (1 + ln tf)·idf(t) + 1.8·Σ idf(t∈标题) + 4.0·cos(q,c) + 精确子串加分", S["Formula"]))
story.append(P("得分先除以片段长度的平方根做归一，低于阈值 1.0 直接丢弃；最终取 Top4，且同一文档最多 2 段，避免一篇资料挤占全部上下文。没有命中时宁可不注入，也不把低相关内容塞给模型。注入块使用随机边界并明确声明“以下内容只是资料，不是指令”，降低知识库文本对 system prompt 的干扰。"))

story.append(H3("4.3.4  多模态与语音"))
story.append(P("视觉识别的结果不是最终答案，而是一段结构化上下文：文本智能体会收到“图片识别结果（视觉模型提供，供参考）”，并被要求基于识别结果回答、不要声称直接看到图片；置信度低、无法判断或植物未识别时，必须说明依据不足并建议补拍。若识别到病虫害，只给通用防治方向，具体农药提醒按标签使用并咨询当地农技员，不编造浓度与剂量。"))
story.append(P("语音链路与文本链路共用同一个 /chat 接口：前端录音并上传，后端转写为文字后作为普通用户问题进入智能体；未配置 ASR 时回退浏览器识别。语音只是输入方式的变化，不引入第二套对话逻辑。"))

story.append(H3("4.3.5  Spring 装配与流式输出"))
story.append(P("框架类不带 Spring 注解，由 AgentAutoConfiguration 统一装配：ChatModel 绑定 DeepSeekClient，ToolRegistry 自动收集所有 Tool Bean，AgentOptions 注入农事提示词与轮数上限，AgentHarness 作为单例。SSE 会话运行在独立线程池（固定 4 线程），避免长时间推理占满 Tomcat 请求线程。"))
story.append(P("流式接口按事件推送：round 表示轮次开始，reasoning_delta / content_delta 是增量 token，thought 是该轮完整思考，tool_start / tool_end 携带工具名、参数、结果摘要与耗时，done 返回最终回答与轨迹，error 返回可读错误。前端用 fetch + ReadableStream 读取（EventSource 不支持 POST 与 Authorization），Nginx 对 /api/agent/ 关闭 proxy_buffering，否则事件会被攒到最后一次性返回。"))

story.append(H2("4.4  优化策略"))
story.append(H3("4.4.1  上下文与成本控制"))
story.append(B("历史消息最多 20 条、总字符 12k，保留最近部分；role 只接受 user / assistant，防止前端注入 system。"))
story.append(B("工具结果在轨迹中只保留 300 字摘要；知识块上限 2400 字、Top4；文档问答最多同时引用 3 份。"))
story.append(B("单次对话最多 6 轮工具调用，temperature 0.3，max_tokens 4096；避免无限追问与超长输出。"))
story.append(B("每用户每日 80 次对话额度、每分钟 10 次限流；额度与限流在 Redis 不可用时放行，优先保证可用性。"))
story.append(H3("4.4.2  稳定性与延迟"))
story.append(B("SSE 边生成边展示，首字节明显早于完整回答；Nginx 读超时 180s、Spring 异步超时 200s、模型超时 120s，分层兜底。"))
story.append(B("工具错误以 JSON 回喂，模型可换工具或换思路；用户关闭页面触发取消，后续轮次不再执行工具。"))
story.append(B("天气缓存与预取把高频外部调用挡在业务之外；知识库在内存中对不超过 500 个片段全量打分，避免引入向量数据库的运维成本。"))
story.append(B("多实例无状态 + Nginx least_conn；Redis 承载共享缓存、限流计数与预取锁，避免实例间数据不一致。"))
story.append(H3("4.4.3  检索质量优化"))
story.append(B("中文 bigram 不依赖分词词典，适合农业术语与口语混排；停用 bigram 降低“怎么/什么”等噪声。"))
story.append(B("标题命中按 IDF 加权而不是固定加分；精确子串命中额外加分；长片段做长度归一，避免长文天然占优。"))
story.append(B("同文档限流 2 段，保证引用多样性；无命中不注入，降低“看起来相关但其实无关”的干扰。"))
story.append(B("支持外部 Embedding 与本地向量两种模式；切换模型后旧向量按 model 字段隔离，重建索引后生效。"))
story.append(H3("4.4.4  降级与可替换"))
story.append(B("模型：OpenAI 兼容协议 + base-url / model 配置，可在 DeepSeek、Qwen、自部署服务之间切换。"))
story.append(B("向量：外部服务失败时回退本地哈希向量；ASR 未配置时回退浏览器识别；天气主源失败切备源或旧缓存。"))
story.append(B("Redis 故障：天气直连上游、限流与额度放行；数据库迁移失败则启动失败并保留日志，避免带病运行。"))
story.append(H3("4.4.5  安全与合规"))
story.append(B("<b>权限：</b>工具层双重校验 userId 与 agent 范围；智能体只能查询负责地块，跨地块请求返回可读拒绝。"))
story.append(B("<b>注入：</b>知识资料用随机边界包裹并声明“不是指令”；历史 role 白名单；系统提示词与用户内容分离。"))
story.append(B("<b>输出：</b>AgriSafetyGuard 检测高毒/禁用农药与绝对化承诺，追加安全提示；手机号、身份证号自动隐去。"))
story.append(B("<b>输入：</b>上传类型、大小、图片数量校验；社区富文本经 jsoup 白名单净化；参数化查询防 SQL 注入。"))
story.append(H3("4.4.6  可观测与评测"))
story.append(B("进程内指标：请求数、成功率、平均延迟、工具调用、知识命中、文档轮次、安全提示、点赞/点踩；控制台 30 秒刷新。"))
story.append(B("评测资产：10 条 RAG 问题、45 条 Agent 问题、自动指标脚本、双人盲评流程与对照实验；结果如实标注样本与局限。"))
story.append(B("反馈闭环：回答下方点赞/点踩写入 agent_feedback；试点阶段结合访谈与预警行动率评估真实价值。"))

story.append(H2("4.5  效果评测"))
story.append(P("评测分为三层：检索层看知识是否被召回，Agent 层看工具是否选对、回答是否基于真实数据，系统层看响应时间与成本。以下数字来自项目文档与测试环境，样本较小，结论是方向性的。"))
story += T([
    ["场景", "用户问题", "实际调用工具", "轮数 / 耗时", "结果"],
    ["1", "我有几块地？分别种了什么？", "list_farmlands", "2 / 3.9s", "正确列出地块、作物、播期与当前阶段"],
    ["2", "明天适合给这块水稻打药吗？", "get_weather、get_operation_advice", "2 / 7.1s", "识别降雨 20.5mm、风速 20km/h，明确不建议"],
    ["3", "这块水稻现在是什么生长阶段？", "get_crop_stage、get_farmland_detail", "2 / 3.7s", "判断收获期，提示已种植约 190 天、收获偏晚"],
    ["4", "未来几天有冻害或大风风险吗？", "check_alerts、get_weather、get_operation_advice", "3 / 11.7s", "发现低温与霜冻预警，结合收获期解释影响"],
    ["5", "水稻稻瘟病怎么防治？", "get_weather、get_crop_stage、get_operation_advice、check_alerts", "2 / 14.1s", "先判断防治窗口已过，不建议此时打药"],
], [1.1 * cm, 4.5 * cm, 5.2 * cm, 2.4 * cm, FRAME_W - 13.2 * cm], "Agent 模拟评测（5 个场景）")
story.append(P("5 个场景均正确调用了相关工具，没有出现编造天气或跨地块数据；这只是链路跑通，不代表统计效果。仓库另有 45 题扩展集、工具选择准确率、P95 耗时与 5 分制盲评流程，脚本已 dry-run 通过，正式结果需在部署环境用登录令牌执行。"))
story += T([
    ["评测项", "设置", "结果", "说明"],
    ["RAG 检索", "10 条水稻问题、8 份资料（PDF/Word/TXT/MD）", "hit@5 = 10/10", "宽松口径：Top5 含任一期望关键词，不等于答案正确率"],
    ["方案对照", "同一地块、同一组问题；A=问田 Agent，B=同模型裸答，C=Qwen 裸答", "需地块数据的 4 题：A 4/4，B/C 0/4", "B/C 均要求用户补充地点、天气、播期；未编造数据"],
    ["响应耗时", "单次运行平均值", "A ≈ 8.1s；B ≈ 4.6s；C ≈ 7.5s", "Agent 的工具调用与上下文带来额外延迟，属预期成本"],
], [2.3 * cm, 6.4 * cm, 4.7 * cm, FRAME_W - 13.4 * cm], "检索、对照实验与耗时")
story.append(P("对照实验的结论不是“基座模型更强”，而是“系统层把模型接到了真实数据与工具上”。同一个 DeepSeek 模型不接工具时，只能让用户自己提供天气和播期；接入工具后，能直接回答“明天不适合打药，因为降雨 20.5mm、风速 20km/h，而且已到收获期”。"))

story.append(H2("4.6  当前局限"))
story.append(B("评测样本小：RAG 10 题、Agent 5 题、对照实验单次运行，未做统计显著性检验，也未开展真实农户长期试点。"))
story.append(B("没有田间产量、农药减量等效果数据；“有效”目前指回答可用、工具链正确，不等于增产。"))
story.append(B("天气是网格预报，不是地块小气候；山区、河谷、大棚内可能存在偏差，阈值判断必须保留“以实地观测为准”。"))
story.append(B("作物与病虫害知识覆盖有限，部分参数为团队整理，置信度标为 MEDIUM / LOW，不能替代当地植保站诊断。"))
story.append(B("Agent 延迟与 token 成本高于裸答；复杂问题可能触发 6 轮上限，回答被标记为不完整。"))

# =====================================================================
# 5 核心功能实现
# =====================================================================
story.append(CondPageBreak(7 * cm))
story += H1("5  核心功能实现")
story.append(P("本章按用户可见功能说明实现路径，重点写“数据从哪里来、边界在哪里、异常怎么处理”，不逐行罗列代码。"))

story.append(H2("5.1  地块管理与地图圈地"))
story.append(P("地块是系统的最小业务单元，包含名称、经纬度、面积、土壤、灌溉方式、作物与播期。前端使用 Leaflet 加载卫星底图，用户依次点击边界点围成多边形，系统自动计算亩数并保存边界数组；也可使用浏览器定位。地块创建后自动生成专属助农手，作物或面积变化时只刷新未自定义的人设，用户改过的人设不会被覆盖。删除地块时，应用层按顺序清理预警、农事记录、任务、种植季与智能体数据，避免外键约束导致 500。"))
story.append(H2("5.2  天气服务与展示"))
story.append(P("天气接口按经纬度返回实时、逐小时与 7 日数据，前端提供趋势图、单位切换与天气详情；响应头携带缓存状态（HIT / MISS / STALE / BYPASS），便于排查。移动端采用独立布局，弱网下由 Workbox 对 GET 接口做 NetworkFirst 缓存（3 秒超时），并对 Open-Meteo 资源做 StaleWhileRevalidate。PWA 采用 prompt 更新而不是自动刷新，避免打断正在进行的对话或发帖。"))
story.append(H2("5.3  作物与播种适配"))
story.append(P("作物库覆盖 64 种常见作物，记录适宜播种温度、生长周期、各阶段天数、适宜温湿度、降水与光照需求，以及霜冻、高温、涝害敏感标记。播种适配不是简单查表：系统把计划播期前后的温度与作物适宜区间比较，结合 FAO EcoCrop 的四断点响应思路给出匹配度，并在返回体中写明方法与数据说明。作物接口与 search_crop 工具都会返回 data_source 与 confidence，避免把团队整理数据说成国家标准。"))
story.append(H2("5.4  预警中心"))
story.append(P("预警中心按地块展示未读与历史预警，支持单条已读与全部已读；移动端首页有入口与未读角标。后台巡检与手动检查共用同一套规则：冻害看未来 24 小时最低温与作物敏感标记，热害看最高温，涝害看累计降水，大风看最大风速，阶段异常看当前生育期的适宜温湿度。预警分级为平台自定义，不等同于气象部门官方预警信号，接口与文案都明确这一点。"))
story.append(H2("5.5  助农手与智能体控制台"))
story.append(P("每块地一个助农手，是这个项目最具差异化的产品设计。控制台支持修改名称、头像、欢迎语与人设，恢复默认人设，查看内置作物档案；知识库支持粘贴文本或上传 TXT / Markdown / PDF / Word，中文关键词 + 向量混合检索，最多注入 4 段资料；9 个工具可逐项启用/停用，关闭后模型看不到该工具；对话历史存后端，刷新或换设备仍可恢复；回答下方可点赞/点踩，顶部展示成功率、平均延迟、工具调用、知识命中与安全提示次数。"))
story.append(P("权限边界在工具层而不是提示词层：AgriContext 携带 userId、agentId、farmlandId，所有地块工具先校验归属，再校验是否属于当前智能体负责的地块。这样即使模型被诱导，也无法读取其他用户或其他地块的数据。"))
story.append(H2("5.6  多模态识图与语音"))
story.append(P("前端最多上传 3 张 JPG/PNG，自动压缩到 1600px 后提交；后端校验数量与单张大小，调用视觉模型输出结构化 JSON。识别结果以卡片展示植物、学名、生育期、健康状态、问题列表、置信度与照护建议，再作为上下文交给文本智能体。解析器容忍模型偶尔输出 markdown 代码块，解析失败时退化为纯文本结论，避免整轮对话失败。语音按钮支持录音转文字，配置 ASR 后走服务端，未配置时回退浏览器识别。"))
story.append(H2("5.7  方案任务闭环"))
story.append(P("用户上传种植方案后，系统用模型抽取农事任务（名称、日期、类型、备注），但抽取结果必须经用户确认才入库，避免模型误解直接变成待办。任务到期由定时任务检查并推送提醒；用户完成或跳过后自动生成农事记录，系统统计完成率、按时率、逾期与延误天数。这条链路把“方案—任务—提醒—记录—统计”串起来，使 AI 的输出真正落到农事动作。"))
story.append(H2("5.8  社区与内容安全"))
story.append(P("社区支持富文本发帖、图片上传、评论与点赞。富文本经 Quill 编辑，服务端用 jsoup 白名单净化后入库，防存储型 XSS；图片限 JPG/PNG、单张 5MB、每帖 9 张，存 MySQL 并由后端出图；上传后 24 小时未发布会被定时清理。社区不是核心 AI 功能，但它提供了农户之间经验交流的入口，也降低了“所有问题都问模型”的压力。"))
story.append(H2("5.9  前端工程与 PWA"))
story.append(P("前端采用 React 19 + Vite 8，页面层已迁移 TypeScript，CI 对所有 TS/TSX 开启 strict；路由级 lazy 拆包，首屏只保留首页；桌面驾驶舱与移动端使用两套布局，公共组件复用。PWA 使用 Workbox：社区图片 CacheFirst、GET 接口 NetworkFirst、Open-Meteo StaleWhileRevalidate；缓存键额外拼入 Authorization 的 SHA-256 指纹，防止同一浏览器换账号后读到上一位用户的私有数据。"))
story.append(H2("5.10  MCP 开放能力"))
story.append(P("mcp-server 把地块、天气、农事建议、作物检索封装为标准 MCP 工具，并提供创建农事记录、种植季、提醒 3 个写工具。写操作必须显式传 confirm：第一次只返回参数预览，第二次才真正写库；每次预览、成功、失败都追加 JSONL 审计日志。MCP 服务与后端共用同一套 JWT 权限，只代理当前用户有权访问的地块，不绕过任何鉴权。"))

# =====================================================================
# 6 测试与部署
# =====================================================================
story.append(CondPageBreak(7 * cm))
story += H1("6  测试与部署")
story.append(H2("6.1  测试策略"))
story.append(P("测试分三层：确定性单元/集成测试覆盖框架、工具、安全与检索；前端类型检查、Lint、构建与 Playwright 冒烟测试覆盖交互入口；AI 质量评测独立于 CI，用真实模型与评测集运行，结果人工复核。确定性测试不依赖真实 API Key，保证每次提交都能跑；AI 评测承认模型输出的随机性，不把单次结果包装成稳定指标。"))
story.append(H2("6.2  后端测试"))
story += T([
    ["测试组", "覆盖内容", "代表用例"],
    ["Agent 框架与集成", "完整工具链、越权拒绝、参数错误、轮数收敛、历史过滤、未配置 Key、OpenAI 协议", "AgriAgentIntegrationTest（7 个场景）"],
    ["工具与权限", "地块归属、智能体范围、任务查询、病虫害检索、工具注册", "FarmlandAccessGuardTest、GetTasksToolTest、SearchPestToolTest"],
    ["AI 安全与多模态", "高毒农药、绝对化承诺、PII 脱敏、视觉结果解析", "AgriSafetyGuardTest、VisionClientTest"],
    ["RAG 与文本处理", "中文分词、切块、检索排序、编码检测、PDF/Word 提取、向量编解码", "KnowledgeRetrievalServiceTest、KnowledgeChunkerTest、EmbeddingServiceTest"],
    ["业务与内容", "地块几何、社区 HTML 净化、图片处理、Web Push、提示词拼装", "FarmlandGeometryTest、CommunityHtmlSanitizerTest、WebPushServiceTest"],
], [3.4 * cm, 8.6 * cm, FRAME_W - 12.0 * cm], "后端测试覆盖（18 个测试类）")
story.append(P("其中 AgriAgentIntegrationTest 用假的 ChatModel 驱动完整循环，验证工具调用链、跨地块越权、工具参数错误、最大轮数强制收敛、历史中 system 角色被过滤、未配置 API Key 的明确错误，以及工具定义符合 OpenAI 协议。安全、检索、切块、编码、几何等模块均有独立测试，当前构建报告全部通过。"))
story.append(H2("6.3  前端质量门禁"))
story += T([
    ["检查项", "命令", "作用"],
    ["TypeScript", "npm run typecheck", "页面层类型检查"],
    ["Strict TypeScript", "npm run typecheck:strict", "全部 TS/TSX 开启 strict，CI 必过"],
    ["ESLint", "npm run lint", "代码规范与常见错误"],
    ["构建", "npm run build", "生产构建与 PWA 产物"],
    ["E2E 冒烟", "npm run e2e", "Playwright 使用本机 Chrome，自动启动 Vite"],
], [3.4 * cm, 4.4 * cm, FRAME_W - 7.8 * cm], "前端质量门禁")
story.append(P("E2E 当前覆盖登录页渲染、登录/注册切换、注册时两次密码不一致提示。它不追求覆盖全部业务，而是保证最关键的入口在每次提交后仍可用；更复杂的业务链路由后端集成测试与人工验收覆盖。"))
story.append(H2("6.4  CI 流水线"))
story.append(P("GitHub Actions 包含三个作业：后端测试、全新 MySQL 初始化与迁移校验、前端检查。fresh-db 作业是数据库质量的关键：用 schema.sql + seed-current.sql 初始化全新库，启动后端，等待 /actuator/health，检查 flyway_schema_history 无失败记录，断言作物不少于 60 条、data_source 与 confidence 非空，并由 Hibernate ddl-auto=validate 校验实体与表结构一致。这样既防止“老库能跑、新库起不来”，也防止数据字段在迁移中丢失。"))
story += T([
    ["作业", "关键步骤", "失败即阻断"],
    ["backend", "JDK 17 + mvnw test", "任何后端测试失败"],
    ["fresh-db", "MySQL 8 服务、schema + seed、Flyway、health、crop 数量与来源字段", "迁移失败、健康检查超时、数据缺失"],
    ["frontend", "npm ci、typecheck、strict、lint、build、Playwright", "类型、规范、构建或冒烟失败"],
], [2.6 * cm, 9.4 * cm, FRAME_W - 12.0 * cm], "CI 作业与阻断条件")
story.append(H2("6.5  AI 质量评测"))
story.append(P("AI 评测不放进 CI 的必过门禁，因为它依赖真实模型、存在随机性与成本。项目把它做成可重复的资产：RAG 评测通过 /api/agents/{id}/knowledge/eval 统计检索命中；Agent 评测用 45 题数据集与脚本记录工具轨迹、工具选择准确率、平均/中位/P95 耗时；盲评脚本把 Agent 组与基线组回答随机打乱，生成不含组别的 5 分制评分表与独立揭盲文件。评测协议明确“必选工具全部命中 + 可选工具至少命中一个 + 禁用工具未出现”的判定口径，额外调用单独计入不必要工具率，不直接判错。"))
story.append(H2("6.6  部署方案"))
story += FIG(os.path.join(ASSETS, "fig4-deploy.png"), 16.2 * cm,
             "部署拓扑：Nginx、两个无状态后端、MySQL、Redis 与外部服务")
story.append(P("默认使用 Docker Compose 编排 5 个服务：MySQL 8、Redis 7、两个 Spring Boot 后端、Nginx。MySQL 首次启动执行 schema.sql 与 seed-current.sql；后端通过环境变量读数据库、JWT、CORS、DeepSeek、Embedding、ASR、VAPID 等配置；Nginx 托管前端静态文件、反代 /api，并对 /api/agent/ 关闭缓冲、放宽读超时。两个后端无状态，由 Nginx least_conn 轮询，健康检查失败自动摘除。"))
story.append(B("<b>非 Docker：</b>deploy.sh 提供 setup / deploy 两步；systemd 以 prod profile 运行，敏感信息全部写 Environment 行；Nginx 同域托管前端与反代，避免跨域配置。"))
story.append(B("<b>HTTPS：</b>语音识别、PWA 安装、Web Push 均要求安全上下文；HTTP 演示环境会明确降级为浏览器能力或站内通知，不会静默失败。"))
story.append(B("<b>迁移：</b>Flyway 启动自动执行；已发布脚本不改校验和，结构变更追加新版本；老库首次接入时以基线版本标记，不重复建表。"))
story.append(H2("6.7  运维与可观测"))
story += T([
    ["能力", "实现", "使用方式"],
    ["健康检查", "Spring Actuator 仅暴露 /actuator/health；Redis 故障不判死", "容器 healthcheck、负载均衡探活"],
    ["AI 指标", "进程内聚合请求、成功率、延迟、工具、知识、文档、安全、反馈、推送", "GET /api/agent/metrics；控制台 30 秒刷新"],
    ["缓存指标", "HIT / MISS / STALE / BYPASS、上游失败、预取", "日志与响应头；排查天气慢或数据旧"],
    ["日志", "按 INSTANCE_ID 区分实例；工具失败记录 warn；不记录密钥", "docker logs / journalctl -u agri-weather"],
    ["备份", "MySQL 数据卷；Redis 以缓存为主，可重建", "定期 mysqldump；恢复后 Flyway 校验"],
], [2.4 * cm, 8.2 * cm, FRAME_W - 10.6 * cm], "运维与可观测能力")
story.append(H2("6.8  测试结论与风险"))
story.append(P("确定性测试与 CI 保证了“代码改动不破坏核心链路”；AI 评测证明了技术路线可行，但样本小、单次运行、未做田间试验，不能外推为增产或减药效果。当前主要风险包括：天气网格与地块小气候偏差、知识库数据覆盖不足、模型输出随机性、Agent 延迟与成本、以及真实农户使用习惯尚未验证。对应措施已写入第 4.6 节与第 7.4 节。"))

# =====================================================================
# 7 总结与展望
# =====================================================================
story.append(CondPageBreak(7 * cm))
story += H1("7  总结与展望")
story.append(H2("7.1  项目成果"))
story.append(P("项目完成了从数据、规则、AI 到前端体验的完整闭环：23 张业务表、88 个 REST 端点、195 个 Java 文件与 55 个 TS/TSX 文件；64 种作物档案、9 个农事工具、多类灾害与阶段风险预警、方案任务闭环、社区与 MCP 开放能力；CI 覆盖后端测试、全新数据库迁移与前端严格类型检查；部署同时支持 Docker Compose 与 systemd。"))
story.append(P("更重要的是，项目没有把“接入大模型”当作终点，而是把模型放进一个有数据、有工具、有权限、有规则、有评测的系统里。AI 的价值体现在“能回答这块地明天能不能打药”，而不是“能聊农业”。"))

story.append(H2("7.2  技术创新点"))
story += T([
    ["编号", "创新点", "具体做法", "价值"],
    ["T1", "领域无关的轻量 Agent 框架", "AgentHarness + Tool SPI + ToolRegistry + Observer；框架不含农业词汇，纯 Java 可测", "业务与编排解耦；新增工具零改框架；测试不依赖真实模型"],
    ["T2", "规则计算 + 模型调度的混合决策", "农学阈值由 OperationAdvisor / AlertService 计算，模型只选工具、解释与表达", "避免模型编造“风速 3m/s 可以打药”；结论可复现、可审计"],
    ["T3", "地块与智能体双重权限边界", "工具层同时校验 userId 与 agent.farmlandId，list_farmlands 也只返回负责地块", "即使提示词被绕过，也无法跨用户/跨地块取数"],
    ["T4", "面向小知识库的中文混合检索", "bigram + 停用词 + IDF + 标题加权 + 可选向量 + 长度归一 + 同文档限流", "无需向量数据库即可工作；无外部服务时自动降级"],
    ["T5", "可靠性与成本工程", "6 轮强制收敛、工具错误 JSON 回喂、SSE 取消、历史裁剪、结果摘要、缓存/锁/限流/额度", "长链路不中断、成本可控、弱网可用"],
    ["T6", "全链路可解释与可回归", "工具轨迹、思考摘要、运行指标、RAG/Agent 评测集、对照实验、CI 全新库校验", "从“演示成功”走向“可重复验证”"],
], [1.0 * cm, 4.2 * cm, 7.3 * cm, FRAME_W - 12.5 * cm], "技术创新点")

story.append(CondPageBreak(9 * cm))
story.append(H2("7.3  应用创新点"))
story += T([
    ["编号", "创新点", "具体做法", "价值"],
    ["A1", "一块地一个助农手", "每块地自动生成智能体，人设、知识库、工具、会话、权限独立", "建议带地块上下文；多地块用户不串数据"],
    ["A2", "可执行的农事问答", "把“明天能打药吗”拆成地块、天气、生育期、规则四步，返回具体日期与理由", "从“知道天气”变成“知道该做什么”"],
    ["A3", "播种适配与数据可信", "64 种作物 + 实时气象 + 播期匹配；接口返回来源与置信度", "避免把团队整理数据冒充国标；支持追责与复核"],
    ["A4", "预警到行动的最小闭环", "后台巡检 + 站内未读 + Web Push + 已读；预警分级与官方信号明确区分", "提醒能到达、能处理、能追踪"],
    ["A5", "方案任务闭环", "方案抽取 → 人工确认 → 到期提醒 → 完成/跳过 → 农事记录 → 完成率统计", "AI 输出落到农事动作，而不是停在聊天框"],
    ["A6", "田间可用的多入口", "PWA、语音、拍照识病、文档问答、MCP 开放工具、社区", "覆盖打字不便、网络不稳、需要外部集成的真实场景"],
], [1.0 * cm, 4.2 * cm, 7.3 * cm, FRAME_W - 12.5 * cm], "应用创新点")

story.append(H2("7.4  不足"))
story.append(B("样本与验证不足：尚无真实农户长期试点，缺少田间产量、农药减量与满意度统计；现有评测样本小、单次运行，结论是方向性的。"))
story.append(B("数据覆盖有限：64 种作物、部分病虫害资料为团队整理；天气是网格预报，未接入地块气象站与土壤墒情。"))
story.append(B("AI 工程仍有提升空间：复杂问题可能触发轮数上限；视觉模型对相似病害区分有限；知识库检索尚未做 top1/top3 与答案正确率评估。"))
story.append(B("产品化不足：多租户、计费、消息中心、审计后台、移动原生体验等尚未展开；社区内容治理仍需人工。"))

story.append(H2("7.5  展望"))
story.append(B("<b>真实试点：</b>用 5–10 位农户、2–4 周，记录提问、预警行动率、满意度与典型故事，用真实数据替换模拟结论。"))
story.append(B("<b>数据增强：</b>接入土壤墒情与地块气象站，补充区域品种与植保情报；建立作物/病虫害数据复核流程与版本。"))
story.append(B("<b>模型与评测：</b>引入更大规模盲评与统计检验；对比不同基座模型与有无工具的消融；探索小模型微调与本地部署。"))
story.append(B("<b>产品化：</b>多租户与合作社组织、消息中心、作业计划模板、农资合规审核、离线优先的移动体验。"))

story.append(H2("7.6  结语"))
story.append(P("“问田”想解决的问题很具体：让农户在正确的时间、正确的地块上，做正确的农事。技术上，它把大模型从“聊天工具”变成“能查数据、能算规则、能守边界”的系统组件；产品上，它把天气、作物、预警、任务和 AI 顾问放进同一个工作台。当前版本仍有明显的样本与数据局限，但技术路线已经被真实链路验证：模型不编造数据，工具可追溯，规则可解释，评测可重复。下一步，是用真实田间使用把这条路线走实。"))

story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=0.8, color=RULE, spaceBefore=2, spaceAfter=8))
story.append(Paragraph("参考资料", S["H3"]))
refs = [
    "［1］中国气象局. QX/T 734—2024 关键农时气象服务通则[S]. 2024.",
    "［2］FAO. EcoCrop: Crop ecological requirements database[EB/OL]. https://ecocrop.fao.org/.",
    "［3］国家市场监督管理总局. GB/T 8321 农药合理使用准则[S].",
    "［4］Open-Meteo. Weather Forecast API Documentation[EB/OL]. https://open-meteo.com/en/docs.",
    "［5］DeepSeek. API Documentation[EB/OL]. https://platform.deepseek.com/api-docs.",
]
for r in refs:
    story.append(Paragraph(r, ParagraphStyle("Ref", parent=S["Small"], leftIndent=0,
                                            firstLineIndent=0, spaceAfter=1.5)))

# =====================================================================
# 构建
# =====================================================================
def build():
    doc = Doc(os.path.join(BASE, "_tmp.pdf"), pagesize=A4,
              leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM,
              title="问田 · 智慧农业天气系统技术文档",
              author="曾嘉晨、贺宇豪、魏敬轩",
              subject="智慧农业天气系统技术文档",
              keywords="智慧农业, 农业气象, 大语言模型, 工具调用, RAG, 灾害预警")
    cover_frame = Frame(LM, BM, FRAME_W, PAGE_H - TM - BM, id="cover_frame",
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    body_frame = Frame(LM, BM, FRAME_W, PAGE_H - TM - BM, id="body_frame",
                       leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover),
        PageTemplate(id="body", frames=[body_frame], onPage=draw_body),
    ])
    doc.multiBuild(story, canvasmaker=NumberedCanvas)
    os.replace(os.path.join(BASE, "_tmp.pdf"), OUT)
    print("built:", OUT)


if __name__ == "__main__":
    build()
