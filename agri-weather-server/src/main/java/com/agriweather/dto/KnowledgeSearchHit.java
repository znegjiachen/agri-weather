package com.agriweather.dto;

/** 控制台「检索测试」的命中片段 */
public record KnowledgeSearchHit(Long docId, String title, String snippet, double score) {
}