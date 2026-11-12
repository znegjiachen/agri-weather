package com.agriweather.config;

import com.agriweather.repository.UserRepository;
import com.agriweather.utils.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // 从环境变量 CORS_ORIGINS 读取允许的域名，逗号分隔
        // 未设置时默认允许本地开发地址
        String corsOrigins = System.getenv("CORS_ORIGINS");
        List<String> allowedOrigins;
        if (corsOrigins != null && !corsOrigins.isBlank()) {
            allowedOrigins = List.of(corsOrigins.split(","));
        } else {
            // 本地开发常用 localhost 和 127.0.0.1 两种写法，浏览器会把 Origin 原样带上；
            // 只放行 localhost 时，用 127.0.0.1 打开前端会收到 403 Invalid CORS request。
            allowedOrigins = List.of("http://localhost:*", "http://127.0.0.1:*");
        }

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtUtil jwtUtil,
                                          UserRepository userRepository,
                                          StringRedisTemplate redis,
                                          RateLimitProperties rateLimitProperties) throws Exception {
        RateLimitFilter rateLimitFilter = new RateLimitFilter(redis, rateLimitProperties);
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .anyRequest().permitAll()
            )
            .addFilterBefore(new JwtAuthFilter(jwtUtil, userRepository), UsernamePasswordAuthenticationFilter.class)
            // JWT 先行，限流才能按 userId 而不是 IP 计数
            .addFilterAfter(rateLimitFilter, JwtAuthFilter.class);

        return http.build();
    }

    static class JwtAuthFilter extends OncePerRequestFilter {
        private final JwtUtil jwtUtil;
        private final UserRepository userRepository;

        JwtAuthFilter(JwtUtil jwtUtil, UserRepository userRepository) {
            this.jwtUtil = jwtUtil;
            this.userRepository = userRepository;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request,
                                        HttpServletResponse response,
                                        FilterChain chain) throws ServletException, IOException {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                try {
                    var claims = jwtUtil.parseToken(header.substring(7));
                    Long userId = claims.get("userId", Long.class);
                    Integer tokenVersion = claims.get("ver", Integer.class);
                    var user = userId == null ? null
                            : userRepository.findById(userId).orElse(null);
                    int currentVersion = user == null || user.getTokenVersion() == null
                            ? 0 : user.getTokenVersion();
                    int tokenVer = tokenVersion == null ? 0 : tokenVersion;
                    if (user != null && tokenVer == currentVersion) {
                        request.setAttribute("userId", userId);
                        request.setAttribute("username", claims.getSubject());
                        request.setAttribute("role", claims.get("role", String.class));
                    } else {
                        request.setAttribute("authError", "登录已过期，请重新登录");
                    }
                } catch (Exception e) {
                    // Token存在但无效/过期，标记错误供需要认证的接口使用
                    request.setAttribute("authError", "登录已过期，请重新登录");
                }
            }
            chain.doFilter(request, response);
        }
    }
}
