package com.agriweather.dto;

/** 本轮回答参考了哪些知识库文档 */
public record KnowledgeRef(Long docId, String title, double score) {
}