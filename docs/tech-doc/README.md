# 技术文档生成

本目录保存《问田 · 智慧农业天气系统技术文档》的生成脚本与示意图源文件。

## 产物

- `../../问田-智慧农业天气系统-技术文档.pdf`：交付版 PDF，A4，23 页

## 重新生成

环境要求：Python 3.10+、reportlab、matplotlib、PyMuPDF（仅用于校验页数）、Windows 中文字体（Microsoft YaHei）。

```bash
cd docs/tech-doc
python make_diagrams.py     # 生成 assets/fig1~fig4
python build_doc.py         # 生成根目录 PDF
```

## 说明

- 正文与图表均为项目实测/仓库文档口径，AI 评测样本较小，文中已标注局限。
- 图表使用 Microsoft YaHei，PDF 已嵌入字体子集。
- 页数如后续调整内容，请用 `python -c "import pymupdf; print(pymupdf.open('../../问田-智慧农业天气系统-技术文档.pdf').page_count)"` 校验不超过 30 页。
