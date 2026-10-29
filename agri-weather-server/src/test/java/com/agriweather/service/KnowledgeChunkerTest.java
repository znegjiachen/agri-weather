package com.agriweather.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class KnowledgeChunkerTest {

    @Test
    @DisplayName("短文本只产生一块")
    void shortTextSingleChunk() {
        List<String> chunks = KnowledgeChunker.split("玉米灰斑病要及时防治。");
        assertEquals(1, chunks.size());
        assertTrue(chunks.get(0).contains("灰斑病"));
    }

    @Test
    @DisplayName("长文本切块并保持长度上限")
    void longTextSplit() {
        String sentence = "玉米灰斑病多在抽雄吐丝后发生，先从下部叶片开始，出现灰褐色长椭圆形病斑。";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 80; i++) sb.append(sentence);
        List<String> chunks = KnowledgeChunker.split(sb.toString());
        assertTrue(chunks.size() > 1);
        chunks.forEach(chunk -> assertTrue(chunk.length() <= KnowledgeChunker.MAX_CHARS + KnowledgeChunker.OVERLAP_CHARS + 80));
    }

    @Test
    @DisplayName("段落和空行被保留为语义边界")
    void paragraphs() {
        String text = "第一段：玉米苗期管理。\n\n第二段：玉米抽雄期管理。";
        List<String> chunks = KnowledgeChunker.split(text);
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.stream().anyMatch(s -> s.contains("苗期")));
        assertTrue(chunks.stream().anyMatch(s -> s.contains("抽雄期")));
    }

    @Test
    @DisplayName("空白内容不产生块")
    void blank() {
        assertTrue(KnowledgeChunker.split("").isEmpty());
        assertTrue(KnowledgeChunker.split(null).isEmpty());
    }
}