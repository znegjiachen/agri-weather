package com.agriweather.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileUpdateRequest {

    @Size(max = 20, message = "手机号不能超过 20 个字符")
    private String phone;

    @Size(max = 100, message = "所在地区不能超过 100 个字符")
    private String region;

    @Size(max = 255, message = "头像地址不能超过 255 个字符")
    private String avatar;
}