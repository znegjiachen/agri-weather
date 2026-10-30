package com.agriweather.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class KnowledgeDocumentExtractorTest {

    private final KnowledgeDocumentExtractor extractor = new KnowledgeDocumentExtractor();

    @Test
    @DisplayName("TXT / Markdown 按文本解码")
    void textFile() {
        var extracted = extractor.extract("notes.md",
                "# 玉米\n灰斑病防治要点。".getBytes(StandardCharsets.UTF_8));
        assertTrue(extracted.text().contains("灰斑病"));
        assertEquals("text/plain", extracted.mimeType());
    }

    @Test
    @DisplayName("DOCX 提取段落文字")
    void docxFile() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("玉米螟幼虫危害心叶。");
            document.createParagraph().createRun().setText("三龄前防治效果最好。");
            document.write(out);
        }
        var extracted = extractor.extract("玉米螟.docx", out.toByteArray());
        assertTrue(extracted.text().contains("玉米螟"));
        assertTrue(extracted.text().contains("三龄前"));
    }

    @Test
    @DisplayName("PDF 提取文字")
    void pdfFile() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(72, 700);
                content.showText("Corn gray leaf spot control");
                content.endText();
            }
            document.save(out);
        }
        var extracted = extractor.extract("corn.pdf", out.toByteArray());
        assertTrue(extracted.text().contains("Corn gray leaf spot"));
        assertEquals("application/pdf", extracted.mimeType());
    }

    @Test
    @DisplayName("不支持的扩展名和不含文字的文档被拒绝")
    void rejects() {
        assertThrows(IllegalArgumentException.class,
                () -> extractor.extract("a.exe", new byte[]{1, 2, 3}));
        assertThrows(IllegalArgumentException.class,
                () -> extractor.extract("a.txt", new byte[]{0x00, 0x01, 0x02}));
    }
}