package com.agriweather.service;

import com.agriweather.dto.AuthRequest;
import com.agriweather.dto.AuthResponse;
import com.agriweather.dto.PasswordChangeRequest;
import com.agriweather.dto.ProfileUpdateRequest;
import com.agriweather.entity.RefreshToken;
import com.agriweather.entity.SysUser;
import com.agriweather.repository.RefreshTokenRepository;
import com.agriweather.repository.UserRepository;
import com.agriweather.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int REFRESH_DAYS = 30;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthResponse register(AuthRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        if (username.length() < 2 || username.length() > 30) {
            throw new IllegalArgumentException("用户名需为 2~30 个字符");
        }
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new IllegalArgumentException("密码至少 6 位");
        }
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("用户名已存在");
        }

        SysUser user = SysUser.builder()
                .username(username)
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(trimToNull(request.getPhone()))
                .region(trimToNull(request.getRegion()))
                .role("FARMER")
                .build();

        user = userRepository.save(user);
        return issueTokens(user);
    }

    public AuthResponse login(AuthRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        SysUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("密码错误");
        }
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new IllegalArgumentException("缺少刷新令牌");
        }
        String hash = hash(rawRefreshToken);
        RefreshToken token = refreshTokenRepository.findByTokenHashAndRevokedFalse(hash)
                .orElseThrow(() -> new IllegalArgumentException("刷新令牌无效，请重新登录"));

        if (token.getExpiresAt() == null || token.getExpiresAt().isBefore(LocalDateTime.now())) {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
            throw new IllegalArgumentException("登录已过期，请重新登录");
        }

        SysUser user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        // 轮换：旧 refresh token 立即作废
        token.setRevoked(true);
        refreshTokenRepository.save(token);
        return issueTokens(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        refreshTokenRepository.findByTokenHashAndRevokedFalse(hash(rawRefreshToken))
                .ifPresent(token -> {
                    token.setRevoked(true);
                    refreshTokenRepository.save(token);
                });
    }

    /** 递增 tokenVersion + 吊销全部 refresh token，旧 access token 也立即失效 */
    @Transactional
    public void logoutAll(Long userId) {
        SysUser user = requireUser(userId);
        user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    public Map<String, Object> getProfile(Long userId) {
        return toProfile(requireUser(userId));
    }

    public void verifyPassword(Long userId, String password) {
        SysUser user = requireUser(userId);
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("密码不正确");
        }
    }

    @Transactional
    public Map<String, Object> updateProfile(Long userId, ProfileUpdateRequest request) {
        SysUser user = requireUser(userId);
        // 允许只改头像：未提交的字段保持原值，提交空串才清空
        if (request.getPhone() != null) user.setPhone(trimToNull(request.getPhone()));
        if (request.getRegion() != null) user.setRegion(trimToNull(request.getRegion()));
        if (request.getAvatar() != null) user.setAvatar(trimToNull(request.getAvatar()));
        userRepository.save(user);
        return toProfile(user);
    }

    @Transactional
    public void changePassword(Long userId, PasswordChangeRequest request) {
        SysUser user = requireUser(userId);
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new IllegalArgumentException("原密码不正确");
        }
        if (request.getNewPassword().equals(request.getOldPassword())) {
            throw new IllegalArgumentException("新密码不能与原密码相同");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    private AuthResponse issueTokens(SysUser user) {
        int version = user.getTokenVersion() == null ? 0 : user.getTokenVersion();
        String accessToken = jwtUtil.generateToken(
                user.getUsername(), user.getId(), user.getRole(), version);
        String refreshToken = createRefreshToken(user.getId());
        return new AuthResponse(accessToken, user.getUsername(), user.getRole(), user.getId(),
                user.getPhone(), user.getRegion(), user.getAvatar(), refreshToken);
    }

    private String createRefreshToken(Long userId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken token = new RefreshToken();
        token.setUserId(userId);
        token.setTokenHash(hash(raw));
        token.setExpiresAt(LocalDateTime.now().plusDays(REFRESH_DAYS));
        token.setRevoked(false);
        refreshTokenRepository.save(token);
        return raw;
    }

    private String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("刷新令牌处理失败", e);
        }
    }

    private SysUser requireUser(Long userId) {
        if (userId == null) throw new IllegalArgumentException("登录已过期，请重新登录");
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private Map<String, Object> toProfile(SysUser user) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("username", user.getUsername());
        result.put("role", user.getRole());
        result.put("userId", user.getId());
        result.put("phone", user.getPhone());
        result.put("region", user.getRegion());
        result.put("avatar", user.getAvatar());
        return result;
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}