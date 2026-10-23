package com.agriweather.weather;

import java.util.Map;

/**
 * 一次天气读取的结果：原始预报数据 + 数据来源。
 *
 * 刻意只含「天气」，不含地块名/作物名 —— 那些是按地块变化的，
 * 混进来会导致不同用户共享同一份缓存时串数据。
 */
public record WeatherFetch(Map<String, Object> data, WeatherCacheStatus status) {
}
