package com.agriweather.agent;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * 工具参数解析的通用工具。
 *
 * 和业务无关，纯粹把模型传来的 JSON 参数转成可用的值，并把错误信息写得让模型看得懂
 * —— 模型据此能自行修正参数重试。
 */
public final class ToolArgs {

    private ToolArgs() {
    }

    /** 解析模型传来的参数 JSON。空串/null 视为无参数 */
    public static Map<String, Object> parse(String json, ObjectMapper mapper) throws Exception {
        if (json == null || json.isBlank()) return Map.of();
        return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    }

    /** 取一个整数参数；缺失或格式不对时抛出可读错误 */
    public static Long argLong(Map<String, Object> args, String key) {
        Object v = args.get(key);
        if (v == null) throw new IllegalArgumentException("缺少参数：" + key);
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(v.toString().trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("参数 " + key + " 必须是整数，收到：" + v);
        }
    }

    /** 取一个字符串参数，缺失返回 null */
    public static String argStr(Map<String, Object> args, String key) {
        Object v = args.get(key);
        return v == null ? null : v.toString();
    }
}
