package com.agriweather.ai.tool;

/** WMO 天气代码 → 中文描述（与前端 weatherCodes.js 保持一致） */
public final class WeatherCodes {

    private WeatherCodes() {
    }

    public static String text(Integer code) {
        if (code == null) return "未知";
        return switch (code) {
            case 0 -> "晴";
            case 1 -> "少云";
            case 2 -> "多云";
            case 3 -> "阴";
            case 45, 48 -> "雾";
            case 51, 53, 55 -> "毛毛雨";
            case 56, 57 -> "冻毛毛雨";
            case 61 -> "小雨";
            case 63 -> "中雨";
            case 65 -> "大雨";
            case 66, 67 -> "冻雨";
            case 71 -> "小雪";
            case 73 -> "中雪";
            case 75 -> "大雪";
            case 77 -> "雪粒";
            case 80 -> "小阵雨";
            case 81 -> "中阵雨";
            case 82 -> "强阵雨";
            case 85, 86 -> "阵雪";
            case 95 -> "雷暴";
            case 96, 99 -> "雷暴伴冰雹";
            default -> "未知";
        };
    }
}
