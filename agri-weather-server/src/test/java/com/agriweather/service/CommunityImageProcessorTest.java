package com.agriweather.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class CommunityImageProcessorTest {

    private final CommunityImageProcessor processor = new CommunityImageProcessor();

    @Test
    @DisplayName("超过最长边 1600 的图片会被等比缩放")
    void resizesWideImage() throws IOException {
        byte[] png = png(3000, 1000, false);

        CommunityImageProcessor.ProcessedImage result = processor.process(png);

        assertEquals(1600, result.width());
        assertEquals(533, result.height());
        assertEquals("image/jpeg", result.mimeType(), "不透明图重编码为 JPEG");
        assertTrue(result.data().length > 0);
        assertNotNull(ImageIO.read(new ByteArrayInputStream(result.data())));
    }

    @Test
    @DisplayName("小图不放大，透明 PNG 保持 PNG")
    void keepsSmallTransparentImageAsPng() throws IOException {
        byte[] png = png(192, 192, true);

        CommunityImageProcessor.ProcessedImage result = processor.process(png);

        assertEquals(192, result.width());
        assertEquals(192, result.height());
        assertEquals("image/png", result.mimeType());
        assertTrue(ImageIO.read(new ByteArrayInputStream(result.data()))
                .getColorModel().hasAlpha());
    }

    @Test
    @DisplayName("伪装成 png 的文本按魔数拒绝")
    void rejectsNonImageBytes() {
        byte[] fake = "not an image".getBytes();
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> processor.process(fake));
        assertTrue(e.getMessage().contains("JPG/PNG"));
    }

    @Test
    @DisplayName("超过 5MB 直接拒绝")
    void rejectsOversizedFile() {
        byte[] huge = new byte[(int) CommunityImageProcessor.MAX_BYTES + 1];
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> processor.process(huge));
        assertTrue(e.getMessage().contains("5MB"));
    }

    @Test
    @DisplayName("空文件拒绝")
    void rejectsEmpty() {
        assertThrows(IllegalArgumentException.class, () -> processor.process(new byte[0]));
    }

    private static byte[] png(int width, int height, boolean alpha) throws IOException {
        int type = alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage image = new BufferedImage(width, height, type);
        Graphics2D g = image.createGraphics();
        try {
            g.setColor(alpha ? new Color(20, 120, 40, 120) : new Color(20, 120, 40));
            g.fillRect(0, 0, width, height);
            g.setColor(Color.WHITE);
            g.fillOval(width / 4, height / 4, width / 2, height / 2);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}