package com.agriweather.weather;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 天气缓存的运行时指标。进程内计数，随实例重启归零。
 *
 * 命中率 = hits / (hits + misses)，bypass 表示缓存层不可用、本次直连，不计入分母。
 */
@Component
public class WeatherCacheMetrics {

    private final AtomicLong hits = new AtomicLong();
    private final AtomicLong misses = new AtomicLong();
    private final AtomicLong staleHits = new AtomicLong();
    private final AtomicLong bypasses = new AtomicLong();
    private final AtomicLong upstreamFailures = new AtomicLong();

    public void hit() {
        hits.incrementAndGet();
    }

    public void miss() {
        misses.incrementAndGet();
    }

    public void staleHit() {
        staleHits.incrementAndGet();
    }

    public void bypass() {
        bypasses.incrementAndGet();
    }

    public void upstreamFailure() {
        upstreamFailures.incrementAndGet();
    }

    public Map<String, Object> snapshot() {
        long h = hits.get();
        long m = misses.get();
        long total = h + m;
        double hitRate = total == 0 ? 0.0 : Math.round(h * 10000.0 / total) / 100.0;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hits", h);
        out.put("misses", m);
        out.put("hitRatePercent", hitRate);
        out.put("staleHits", staleHits.get());
        out.put("bypasses", bypasses.get());
        out.put("upstreamFailures", upstreamFailures.get());
        out.put("formula", "hitRate = hits / (hits + misses)");
        return out;
    }

    public void reset() {
        hits.set(0);
        misses.set(0);
        staleHits.set(0);
        bypasses.set(0);
        upstreamFailures.set(0);
    }
}
