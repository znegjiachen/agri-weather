package com.agriweather.utils;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                   @Value("${app.jwt.expiration-ms}") long expirationMs) {
        String value = secret == null ? "" : secret.trim();
        if (value.isEmpty()) {
            throw new IllegalStateException(
                    "未配置 JWT_SECRET：请通过环境变量注入至少 256 位的随机密钥"
                            + "（推荐 openssl rand -base64 32）");
        }
        // 兼容 Base64（推荐）与直接随机字符串；长度不足时回退到原始 UTF-8 字节
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(value);
        } catch (IllegalArgumentException e) {
            keyBytes = value.getBytes(StandardCharsets.UTF_8);
        }
        if (keyBytes.length < 32) {
            byte[] raw = value.getBytes(StandardCharsets.UTF_8);
            if (raw.length < 32) {
                throw new IllegalStateException(
                        "JWT_SECRET 长度不足 256 位，请使用 openssl rand -base64 32 重新生成");
            }
            keyBytes = raw;
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    public String generateToken(String username, Long userId, String role, int tokenVersion) {
        return Jwts.builder()
                .subject(username)
                .claim("userId", userId)
                .claim("role", role)
                .claim("ver", tokenVersion)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getUsername(String token) {
        return parseToken(token).getSubject();
    }

    public Long getUserId(String token) {
        return parseToken(token).get("userId", Long.class);
    }
}
