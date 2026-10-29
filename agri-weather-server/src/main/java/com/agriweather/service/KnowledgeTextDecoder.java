package com.agriweather.service;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/**
 * 知识库文本解码：只接受可读文本，拒绝二进制和 UTF-16。
 *
 * 顺序很重要：先做二进制判断，再尝试 UTF-8，最后回退 GB18030
 * （GB18030 几乎能解码任何字节，不能作为第一选择）。
 */
public final class KnowledgeTextDecoder {

    private static final Charset GB18030 = Charset.forName("GB18030");

    private KnowledgeTextDecoder() {
    }

    public static String decode(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("文件内容为空");
        }
        if (hasUtf16Bom(bytes)) {
            throw new IllegalArgumentException("暂不支持 UTF-16 编码，请另存为 UTF-8 或 GB18030");
        }
        if (looksBinary(bytes)) {
            throw new IllegalArgumentException("文件看起来不是文本，请上传 TXT 或 Markdown");
        }

        int offset = 0;
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xEF
                && (bytes[1] & 0xFF) == 0xBB
                && (bytes[2] & 0xFF) == 0xBF) {
            offset = 3;
        }

        String text = decodeStrict(bytes, offset, StandardCharsets.UTF_8);
        if (text == null) {
            text = decodeStrict(bytes, offset, GB18030);
        }
        if (text == null) {
            throw new IllegalArgumentException("无法识别文件编码，请另存为 UTF-8 或 GB18030 文本");
        }
        return normalize(text);
    }

    public static String normalize(String raw) {
        if (raw == null) return "";
        String text = raw.replace("\r\n", "\n").replace('\r', '\n');
        text = text.replaceAll("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "");
        text = text.replaceAll("\\n{3,}", "\n\n");
        return text.trim();
    }

    private static String decodeStrict(byte[] bytes, int offset, Charset charset) {
        CharsetDecoder decoder = charset.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        try {
            CharBuffer chars = decoder.decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset));
            return chars.toString();
        } catch (CharacterCodingException e) {
            return null;
        }
    }

    private static boolean looksBinary(byte[] bytes) {
        int sample = Math.min(bytes.length, 4096);
        int control = 0;
        for (int i = 0; i < sample; i++) {
            int b = bytes[i] & 0xFF;
            if (b == 0) return true;
            // 允许 \t \n \r，其余控制字符计入
            if (b < 0x20 && b != 0x09 && b != 0x0A && b != 0x0D) control++;
        }
        return control > sample * 0.02;
    }

    private static boolean hasUtf16Bom(byte[] bytes) {
        return bytes.length >= 2
                && (((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xFE)
                || ((bytes[0] & 0xFF) == 0xFE && (bytes[1] & 0xFF) == 0xFF));
    }
}