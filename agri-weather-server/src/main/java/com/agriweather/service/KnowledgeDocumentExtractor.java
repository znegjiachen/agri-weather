package com.agriweather.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/**
 * 知识库文件解析：TXT / Markdown / PDF / Word（doc、docx）。
 *
 * 只提取纯文本，不保存原始文件、不执行宏；解析结果统一走 KnowledgeTextDecoder 归一化。
 */
@Service
public class KnowledgeDocumentExtractor {

    private static final int MAX_PDF_PAGES = 100;

    private static final Set<String> TEXT_EXTENSIONS = Set.of("txt", "md", "markdown");
    private static final Set<String> SUPPORTED = Set.of("txt", "md", "markdown", "pdf", "doc", "docx");

    public record Extracted(String text, String mimeType) {
    }

    public Extracted extract(String filename, byte[] bytes) {
        String name = filename != null ? filename : "knowledge.txt";
        String ext = extension(name);
        if (!SUPPORTED.contains(ext)) {
            throw new IllegalArgumentException("目前支持 TXT、Markdown、PDF、Word（doc/docx）");
        }

        String text;
        String mime;
        try {
            if (TEXT_EXTENSIONS.contains(ext)) {
                text = KnowledgeTextDecoder.decode(bytes);
                mime = "text/plain";
            } else if ("pdf".equals(ext)) {
                text = extractPdf(bytes);
                mime = "application/pdf";
            } else if ("docx".equals(ext)) {
                text = extractDocx(bytes);
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            } else {
                text = extractDoc(bytes);
                mime = "application/msword";
            }
        } catch (InvalidPasswordException e) {
            throw new IllegalArgumentException("PDF 已加密，请先去除密码后再上传");
        } catch (IOException e) {
            throw new IllegalArgumentException("文件解析失败，请确认文件未损坏：" + e.getMessage());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("文件解析失败：" + e.getMessage());
        }

        String normalized = KnowledgeTextDecoder.normalize(text);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("没有从文件中提取到文字，可能是扫描件或空文档");
        }
        return new Extracted(normalized, mime);
    }

    private String extractPdf(byte[] bytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted()) {
                throw new IllegalArgumentException("PDF 已加密，请先去除密码后再上传");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            stripper.setStartPage(1);
            stripper.setEndPage(Math.min(document.getNumberOfPages(), MAX_PDF_PAGES));
            return stripper.getText(document);
        }
    }

    private String extractDocx(byte[] bytes) throws IOException {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            StringBuilder sb = new StringBuilder();
            for (IBodyElement element : document.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph) {
                    if (!paragraph.getText().isBlank()) sb.append(paragraph.getText()).append('\n');
                } else if (element instanceof XWPFTable table) {
                    for (XWPFTableRow row : table.getRows()) {
                        for (XWPFTableCell cell : row.getTableCells()) {
                            if (!cell.getText().isBlank()) sb.append(cell.getText()).append('\t');
                        }
                        sb.append('\n');
                    }
                }
            }
            return sb.toString();
        }
    }

    private String extractDoc(byte[] bytes) throws IOException {
        try (HWPFDocument document = new HWPFDocument(new ByteArrayInputStream(bytes));
             WordExtractor extractor = new WordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}