package com.agriweather.service;

import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * 上传图片的校验与重编码。
 *
 * 不信任浏览器的 Content-Type 和文件名：
 * 先看魔数，再用 ImageIO 解码，最后重新编码写回——
 * 这样 EXIF、尾随数据、图片马等都会被丢掉，只留纯像素。
 */
@Component
public class CommunityImageProcessor {

    public static final long MAX_BYTES = 5L * 1024 * 1024;
    /** 解压炸弹防线：4000 万像素约 160MB ARGB，再大就有 OOM 风险 */
    private static final long MAX_PIXELS = 40_000_000L;
    private static final int MAX_SOURCE_SIDE = 10_000;
    private static final int MAX_OUTPUT_SIDE = 1600;
    private static final float JPEG_QUALITY = 0.85f;

    public record ProcessedImage(byte[] data, String mimeType, int width, int height) {
    }

    public ProcessedImage process(byte[] raw) {
        if (raw == null || raw.length == 0) {
            throw new IllegalArgumentException("请选择图片");
        }
        if (raw.length > MAX_BYTES) {
            throw new IllegalArgumentException("图片不能超过 5MB");
        }

        String sourceFormat = sniff(raw);
        BufferedImage decoded = read(raw, sourceFormat);

        int orientation = "jpeg".equals(sourceFormat) ? jpegOrientation(raw) : 1;
        BufferedImage oriented = applyOrientation(decoded, orientation);
        BufferedImage output = resize(oriented, MAX_OUTPUT_SIDE);

        boolean alpha = output.getColorModel().hasAlpha();
        String mime = alpha ? "image/png" : "image/jpeg";
        try {
            byte[] encoded = encode(output, mime);
            return new ProcessedImage(encoded, mime, output.getWidth(), output.getHeight());
        } catch (IOException e) {
            throw new IllegalArgumentException("图片处理失败，请换一张图片");
        }
    }

    // ---------------- 解码 ----------------

