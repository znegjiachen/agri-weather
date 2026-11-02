package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeleteAccountRequest {

    @NotBlank(message = "请输入密码确认注销")
    private String password;
}