package com.agriweather.config;

import com.agriweather.weather.WeatherProperties;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

/**
 * 用 Redis 做缓存实现，让多个实例共享同一份天气缓存。
 *
 * 刻意用 String 序列化而不是 JSON/GenericJackson：
 *   - 值在 Redis 里是可直接阅读的 JSON，排障时 memurai-cli get 就能看
 *   - 避开 Jackson 默认类型信息（@class）带来的跨版本反序列化问题
 *
 * TTL 取「保底期」而非「新鲜期」：新鲜/过期的判断由 CachedWeather.fetchedAt 完成，
 * 这样过期数据还能在回源失败时兜底。
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory,
                                     WeatherProperties weatherProperties) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(weatherProperties.getStaleTtlSeconds()))
                .prefixCacheNameWith("agri:cache:")
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }
}
