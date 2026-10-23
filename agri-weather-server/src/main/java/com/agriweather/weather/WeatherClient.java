package com.agriweather.weather;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;

/**
 * 按经纬度获取天气预报的唯一入口。
 *
 * 只产出「天气」本身，不掺地块名、作物名 —— 那些随地块变化，
 * 混进来会让不同用户共享同一份缓存时串数据。
 *
 * 缓存语义（单 key + 一个 TTL 实现两级）：
 *   新鲜期内            → HIT，不回源
 *   超过新鲜期但未过期  → 回源；成功则刷新，失败则返回旧数据降级为 STALE
 *   无缓存且回源失败    → 抛 WeatherUnavailableException（转 503）
 *   缓存层不可用        → BYPASS，直连上游，接口照常可用
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherClient {

    private static final String CACHE_NAME = "weather";

    /** 载荷结构变更时递增，避免旧 JSON 反序列化失败 */
    private static final String KEY_PREFIX = "v1:";

    private final WeatherProperties props;
    private final ObjectMapper mapper;
    private final ObjectProvider<CacheManager> cacheManagerProvider;
    private final WeatherCacheMetrics metrics;

    private volatile HttpClient http;

    public WeatherFetch fetch(double lat, double lng) {
        return fetch(lat, lng, false);
    }

    /**
     * @param forceRefresh 为 true 时跳过新鲜期判断强制回源（预取任务用；否则到期前全是 HIT，刷新没有意义）
     */
    public WeatherFetch fetch(double lat, double lng, boolean forceRefresh) {
        WeatherCoord coord = WeatherCoord.of(lat, lng, props.getGridDecimals());
        String cacheKey = KEY_PREFIX + coord.key();

        Lookup lookup = lookup(cacheKey);
        if (!lookup.available()) {
            metrics.bypass();
        }

        if (!forceRefresh && lookup.entry() != null && lookup.entry().isFresh(props.getFreshTtlSeconds())) {
            metrics.hit();
            return new WeatherFetch(lookup.entry().data(), WeatherCacheStatus.HIT);
        }

        metrics.miss();
        try {
            Map<String, Object> fresh = callUpstream(coord);
            store(cacheKey, fresh);
            return new WeatherFetch(
                    fresh,
                    lookup.available() ? WeatherCacheStatus.MISS : WeatherCacheStatus.BYPASS);
        } catch (Exception e) {
            metrics.upstreamFailure();
            if (lookup.entry() != null) {
                metrics.staleHit();
                log.warn("天气回源失败，返回过期缓存兜底 coord={} : {}", coord.key(), e.getMessage());
                return new WeatherFetch(lookup.entry().data(), WeatherCacheStatus.STALE);
            }
            throw new WeatherUnavailableException("天气服务暂时不可用", e);
        }
    }

    private record Lookup(boolean available, CachedWeather entry) {
    }

    private Lookup lookup(String key) {
        Cache cache = cache();
        if (cache == null) return new Lookup(false, null);
        try {
            String json = cache.get(key, String.class);
            if (json == null) return new Lookup(true, null);
            return new Lookup(true, mapper.readValue(json, CachedWeather.class));
        } catch (Exception e) {
            // Redis 挂了 / 载荷格式不兼容：本次降级直连，绝不让缓存故障影响接口
            log.warn("读取天气缓存失败，本次降级直连: {}", e.getMessage());
            return new Lookup(false, null);
        }
    }

    private void store(String key, Map<String, Object> data) {
        Cache cache = cache();
        if (cache == null) return;
        try {
            CachedWeather payload = new CachedWeather(Instant.now().getEpochSecond(), data);
            cache.put(key, mapper.writeValueAsString(payload));
        } catch (Exception e) {
            // 写缓存失败不影响本次返回
            log.warn("写入天气缓存失败: {}", e.getMessage());
        }
    }

    private Cache cache() {
        if (!props.isCacheEnabled()) return null;
        CacheManager manager = cacheManagerProvider.getIfAvailable();
        return manager == null ? null : manager.getCache(CACHE_NAME);
    }

    private Map<String, Object> callUpstream(WeatherCoord c) throws Exception {
        String url = String.format(
                Locale.ROOT,
                "%s/v1/forecast?latitude=%s&longitude=%s"
                        + "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility,surface_pressure"
                        + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
                        + "&timezone=auto&forecast_days=%d",
                props.getBaseUrl(), c.queryLat(), c.queryLng(), props.getForecastDays());

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("上游返回 HTTP " + response.statusCode());
        }
        return mapper.readValue(response.body(), new TypeReference<Map<String, Object>>() {
        });
    }

    private HttpClient client() {
        HttpClient c = http;
        if (c == null) {
            synchronized (this) {
                if (http == null) {
                    http = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
                            .followRedirects(HttpClient.Redirect.NORMAL)
                            .build();
                }
                c = http;
            }
        }
        return c;
    }
}