    private BufferedImage read(byte[] raw, String format) {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(raw))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("图片解析失败，请换一张图片");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0) {
                    throw new IllegalArgumentException("图片解析失败，请换一张图片");
                }
                if (width > MAX_SOURCE_SIDE || height > MAX_SOURCE_SIDE
                        || (long) width * height > MAX_PIXELS) {
                    throw new IllegalArgumentException("图片尺寸过大，请压缩后再上传");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("图片解析失败，请换一张图片");
        }
    }

    /** 只按文件头判断，不认文件名和浏览器给的 MIME */
    private String sniff(byte[] b) {
        if (b.length >= 3
                && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "jpeg";
        }
        if (b.length >= 8
                && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && (b[4] & 0xFF) == 0x0D && (b[5] & 0xFF) == 0x0A
                && (b[6] & 0xFF) == 0x1A && (b[7] & 0xFF) == 0x0A) {
            return "png";
        }
        throw new IllegalArgumentException("仅支持 JPG/PNG 图片");
    }

    // ---------------- EXIF 方向 ----------------

    /** 从 JPEG 的 APP1(Exif) 段读 Orientation；读不到按 1（正常）处理 */
    static int jpegOrientation(byte[] d) {
        int i = 2;
        while (i + 1 < d.length) {
            if ((d[i] & 0xFF) != 0xFF) {
                i++;
                continue;
            }
            int marker = d[i + 1] & 0xFF;
            if (marker == 0xFF) {
                i++;
                continue;
            }
            if (marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                i += 2;
                continue;
            }
            if (marker == 0xDA || marker == 0xD9 || i + 4 > d.length) {
                break;
            }
            int len = ((d[i + 2] & 0xFF) << 8) | (d[i + 3] & 0xFF);
            if (len < 2) {
                break;
            }
            int dataStart = i + 4;
            int dataEnd = i + 2 + len;
            if (marker == 0xE1 && dataEnd <= d.length && dataStart + 6 <= dataEnd
                    && d[dataStart] == 'E' && d[dataStart + 1] == 'x'
                    && d[dataStart + 2] == 'i' && d[dataStart + 3] == 'f'
                    && d[dataStart + 4] == 0 && d[dataStart + 5] == 0) {
                return tiffOrientation(d, dataStart + 6, dataEnd);
            }
            i = dataEnd;
        }
        return 1;
    }

    private static int tiffOrientation(byte[] d, int start, int limit) {
        if (start + 8 > limit) {
            return 1;
        }
        boolean little = d[start] == 'I' && d[start + 1] == 'I';
        boolean big = d[start] == 'M' && d[start + 1] == 'M';
        if (!little && !big) {
            return 1;
        }
        if (u16(d, start + 2, little) != 42) {
            return 1;
        }
        long ifd = start + u32(d, start + 4, little);
        if (ifd + 2 > limit) {
            return 1;
        }
        int count = u16(d, (int) ifd, little);
        long p = ifd + 2;
        for (int i = 0; i < count && p + 12 <= limit; i++, p += 12) {
            if (u16(d, (int) p, little) == 0x0112) {
                int value = u16(d, (int) p + 8, little);
                return (value >= 1 && value <= 8) ? value : 1;
            }
        }
        return 1;
    }

    private static int u16(byte[] d, int p, boolean little) {
        int a = d[p] & 0xFF;
        int b = d[p + 1] & 0xFF;
        return little ? (b << 8) | a : (a << 8) | b;
    }

    private static long u32(byte[] d, int p, boolean little) {
        long a = d[p] & 0xFFL;
        long b = d[p + 1] & 0xFFL;
        long c = d[p + 2] & 0xFFL;
        long e = d[p + 3] & 0xFFL;
        return little ? (e << 24) | (c << 16) | (b << 8) | a : (a << 24) | (b << 16) | (c << 8) | e;
    }

    // ---------------- 变换 ----------------

    private BufferedImage applyOrientation(BufferedImage src, int orientation) {
        if (orientation == 1) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = orientation >= 5;

        AffineTransform t = new AffineTransform();
        switch (orientation) {
            case 2 -> {
                t.translate(w, 0);
                t.scale(-1, 1);
            }
            case 3 -> {
                t.translate(w, h);
                t.rotate(Math.PI);
            }
            case 4 -> {
                t.translate(0, h);
                t.scale(1, -1);
            }
            case 5 -> {
                t.rotate(Math.PI / 2);
                t.scale(1, -1);
            }
            case 6 -> {
                t.translate(h, 0);
                t.rotate(Math.PI / 2);
            }
            case 7 -> {
                t.translate(h, w);
                t.rotate(-Math.PI / 2);
                t.scale(1, -1);
            }
            case 8 -> {
                t.translate(0, w);
                t.rotate(-Math.PI / 2);
            }
            default -> {
                return src;
            }
        }
        return draw(src, swap ? h : w, swap ? w : h, t);
    }

    private BufferedImage resize(BufferedImage src, int maxSide) {
        int w = src.getWidth();
        int h = src.getHeight();
        int max = Math.max(w, h);
        if (max <= maxSide) {
            return src;
        }
        double scale = (double) maxSide / max;
        int tw = Math.max(1, (int) Math.round(w * scale));
        int th = Math.max(1, (int) Math.round(h * scale));
        return draw(src, tw, th, null);
    }

    private BufferedImage draw(BufferedImage src, int width, int height, AffineTransform transform) {
        int type = src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage dst = new BufferedImage(width, height, type);
        Graphics2D g = dst.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            if (transform == null) {
                g.drawImage(src, 0, 0, width, height, null);
            } else {
                g.drawImage(src, transform, null);
            }
        } finally {
            g.dispose();
        }
        return dst;
    }

    private byte[] encode(BufferedImage img, String mime) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if ("image/png".equals(mime)) {
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        }

        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}