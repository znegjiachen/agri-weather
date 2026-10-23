package com.agriweather.weather;

/**
 * 上游天气服务不可用且没有可降级数据时抛出，由全局异常处理器转成 503。
 */
public class WeatherUnavailableException extends RuntimeException {

    public WeatherUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
