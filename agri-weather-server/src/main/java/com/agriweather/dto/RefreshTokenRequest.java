package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RefreshTokenRequest {

    @NotBlank(message = "缺少刷新令牌")
    private String refreshToken;
}