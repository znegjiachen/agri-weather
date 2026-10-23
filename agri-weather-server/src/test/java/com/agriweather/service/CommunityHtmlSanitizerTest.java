package com.agriweather.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CommunityHtmlSanitizerTest {

    private static final String IMAGE_ID = "0123456789abcdef0123456789abcdef";
    private static final String IMAGE_URL = "/api/community/images/" + IMAGE_ID;

    private final CommunityHtmlSanitizer sanitizer = new CommunityHtmlSanitizer();

    @Test
    @DisplayName("保留富文本格式，Quill 列表归一成原生 ul")
    void keepsFormattingAndNormalizesQuillLists() {
        String input = """
                <h2>田间记录</h2>
                <p><strong>粗体</strong>与<em>斜体</em></p>
                <ol>
                  <li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>第一点</li>
                  <li data-list="bullet">第二点</li>
                </ol>
                <blockquote>雨后排水</blockquote>
                """;

        CommunityHtmlSanitizer.SanitizedContent result = sanitizer.sanitize(input);

        assertTrue(result.html().contains("<h2>田间记录</h2>"));
        // 文本块里的换行会被 jsoup 保留，比较结构时忽略空白
        assertTrue(result.html().replaceAll("\\s+", "")
                        .contains("<ul><li>第一点</li><li>第二点</li></ul>"),
                "期望转成标准 ul，实际：" + result.html());
        assertFalse(result.html().contains("data-list"));
        assertFalse(result.html().contains("ql-ui"));
        assertTrue(result.text().contains("第一点"));
    }

    @Test
    @DisplayName("移除脚本、事件属性和外链图片，javascript: 链接只留文字")
    void stripsXssVectors() {
        String input = """
                <p onclick="alert(1)">正文</p>
                <script>alert(2)</script>
                <img src="https://evil.example/x.png" onerror="alert(3)">
                <a href="javascript:alert(4)">坏链接</a>
                """;

        CommunityHtmlSanitizer.SanitizedContent result = sanitizer.sanitize(input);

        assertFalse(result.html().contains("script"));
        assertFalse(result.html().contains("onclick"));
        assertFalse(result.html().contains("onerror"));
        assertFalse(result.html().contains("evil.example"));
        assertFalse(result.html().contains("javascript:"));
        assertTrue(result.html().contains("坏链接"));
        assertTrue(result.imageIds().isEmpty());
    }

    @Test
    @DisplayName("保留本站上传的图片并返回 publicId")
    void keepsOwnedAppImage() {
        String input = "<p><img src=\"" + IMAGE_URL + "\" alt=\"叶片\"></p>";

        CommunityHtmlSanitizer.SanitizedContent result = sanitizer.sanitize(input);

        assertEquals(List.of(IMAGE_ID), result.imageIds());
        assertTrue(result.html().contains("src=\"" + IMAGE_URL + "\""));
        assertTrue(result.html().contains("loading=\"lazy\""));
        assertTrue(result.html().contains("decoding=\"async\""));
    }

    @Test
    @DisplayName("每帖最多 9 张图由 Service 校验，这里至少不要把超过 9 张算错")
    void reportsDistinctImageIds() {
        StringBuilder html = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            html.append("<p><img src=\"/api/community/images/")
                    .append(String.format("%032x", i))
                    .append("\"></p>");
        }
        // 同一张图重复出现只算一次
        html.append("<p><img src=\"/api/community/images/").append(String.format("%032x", 0)).append("\"></p>");

        CommunityHtmlSanitizer.SanitizedContent result = sanitizer.sanitize(html.toString());

        assertEquals(9, result.imageIds().size());
    }

    @Test
    @DisplayName("超长原文直接拒绝，不进入解析")
    void rejectsOversizedRawHtml() {
        String input = "<p>" + "字".repeat(CommunityHtmlSanitizer.MAX_RAW_LENGTH) + "</p>";
        assertThrows(IllegalArgumentException.class, () -> sanitizer.sanitize(input));
    }

    @Test
    @DisplayName("摘要去标签并截断到 140 字")
    void excerptStripsTagsAndClips() {
        String text = "叶".repeat(200);
        String excerpt = sanitizer.excerpt("<p><strong>" + text + "</strong></p>", "HTML");

        assertEquals(141, excerpt.length(), "140 字 + 省略号");
        assertTrue(excerpt.endsWith("…"));
        assertFalse(excerpt.contains("<"));
    }

    @Test
    @DisplayName("纯文本摘要保留原样，不做 HTML 解析")
    void excerptForPlainText() {
        String excerpt = sanitizer.excerpt("第一行\n第二行 <b>不是标签</b>", "TEXT");
        assertTrue(excerpt.contains("<b>不是标签</b>"));
    }

    @Test
    @DisplayName("firstImageUrl 只返回本站图片")
    void firstImageUrlOnlyAcceptsAppImages() {
        assertEquals(IMAGE_URL, sanitizer.firstImageUrl("<p><img src=\"" + IMAGE_URL + "\"></p>"));
        assertNull(sanitizer.firstImageUrl("<p><img src=\"https://evil.example/x.png\"></p>"));
        assertNull(sanitizer.firstImageUrl("<p>没有图</p>"));
    }
}