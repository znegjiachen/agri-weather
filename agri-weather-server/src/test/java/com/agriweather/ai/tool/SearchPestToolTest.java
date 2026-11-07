package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.ai.AgriContext;
import com.agriweather.entity.PestKnowledge;
import com.agriweather.repository.PestKnowledgeRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SearchPestToolTest {

    private static final AgentContext<AgriContext> CTX =
            AgentContext.of(new AgriContext(42L));

    @Test
    @DisplayName("按名称关键词命中病虫害并返回防治信息")
    void findsByKeyword() {
        PestKnowledgeRepository repo = mock(PestKnowledgeRepository.class);
        when(repo.findAll()).thenReturn(List.of(
                pest("稻瘟病", "FUNGUS", "分蘖期、抽穗期"),
                pest("稻飞虱", "INSECT", "分蘖期")));

        SearchPestTool tool = new SearchPestTool(repo);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = (List<Map<String, Object>>) tool.execute(
                CTX, Map.of("keyword", "稻瘟", "pestType", ""));

        assertEquals(1, result.size());
        assertEquals("稻瘟病", result.get(0).get("pestName"));
        assertNotNull(result.get(0).get("controlMethod"));
        assertNotNull(result.get(0).get("recommendedPesticide"));
    }

    @Test
    @DisplayName("按病虫害类型过滤")
    void filtersByPestType() {
        PestKnowledgeRepository repo = mock(PestKnowledgeRepository.class);
        when(repo.findAll()).thenReturn(List.of(
                pest("稻瘟病", "FUNGUS", "分蘖期"),
                pest("稻飞虱", "INSECT", "分蘖期")));

        SearchPestTool tool = new SearchPestTool(repo);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = (List<Map<String, Object>>) tool.execute(
                CTX, Map.of("keyword", "", "pestType", "INSECT"));

        assertEquals(1, result.size());
        assertEquals("稻飞虱", result.get(0).get("pestName"));
    }

    @Test
    @DisplayName("空关键词返回常用病虫害，最多 8 条")
    void emptyKeywordReturnsCappedList() {
        PestKnowledgeRepository repo = mock(PestKnowledgeRepository.class);
        when(repo.findAll()).thenReturn(java.util.stream.IntStream.range(0, 12)
                .mapToObj(i -> pest("病害" + i, "FUNGUS", "苗期"))
                .toList());

        SearchPestTool tool = new SearchPestTool(repo);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = (List<Map<String, Object>>) tool.execute(
                CTX, Map.of("keyword", "", "pestType", ""));

        assertEquals(8, result.size());
    }

    @Test
    @DisplayName("没有匹配时返回可读提示而不是空数组")
    void noMatchReturnsMessage() {
        PestKnowledgeRepository repo = mock(PestKnowledgeRepository.class);
        when(repo.findAll()).thenReturn(List.of(pest("稻瘟病", "FUNGUS", "分蘖期")));

        SearchPestTool tool = new SearchPestTool(repo);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = (List<Map<String, Object>>) tool.execute(
                CTX, Map.of("keyword", "不存在的病虫害", "pestType", ""));

        assertEquals(1, result.size());
        assertTrue(String.valueOf(result.get(0).get("message")).contains("没有找到"));
    }

    private PestKnowledge pest(String name, String type, String stages) {
        PestKnowledge p = new PestKnowledge();
        p.setPestName(name);
        p.setPestType(type);
        p.setTriggerTempMin(20.0);
        p.setTriggerTempMax(30.0);
        p.setTriggerHumidityMin(80.0);
        p.setTriggerHumidityMax(95.0);
        p.setTriggerRainDays(3);
        p.setHighRiskStages(stages);
        p.setPrevention("选用抗病品种，合理密植");
        p.setControlMethod("发病初期及时用药");
        p.setRecommendedPesticide("按标签登记药剂使用");
        return p;
    }
}
