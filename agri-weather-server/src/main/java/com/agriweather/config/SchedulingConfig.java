package com.agriweather.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 开启定时任务（天气预取） */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
