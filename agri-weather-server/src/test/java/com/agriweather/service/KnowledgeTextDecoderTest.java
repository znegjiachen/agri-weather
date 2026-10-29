package com.agriweather.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class KnowledgeTextDecoderTest {

    @Test
    @DisplayName("UTF-8 BOM 被移除")
    void utf8Bom() {
        byte[] body = "玉米灰斑病防治".getBytes(StandardCharsets.UTF_8);
        byte[] bytes = new byte[body.length + 3];
        bytes[0] = (byte) 0xEF;
        bytes[1] = (byte) 0xBB;
        bytes[2] = (byte) 0xBF;
        System.arraycopy(body, 0, bytes, 3, body.length);
        assertEquals("玉米灰斑病防治", KnowledgeTextDecoder.decode(bytes));
    }

    @Test
    @DisplayName("GB18030 文本能回退解码")
    void gb18030() {
        Charset gb = Charset.forName("GB18030");
        String text = "小麦赤霉病在扬花期遇雨易发";
        assertEquals(text, KnowledgeTextDecoder.decode(text.getBytes(gb)));
    }

    @Test
    @DisplayName("UTF-16 BOM 明确拒绝")
    void utf16Rejected() {
        byte[] bytes = {(byte) 0xFE, (byte) 0xFF, 0x00, 0x61};
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> KnowledgeTextDecoder.decode(bytes));
        assertTrue(e.getMessage().contains("UTF-16"));
    }

    @Test
    @DisplayName("含 NUL 的二进制文件被拒绝")
    void binaryRejected() {
        byte[] bytes = {'a', 0x00, 'b', 0x01, 0x02};
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> KnowledgeTextDecoder.decode(bytes));
        assertTrue(e.getMessage().contains("不是文本"));
    }

    @Test
    @DisplayName("换行统一为 LF")
    void normalizeNewlines() {
        assertEquals("a\nb\nc", KnowledgeTextDecoder.normalize("a\r\nb\rc"));
    }
}