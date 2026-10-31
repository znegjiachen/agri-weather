package com.agriweather.service;

import java.util.List;

/**
 * 地块几何计算。
 *
 * 把 WGS84 经纬度投影到以多边形平均纬度为中心的等距平面，再用鞋带公式求面积。
 * 地块通常只有几亩到几百亩，这个近似的误差远小于 GPS 本身的精度。
 */
public final class FarmlandGeometry {

    private static final double EARTH_RADIUS_M = 6_371_000d;
    private static final double SQ_METERS_PER_MU = 666.6666666667d;

    private FarmlandGeometry() {
    }

    public record Point(double lat, double lng) {
    }

    /** @return 面积（亩）；点数不足 3 或图形退化时返回 0 */
    public static double areaMu(List<Point> points) {
        if (points == null || points.size() < 3) return 0;

        double meanLat = 0;
        for (Point point : points) meanLat += point.lat();
        meanLat /= points.size();

        double cosLat = Math.cos(Math.toRadians(meanLat));
        double sum = 0;
        for (int i = 0; i < points.size(); i++) {
            Point a = points.get(i);
            Point b = points.get((i + 1) % points.size());
            double x1 = Math.toRadians(a.lng()) * cosLat * EARTH_RADIUS_M;
            double y1 = Math.toRadians(a.lat()) * EARTH_RADIUS_M;
            double x2 = Math.toRadians(b.lng()) * cosLat * EARTH_RADIUS_M;
            double y2 = Math.toRadians(b.lat()) * EARTH_RADIUS_M;
            sum += x1 * y2 - x2 * y1;
        }

        double squareMeters = Math.abs(sum) / 2d;
        return squareMeters / SQ_METERS_PER_MU;
    }
}