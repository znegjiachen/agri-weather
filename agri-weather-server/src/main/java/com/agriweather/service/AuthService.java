package com.agriweather.service;

import com.agriweather.dto.AuthRequest;
import com.agriweather.dto.AuthResponse;
import com.agriweather.entity.SysUser;
import com.agriweather.repository.UserRepository;
import com.agriweather.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }

        SysUser user = SysUser.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .region(request.getRegion())
                .role("FARMER")
                .build();

        user = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getUsername(), user.getId(), user.getRole());
        return new AuthResponse(token, user.getUsername(), user.getRole(), user.getId());
    }

    public AuthResponse login(AuthRequest request) {
        SysUser user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("密码错误");
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getId(), user.getRole());
        return new AuthResponse(token, user.getUsername(), user.getRole(), user.getId());
    }
}
