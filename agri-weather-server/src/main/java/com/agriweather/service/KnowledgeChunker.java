package com.agriweather.service;

import java.util.ArrayList;
import java.util.List;

/**
 * 把知识库长文切成适合检索和注入上下文的小段。
 *
 * 目标 480 字、上限 600 字、段间重叠 60 字；
 * 先按段落/中文句末切，再拼装，避免把一句话拦腰截断。
 */
public final class KnowledgeChunker {

    public static final int TARGET_CHARS = 480;
    public static final int MAX_CHARS = 600;
    public static final int OVERLAP_CHARS = 60;
    public static final int MAX_CHUNKS_PER_DOC = 300;

    private KnowledgeChunker() {
    }

    public static List<String> split(String text) {
        if (text == null || text.isBlank()) return List.of();

        List<String> segments = splitSegments(text);
        List<String> chunks = new ArrayList<>();
        StringBuilder current = new StringBuilder();

        for (String segment : segments) {
            if (current.length() > 0 && current.length() + segment.length() > MAX_CHARS) {
                chunks.add(current.toString().trim());
                String overlap = tail(current.toString(), OVERLAP_CHARS);
                current.setLength(0);
                if (!overlap.isBlank()) current.append(overlap).append('\n');
                if (chunks.size() >= MAX_CHUNKS_PER_DOC) break;
            }

            if (segment.length() > MAX_CHARS) {
                // 超长且没有可切分的标点：硬切
                String rest = segment;
                while (rest.length() > MAX_CHARS && chunks.size() < MAX_CHUNKS_PER_DOC) {
                    chunks.add(rest.substring(0, MAX_CHARS));
                    rest = rest.substring(MAX_CHARS - OVERLAP_CHARS);
                }
                if (!rest.isBlank()) current.append(rest);
            } else {
                current.append(segment);
            }
        }

        if (current.length() > 0 && chunks.size() < MAX_CHUNKS_PER_DOC) {
            String last = current.toString().trim();
            // 尾段太短就并进上一块，避免产生无意义的碎片
            if (!chunks.isEmpty() && last.length() < 80) {
                chunks.set(chunks.size() - 1, chunks.get(chunks.size() - 1) + "\n" + last);
            } else {
                chunks.add(last);
            }
        }
        return chunks.stream().filter(s -> !s.isBlank()).toList();
    }

    /** 按空行、换行、中文句末标点切成最小语义段 */
    private static List<String> splitSegments(String text) {
        List<String> result = new ArrayList<>();
        String[] paragraphs = text.split("\\n{2,}");
        for (String paragraph : paragraphs) {
            String p = paragraph.trim();
            if (p.isEmpty()) continue;
            String[] sentences = p.split("(?<=[。！？!?；;])|\\n");
            for (String sentence : sentences) {
                String s = sentence.trim();
                if (!s.isEmpty()) result.add(s.endsWith("\n") ? s : s + "\n");
            }
        }
        return result;
    }

    private static String tail(String value, int chars) {
        if (value.length() <= chars) return value;
        return value.substring(value.length() - chars);
    }
}