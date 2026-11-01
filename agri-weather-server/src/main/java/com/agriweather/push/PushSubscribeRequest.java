package com.agriweather.push;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PushSubscribeRequest {

    @NotBlank(message = "缺少推送地址")
    @Size(max = 500, message = "推送地址过长")
    private String endpoint;

    @NotBlank(message = "缺少推送公钥")
    @Size(max = 255, message = "推送公钥过长")
    private String p256dh;

    @NotBlank(message = "缺少推送 auth")
    @Size(max = 255, message = "推送 auth 过长")
    private String auth;

    @Size(max = 255, message = "User-Agent 过长")
    private String userAgent;
}