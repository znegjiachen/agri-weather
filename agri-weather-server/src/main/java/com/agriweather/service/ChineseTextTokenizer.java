package com.agriweather.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 轻量中文分词：连续汉字取二元组（bigram），英文/数字取整词。
 *
 * 不追求语言学精度，目标是给地块级小知识库提供稳定、可解释的召回信号。
 */
public final class ChineseTextTokenizer {

    private static final Set<String> STOP_BIGRAMS = Set.of(
            "怎么", "什么", "这个", "那个", "这些", "那些", "可以", "是否", "需要", "没有",
            "的话", "以及", "我们", "你们", "他们", "如何", "哪些", "多少", "今天", "明天",
            "现在", "一个", "一些", "进行", "问题", "情况", "时候", "为什", "因为",
            "所以", "但是", "如果", "还是", "就是", "不是", "可能", "应该", "能够", "已经",
            "一下", "这里", "那里", "请问", "帮我", "看看", "告诉", "你好", "谢谢", "有没",
            "怎样", "那么", "这样", "之后", "之前", "然后", "而且", "或者", "其他", "其中"
    );

    private ChineseTextTokenizer() {
    }

    public static Set<String> queryTerms(String query) {
        return termCounts(query).keySet();
    }

    public static Map<String, Integer> termCounts(String text) {
        Map<String, Integer> counts = new HashMap<>();
        if (text == null || text.isEmpty()) return counts;

        StringBuilder han = new StringBuilder();
        StringBuilder latin = new StringBuilder();

        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            int width = Character.charCount(cp);
            if (Character.UnicodeScript.of(cp) == Character.UnicodeScript.HAN) {
                flushLatin(latin, counts);
                han.appendCodePoint(cp);
            } else if (Character.isLetterOrDigit(cp)) {
                flushHan(han, counts);
                latin.appendCodePoint(Character.toLowerCase(cp));
            } else {
                flushHan(han, counts);
                flushLatin(latin, counts);
            }
            i += width;
        }
        flushHan(han, counts);
        flushLatin(latin, counts);
        return counts;
    }

    private static void flushHan(StringBuilder buffer, Map<String, Integer> counts) {
        String value = buffer.toString();
        buffer.setLength(0);
        if (value.isEmpty()) return;
        if (value.length() == 1) {
            counts.merge(value, 1, Integer::sum);
            return;
        }
        for (int i = 0; i < value.length() - 1; i++) {
            String bigram = value.substring(i, i + 2);
            if (STOP_BIGRAMS.contains(bigram)) continue;
            counts.merge(bigram, 1, Integer::sum);
        }
    }

    private static void flushLatin(StringBuilder buffer, Map<String, Integer> counts) {
        String value = buffer.toString();
        buffer.setLength(0);
        if (value.length() >= 2) {
            counts.merge(value, 1, Integer::sum);
        }
    }

    /** 供测试与调试：归一化后的查询词 */
    public static Set<String> terms(String text) {
        return new HashSet<>(termCounts(text).keySet());
    }
}