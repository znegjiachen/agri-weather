# 技术文档生成

本目录保存《问田 · 智慧农业天气系统技术文档》的生成脚本与示意图源文件。

## 产物

- `../问田-智慧农业天气系统-技术文档.pdf`：交付版 PDF，A4，27 页

## 重新生成

环境要求：Python 3.10+、reportlab、matplotlib、PyMuPDF（仅用于校验页数）、Windows 中文字体（Microsoft YaHei）。

```bash
cd docs/tech-doc
python make_diagrams.py     # 生成 assets/fig1~fig4
python make_cover.py        # 合成封面底图
python build_doc.py         # 生成根目录 PDF
```

## 说明

- 正文与图表均为项目实测/仓库文档口径，AI 评测样本较小，文中已标注局限。
- 图表使用 Microsoft YaHei，PDF 已嵌入字体子集。
- 功能截图位于 `assets/screens/`，由 Playwright 对本地运行的页面实拍；Agent 对话截图使用真实 DeepSeek 调用，展示思考与 3 个工具调用轨迹。
- 页数如后续调整内容，请用 `python -c "import pymupdf; print(pymupdf.open('../问田-智慧农业天气系统-技术文档.pdf').page_count)"` 校验不超过 30 页。

- 封面照片来自 Unsplash（免费许可），由 make_cover.py 合成为绿色渐变底图。
