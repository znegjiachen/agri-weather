package com.agriweather.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileUpdateRequest {

    @Size(max = 20, message = "手机号不能超过 20 个字符")
    private String phone;

    @Size(max = 100, message = "所在地区不能超过 100 个字符")
    private String region;
}