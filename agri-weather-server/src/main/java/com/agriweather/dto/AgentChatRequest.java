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

    /** 视觉模型对用户照片的识别结果，后端会拼进本轮用户消息 */
    @Size(max = 6000, message = "图片识别结果过长")
    private String visionContext;

    /** 结构化图片识别结果，用于持久化历史（可选） */
    @Size(max = 20000, message = "图片识别结果过长")
    private String visionJson;

    /** 用户在对话里上传的文档名称（可选） */
    @Size(max = 255, message = "文档名称过长")
    private String documentName;

    /** 用户在对话里上传的文档正文，作为本轮资料注入（可选） */
    @Size(max = 30000, message = "文档内容过长，请截取关键部分")
    private String documentContext;

    /** 地块专属助农手 ID；与 farmlandId 至少提供一个即可 */
    private Long agentId;

    /** 当前地块 ID；没有 agentId 时后端会按地块自动定位智能体 */
    private Long farmlandId;
}
