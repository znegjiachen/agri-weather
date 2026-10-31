package com.agriweather.service;

import com.agriweather.service.FarmlandGeometry.Point;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FarmlandGeometryTest {

    private static final double SQ_METERS_PER_MU = 666.6666666667d;

    @Test
    void computesSmallSquareArea() {
        double d = 0.001; // 约 111m × 96m（北纬 30°）
        List<Point> square = List.of(
                new Point(30, 120),
                new Point(30, 120 + d),
                new Point(30 + d, 120 + d),
                new Point(30 + d, 120));

        double metersPerDegree = 111_194.9266;
        double expectedSquareMeters = metersPerDegree * d
                * metersPerDegree * d * Math.cos(Math.toRadians(30));
        double expectedMu = expectedSquareMeters / SQ_METERS_PER_MU;

        assertEquals(expectedMu, FarmlandGeometry.areaMu(square), 0.05);
    }

    @Test
    void orientationDoesNotChangeArea() {
        List<Point> clockwise = List.of(
                new Point(30, 120),
                new Point(30 + 0.001, 120),
                new Point(30 + 0.001, 120 + 0.001),
                new Point(30, 120 + 0.001));
        List<Point> counterClockwise = List.of(
                new Point(30, 120),
                new Point(30, 120 + 0.001),
                new Point(30 + 0.001, 120 + 0.001),
                new Point(30 + 0.001, 120));

        double area = FarmlandGeometry.areaMu(clockwise);
        assertTrue(area > 0);
        assertEquals(area, FarmlandGeometry.areaMu(counterClockwise), 0.0001);
    }

    @Test
    void returnsZeroForDegeneratePolygons() {
        assertEquals(0, FarmlandGeometry.areaMu(List.of()));
        assertEquals(0, FarmlandGeometry.areaMu(List.of(new Point(30, 120), new Point(31, 121))));
        assertEquals(0, FarmlandGeometry.areaMu(List.of(
                new Point(30, 120), new Point(30.001, 120.001), new Point(30.002, 120.002))));
    }
}