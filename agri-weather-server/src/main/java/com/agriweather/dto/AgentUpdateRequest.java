package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class AgentUpdateRequest {

    @NotBlank(message = "智能体名称不能为空")
    @Size(max = 100, message = "智能体名称不能超过 100 字")
    private String name;

    @Size(max = 500, message = "欢迎语不能超过 500 字")
    private String welcome;

    @NotBlank(message = "人设不能为空")
    @Size(max = 4000, message = "人设不能超过 4000 字")
    private String persona;

    @Size(max = 16, message = "头像不能超过 16 个字符")
    private String avatar;

    /** 启用的工具名；null 表示保持原配置，空数组会被拒绝 */
    private List<String> enabledTools;
}