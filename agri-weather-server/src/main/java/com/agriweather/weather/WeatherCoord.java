package com.agriweather.weather;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/**
 * 归一化后的地理坐标。
 *
 * 存在的意义：缓存键和上游请求 URL 必须由**同一个**归一化结果生成，
 * 否则会出现「键是 30.27，请求却是 30.269999」这种永远命中不了的错位。
 */
public record WeatherCoord(double lat, double lng, int decimals) {

    public static WeatherCoord of(double lat, double lng, int decimals) {
        return new WeatherCoord(round(lat, decimals), round(lng, decimals), decimals);
    }

    /** 缓存键中的坐标部分 */
    public String key() {
        return String.format(Locale.ROOT, "%." + decimals + "f,%." + decimals + "f", lat, lng);
    }

    /** 拼进上游 URL 的坐标，精度与缓存键一致 */
    public String queryLat() {
        return String.format(Locale.ROOT, "%." + decimals + "f", lat);
    }

    public String queryLng() {
        return String.format(Locale.ROOT, "%." + decimals + "f", lng);
    }

    private static double round(double v, int decimals) {
        // -0.0 会格式化成 "-0.000"，与 "0.000" 生成不同缓存键，这里统一归一
        if (v == 0.0d) return 0.0d;
        return BigDecimal.valueOf(v).setScale(decimals, RoundingMode.HALF_UP).doubleValue();
    }
}
