package com.agriweather.weather;

/**
 * 一次天气读取的数据来源，会写进响应头 X-Weather-Cache，便于验证缓存效果。
 */
public enum WeatherCacheStatus {
    /** 命中新鲜缓存，未回源 */
    HIT,
    /** 缓存过期且回源成功 */
    MISS,
    /** 缓存过期且回源失败，返回旧数据兜底 */
    STALE,
    /** 缓存不可用（Redis 故障或已关闭），直连上游 */
    BYPASS
}
