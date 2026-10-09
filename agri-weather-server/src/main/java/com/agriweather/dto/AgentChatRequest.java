package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AgentChatRequest {

    @NotBlank(message = "消息内容不能为空")
    @Size(max = 2000, message = "单条消息过长，请控制在 2000 字以内")
    private String message;

    /** 历史对话，元素形如 {"role":"user","content":"..."} */
    private List<Map<String, String>> history;
}
