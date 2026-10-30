package com.agriweather.service;

import com.agriweather.ai.EmbeddingProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EmbeddingServiceTest {

    private EmbeddingService localService() {
        EmbeddingProperties properties = new EmbeddingProperties();
        return new EmbeddingService(properties, new ObjectMapper());
    }

    @Test
    @DisplayName("未配置外部服务时使用本地向量")
    void localMode() {
        EmbeddingService service = localService();
        assertFalse(service.isExternalConfigured());
        assertEquals(EmbeddingService.LOCAL_MODEL, service.modelName());
        float[] vector = service.embed("玉米灰斑病防治");
        assertEquals(384, vector.length);
        double norm = 0;
        for (float v : vector) norm += v * v;
        assertEquals(1.0, norm, 0.0001);
    }

    @Test
    @DisplayName("相关文本的本地余弦相似度高于无关文本")
    void localSimilarity() {
        EmbeddingService service = localService();
        float[] query = service.embed("玉米螟怎么防治");
        float[] related = service.embed("玉米螟幼虫危害心叶，防治要趁早");
        float[] unrelated = service.embed("苹果树冬季修剪方法");
        assertTrue(EmbeddingService.cosine(query, related) > EmbeddingService.cosine(query, unrelated));
    }

    @Test
    @DisplayName("向量序列化可往返")
    void serializeRoundTrip() {
        float[] vector = {0.1f, -0.2f, 0.3f};
        float[] restored = EmbeddingService.fromBytes(EmbeddingService.toBytes(vector));
        assertArrayEquals(vector, restored);
    }
}