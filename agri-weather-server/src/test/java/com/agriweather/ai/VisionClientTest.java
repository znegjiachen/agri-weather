package com.agriweather.ai;

import com.agriweather.dto.AgentVisionResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VisionClientTest {

    @Test
    @DisplayName("解析视觉模型返回的 JSON，允许 markdown 代码块")
    void parsesStructuredJson() {
        String raw = """
                ```json
                {
                  "plantName": "番茄",
                  "scientificName": "Solanum lycopersicum",
                  "growthStage": "结果期",
                  "healthStatus": "明显异常",
                  "issues": [
                    {
                      "type": "disease",
                      "name": "早疫病",
                      "confidence": 0.82,
                      "symptoms": "下部叶片出现同心轮纹褐斑",
                      "suggestion": "摘除病叶，改善通风"
                    }
                  ],
                  "overallAssessment": "疑似早疫病早期。",
                  "careAdvice": ["减少叶面浇水", "按标签使用登记药剂"]
                }
                ```
                """;

        AgentVisionResponse result = VisionClient.parse(raw, "vision-model", 2);

        assertEquals("番茄", result.plantName());
        assertEquals("结果期", result.growthStage());
        assertEquals("明显异常", result.healthStatus());
        assertEquals(1, result.issues().size());
        assertEquals("早疫病", result.issues().get(0).name());
        assertEquals(0.82, result.issues().get(0).confidence());
        assertEquals(2, result.careAdvice().size());
        assertEquals(2, result.imageCount());
        assertEquals("vision-model", result.model());
    }

    @Test
    @DisplayName("模型没按 JSON 输出时退化为纯文本结论，而不是抛错")
    void fallsBackToPlainText() {
        AgentVisionResponse result = VisionClient.parse("图片太模糊，无法判断。", "vision-model", 1);

        assertEquals("未识别", result.plantName());
        assertEquals("无法判断", result.healthStatus());
        assertTrue(result.overallAssessment().contains("无法判断"));
        assertTrue(result.issues().isEmpty());
    }

    @Test
    @DisplayName("无病害时 issues 为空数组")
    void handlesHealthyPlant() {
        String raw = """
                {"plantName":"水稻","growthStage":"苗期","healthStatus":"健康","issues":[],
                 "overallAssessment":"叶片颜色正常。","careAdvice":["保持浅水层"]}
                """;

        AgentVisionResponse result = VisionClient.parse(raw, "vision-model", 1);

        assertEquals("水稻", result.plantName());
        assertEquals("健康", result.healthStatus());
        assertTrue(result.issues().isEmpty());
        assertEquals(1, result.careAdvice().size());
    }
}