package com.agriweather.weather;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 天气外呼与缓存配置，对应 application.yml 的 app.weather 节点。
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.weather")
public class WeatherProperties {

    /** 上游预报接口 */
    private String baseUrl = "https://api.open-meteo.com";

    /** 建连超时（毫秒）—— 不加超时会让请求无限挂起 */
    private int connectTimeoutMs = 3000;

    /** 读超时（毫秒） */
    private int readTimeoutMs = 8000;

    /** 关掉后所有请求直连上游，用于排查缓存相关问题 */
    private boolean cacheEnabled = true;

    /** 新鲜期：这段时间内直接命中，不触发回源 */
    private long freshTtlSeconds = 1800;

    /** 保底期：超过新鲜期仍可作为降级数据返回；也是 Redis 中的实际 TTL */
    private long staleTtlSeconds = 86400;

    /** 缓存坐标精度：3 位小数约等于 110 米 */
    private int gridDecimals = 3;

    /** 预报天数 */
    private int forecastDays = 7;

    // ---------- 定时预取 ----------

    /** 是否启用定时预取 */
    private boolean prefetchEnabled = true;

    /** 预取间隔（毫秒），默认 20 分钟 */
    private long prefetchIntervalMs = 1_200_000;

    /** 启动后首次预取的延迟（毫秒），避开启动期的连接预热 */
    private long prefetchInitialDelayMs = 60_000;

    /** 单轮最多预取的坐标数，防止地块数量爆炸时打爆上游 */
    private int prefetchMaxCoords = 200;

    /** 两次外呼之间的间隔（毫秒），给上游留喘息 */
    private long prefetchSpacingMs = 250;

    /** 预取锁的持有时长（秒），防止某实例崩溃后锁永久占用 */
    private long prefetchLockTtlSeconds = 900;
}
