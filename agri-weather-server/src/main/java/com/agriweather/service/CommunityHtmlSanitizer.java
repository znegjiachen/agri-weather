package com.agriweather.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 社区富文本净化。
 *
 * 编辑器产出的是 HTML，直接入库再由前端 innerHTML 渲染就是标准的存储型 XSS。
 * 这里只放行富文本需要的标签；图片必须是本站上传接口产出的 URL，
 * 外链图片（可用来做追踪像素/混合内容）一律删掉。
 */
@Component
public class CommunityHtmlSanitizer {

    public static final int MAX_TEXT_LENGTH = 2000;
    public static final int MAX_HTML_LENGTH = 20_000;
    public static final int MAX_RAW_LENGTH = 40_000;
    public static final int MAX_IMAGES = 9;

    /** 只接受本站图片接口的随机 publicId（32 位小写十六进制） */
    public static final Pattern APP_IMAGE_PATH =
            Pattern.compile("^/api/community/images/([0-9a-f]{32})$");

    /**
     * 不用 Safelist.relaxed()：它自带表格/div/img 的 http(s) 协议校验，
     * 会把本站的相对图片 URL 当成非法地址直接删掉。
     * 这里从空名单开始显式列标签，img.src 交给下面的正则单独校验。
     */
    private static final Safelist SAFELIST = new Safelist()
            .addTags("p", "br", "h1", "h2", "h3", "h4", "hr",
                    "strong", "b", "em", "i", "u", "s", "strike",
                    "ul", "ol", "li", "blockquote", "a", "img",
                    "code", "pre", "span")
            .addAttributes("a", "href", "title", "target", "rel")
            .addAttributes("img", "src", "alt", "width", "height", "loading", "decoding")
            // Quill 2 用 li[data-list] 区分有序/无序，后面会归一成原生 ul/ol
            .addAttributes("li", "data-list")
            .addAttributes("ol", "start")
            .addProtocols("a", "href", "http", "https", "mailto");

    public record SanitizedContent(String html, String text, List<String> imageIds) {
    }

    public SanitizedContent sanitize(String rawHtml) {
        String raw = rawHtml == null ? "" : rawHtml.trim();
        if (raw.length() > MAX_RAW_LENGTH) {
            throw new IllegalArgumentException("内容过长");
        }

        String cleaned = Jsoup.clean(raw, "", SAFELIST, new Document.OutputSettings().prettyPrint(false));
        Document doc = Jsoup.parseBodyFragment(cleaned);
        doc.outputSettings().prettyPrint(false);

        // Quill 的列表项前面有个纯展示用的空 span；class 已被白名单剔除，
        // 这里按「空 span」兜底清理，避免留下占位元素
        doc.select("span").stream()
                .filter(span -> span.text().isBlank() && span.children().isEmpty())
                .forEach(Element::remove);
        normalizeLists(doc);

        Set<String> imageIds = new LinkedHashSet<>();
        for (Element img : new ArrayList<>(doc.select("img"))) {
            Matcher m = APP_IMAGE_PATH.matcher(img.attr("src"));
            if (!m.matches()) {
                img.remove();
                continue;
            }
            imageIds.add(m.group(1));
            img.attr("loading", "lazy");
            img.attr("decoding", "async");
        }

        for (Element a : new ArrayList<>(doc.select("a"))) {
            String href = a.attr("href").trim();
            if (href.isEmpty()) {
                // 协议被白名单剔除（如 javascript:）后只剩空壳，保留文字即可
                a.unwrap();
                continue;
            }
            a.attr("rel", "nofollow noopener noreferrer");
            if (!a.hasAttr("target")) {
                a.attr("target", "_blank");
            }
        }

        String html = doc.body().html().trim();
        if (html.length() > MAX_HTML_LENGTH) {
            throw new IllegalArgumentException("内容过长");
        }
        return new SanitizedContent(html, doc.body().text(), List.copyOf(imageIds));
    }

    /**
     * Quill 会输出 ol &gt; li[data-list=bullet] 这种结构，
     * 转成标准 ul/ol 后浏览器和 RSS/邮件客户端才能正常显示项目符号。
     */
    private void normalizeLists(Document doc) {
        for (Element list : doc.select("ol, ul")) {
            List<Element> items = list.children().stream()
                    .filter(el -> "li".equals(el.tagName()))
                    .toList();
            if (items.isEmpty()) {
                continue;
            }
            boolean allBullet = items.stream()
                    .allMatch(li -> "bullet".equals(li.attr("data-list")));
            boolean anyOrdered = items.stream()
                    .anyMatch(li -> "ordered".equals(li.attr("data-list")));

            if (allBullet && "ol".equals(list.tagName())) {
                list.tagName("ul");
            } else if (anyOrdered && "ul".equals(list.tagName())) {
                list.tagName("ol");
            }
            items.forEach(li -> li.removeAttr("data-list"));
        }
    }

    public String plainText(String html) {
        return html == null ? "" : Jsoup.parse(html).text();
    }

    public String firstImageUrl(String html) {
        if (html == null || html.isEmpty()) {
            return null;
        }
        Element img = Jsoup.parse(html).selectFirst("img");
        if (img == null) {
            return null;
        }
        String src = img.attr("src");
        return APP_IMAGE_PATH.matcher(src).matches() ? src : null;
    }

    /** 列表摘要：HTML 去标签，纯文本保留原字符，统一压空白并对齐长度 */
    public String excerpt(String content, String contentFormat) {
        String text = "HTML".equals(contentFormat)
                ? plainText(content)
                : (content == null ? "" : content);
        return clip(text.replaceAll("\\s+", " ").trim(), 140);
    }

    public static String clip(String s, int maxCodePoints) {
        if (s == null) {
            return "";
        }
        if (s.codePointCount(0, s.length()) <= maxCodePoints) {
            return s;
        }
        int end = s.offsetByCodePoints(0, maxCodePoints);
        return s.substring(0, end) + "…";
    }
}