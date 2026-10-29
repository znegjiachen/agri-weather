package com.agriweather.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ChineseTextTokenizerTest {

    @Test
    @DisplayName("中文取 bigram，停用词被过滤")
    void tokenizesChineseBigrams() {
        Set<String> terms = ChineseTextTokenizer.queryTerms("玉米灰斑病怎么防治");
        assertTrue(terms.contains("玉米"));
        assertTrue(terms.contains("灰斑"));
        assertTrue(terms.contains("斑病"));
        assertTrue(terms.contains("防治"));
        assertFalse(terms.contains("怎么"));
    }

    @Test
    @DisplayName("单字查询也能命中")
    void keepsSingleHanChar() {
        Set<String> terms = ChineseTextTokenizer.queryTerms("稻");
        assertEquals(Set.of("稻"), terms);
    }

    @Test
    @DisplayName("英文和数字按整词保留并转小写")
    void tokenizesLatinAndDigits() {
        Set<String> terms = ChineseTextTokenizer.queryTerms("PH值 12");
        assertTrue(terms.contains("ph"));
        assertTrue(terms.contains("值"));
    }

    @Test
    @DisplayName("空文本不产生词项")
    void emptyText() {
        assertTrue(ChineseTextTokenizer.queryTerms("").isEmpty());
        assertTrue(ChineseTextTokenizer.queryTerms(null).isEmpty());
    }
}