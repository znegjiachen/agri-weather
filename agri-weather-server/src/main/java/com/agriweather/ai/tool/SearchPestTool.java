package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.entity.PestKnowledge;
import com.agriweather.repository.PestKnowledgeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 检索病虫害知识库，返回气象阈值、防治方法和推荐药剂 */
@Component
@RequiredArgsConstructor
public class SearchPestTool implements Tool {

    private static final int MAX_RESULTS = 8;

    private final PestKnowledgeRepository pestRepository;

    @Override
    public String name() {
        return "search_pest";
    }

    @Override
    public String description() {
        return "检索病虫害知识库，返回病害/虫害的气象诱发条件、高危生育期、预防方法、防治方法和推荐药剂。"
                + "适合回答「稻瘟病怎么防」「最近天气容易发什么病」等问题。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of(
                "keyword", Map.of(
                        "type", "string",
                        "description", "病虫害名称或防治关键词，如「稻瘟病」「蚜虫」；传空字符串表示不按名称过滤"),
                "pestType", Map.of(
                        "type", "string",
                        "enum", List.of("INSECT", "FUNGUS", ""),
                        "description", "INSECT=虫害，FUNGUS=病害，空字符串=全部")
        );
    }

    @Override
    public Object execute(AgentContext<?> context, Map<String, Object> args) {
        String keyword = ToolArgs.argStr(args, "keyword");
        String pestType = ToolArgs.argStr(args, "pestType");
        String normalizedKeyword = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        String normalizedType = pestType == null ? "" : pestType.trim().toUpperCase(Locale.ROOT);

        List<PestKnowledge> matched = new ArrayList<>();
        for (PestKnowledge pest : pestRepository.findAll()) {
            if (!normalizedType.isEmpty() && !"ALL".equals(normalizedType)
                    && !normalizedType.equalsIgnoreCase(pest.getPestType())) {
                continue;
            }
            if (!normalizedKeyword.isEmpty() && !containsKeyword(pest, normalizedKeyword)) {
                continue;
            }
            matched.add(pest);
            if (matched.size() >= MAX_RESULTS) break;
        }

        if (matched.isEmpty()) {
            return List.of(Map.of("message",
                    "没有找到匹配的病虫害，请尝试更短的关键词，或传空字符串查看常用病虫害"));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (PestKnowledge pest : matched) {
            result.add(toBrief(pest));
        }
        return result;
    }

    private boolean containsKeyword(PestKnowledge pest, String keyword) {
        return contains(pest.getPestName(), keyword)
                || contains(pest.getHighRiskStages(), keyword)
                || contains(pest.getPrevention(), keyword)
                || contains(pest.getControlMethod(), keyword)
                || contains(pest.getPestType(), keyword);
    }

    private boolean contains(String text, String keyword) {
        return text != null && text.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, Object> toBrief(PestKnowledge pest) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("pestName", pest.getPestName());
        item.put("pestType", pest.getPestType());
        item.put("triggerTemp", pest.getTriggerTempMin() + "°C ~ " + pest.getTriggerTempMax() + "°C");
        item.put("triggerHumidity", pest.getTriggerHumidityMin() + "% ~ " + pest.getTriggerHumidityMax() + "%");
        item.put("triggerRainDays", pest.getTriggerRainDays());
        item.put("highRiskStages", pest.getHighRiskStages());
        item.put("prevention", pest.getPrevention());
        item.put("controlMethod", pest.getControlMethod());
        item.put("recommendedPesticide", pest.getRecommendedPesticide());
        item.put("notice", "药剂需按当地登记作物、标签剂量和安全间隔期使用");
        return item;
    }
}
