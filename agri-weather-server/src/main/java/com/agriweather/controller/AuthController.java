package com.agriweather.controller;

import com.agriweather.dto.AuthRequest;
import com.agriweather.dto.AuthResponse;
import com.agriweather.dto.DeleteAccountRequest;
import com.agriweather.dto.PasswordChangeRequest;
import com.agriweather.dto.ProfileUpdateRequest;
import com.agriweather.dto.RefreshTokenRequest;
import com.agriweather.service.AccountDeletionService;
import com.agriweather.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AccountDeletionService accountDeletionService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.register(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** 用 refresh token 换新 access token，并轮换 refresh token */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@Valid @RequestBody RefreshTokenRequest body) {
        try {
            return ResponseEntity.ok(authService.refresh(body.getRefreshToken()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /** 退出当前设备：吊销 refresh token */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@Valid @RequestBody RefreshTokenRequest body) {
        authService.logout(body.getRefreshToken());
        return ResponseEntity.ok(Map.of("message", "已退出登录"));
    }

    /** 退出全部设备：refresh token 全部吊销，旧 access token 因版本号失效 */
    @PostMapping("/logout-all")
    public ResponseEntity<?> logoutAll(HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) return unauthorized();
        try {
            authService.logoutAll(userId);
            return ResponseEntity.ok(Map.of("message", "已退出全部设备"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** 注销账号：密码确认后清理全部个人数据 */
    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(@Valid @RequestBody DeleteAccountRequest body,
                                           HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) return unauthorized();
        try {
            authService.verifyPassword(userId, body.getPassword());
            accountDeletionService.deleteAccount(userId);
            return ResponseEntity.ok(Map.of("message", "账号已注销"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<?> profile(HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) return unauthorized();
        try {
            return ResponseEntity.ok(authService.getProfile(userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@Valid @RequestBody ProfileUpdateRequest body,
                                           HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) return unauthorized();
        try {
            return ResponseEntity.ok(authService.updateProfile(userId, body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody PasswordChangeRequest body,
                                            HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) return unauthorized();
        try {
            authService.changePassword(userId, body);
            return ResponseEntity.ok(Map.of("message", "密码已修改"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Long currentUserId(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "登录已过期，请重新登录"));
    }
}