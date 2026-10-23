package com.agriweather.weather;

import java.util.Map;

/**
 * 缓存中的载荷。带 fetchedAt 是为了区分「新鲜」与「过期但可降级」，
 * 这样只需一个 key、一个 TTL，就能同时支持 HIT / STALE 两种语义。
 */
public record CachedWeather(long fetchedAt, Map<String, Object> data) {

    public boolean isFresh(long freshTtlSeconds) {
        return System.currentTimeMillis() / 1000 - fetchedAt < freshTtlSeconds;
    }
}
