package com.agriweather.service;

import com.agriweather.dto.AuthRequest;
import com.agriweather.dto.AuthResponse;
import com.agriweather.dto.PasswordChangeRequest;
import com.agriweather.dto.ProfileUpdateRequest;
import com.agriweather.entity.SysUser;
import com.agriweather.repository.UserRepository;
import com.agriweather.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
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

        String token = jwtUtil.generateToken(user.getUsername(), user.getId(), user.getRole());
        return new AuthResponse(token, user.getUsername(), user.getRole(), user.getId(),
                user.getPhone(), user.getRegion());
    }

    public AuthResponse login(AuthRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        SysUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("密码错误");
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getId(), user.getRole());
        return new AuthResponse(token, user.getUsername(), user.getRole(), user.getId(),
                user.getPhone(), user.getRegion());
    }

    public Map<String, Object> getProfile(Long userId) {
        return toProfile(requireUser(userId));
    }

    @Transactional
    public Map<String, Object> updateProfile(Long userId, ProfileUpdateRequest request) {
        SysUser user = requireUser(userId);
        user.setPhone(trimToNull(request.getPhone()));
        user.setRegion(trimToNull(request.getRegion()));
        userRepository.save(user);
        return toProfile(user);
    }

    private Map<String, Object> toProfile(SysUser user) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("username", user.getUsername());
        result.put("role", user.getRole());
        result.put("userId", user.getId());
        result.put("phone", user.getPhone());
        result.put("region", user.getRegion());
        return result;
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

    private SysUser requireUser(Long userId) {
        if (userId == null) throw new IllegalArgumentException("登录已过期，请重新登录");
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}