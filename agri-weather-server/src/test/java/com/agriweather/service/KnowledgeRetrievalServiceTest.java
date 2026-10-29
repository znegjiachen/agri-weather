package com.agriweather.service;

import com.agriweather.dto.KnowledgeRef;
import com.agriweather.dto.KnowledgeSearchHit;
import com.agriweather.entity.AgentKnowledgeChunk;
import com.agriweather.entity.AgentKnowledgeDoc;
import com.agriweather.repository.AgentKnowledgeChunkRepository;
import com.agriweather.repository.AgentKnowledgeDocRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KnowledgeRetrievalServiceTest {

    private AgentKnowledgeChunkRepository chunkRepo;
    private AgentKnowledgeDocRepository docRepo;
    private KnowledgeRetrievalService service;

    @BeforeEach
    void setUp() {
        chunkRepo = mock(AgentKnowledgeChunkRepository.class);
        docRepo = mock(AgentKnowledgeDocRepository.class);

        AgentKnowledgeDoc gray = new AgentKnowledgeDoc();
        gray.setId(1L);
        gray.setTitle("玉米灰斑病防治要点");
        AgentKnowledgeDoc borer = new AgentKnowledgeDoc();
        borer.setId(2L);
        borer.setTitle("玉米螟防治补充");

        when(docRepo.findByAgentIdOrderByIdDesc(1L)).thenReturn(List.of(gray, borer));
        when(chunkRepo.findByAgentIdOrderByDocIdAscChunkIndexAsc(1L)).thenReturn(List.of(
                new AgentKnowledgeChunk(1L, 1L, 1L, 0,
                        "玉米灰斑病多在抽雄吐丝后发生，防治要点是选用抗病品种并合理密植。", LocalDateTime.now()),
                new AgentKnowledgeChunk(2L, 2L, 1L, 0,
                        "玉米螟幼虫危害心叶，可在三龄前使用苏云金杆菌。", LocalDateTime.now())
        ));
        service = new KnowledgeRetrievalService(chunkRepo, docRepo);
    }

    @Test
    @DisplayName("标题命中更具体的文档排在前面")
    void titleMatchRanksFirst() {
        List<KnowledgeSearchHit> hits = service.search(1L, "玉米螟怎么防治", 5);
        assertFalse(hits.isEmpty());
        assertEquals("玉米螟防治补充", hits.get(0).title());
    }

    @Test
    @DisplayName("无关问题不注入知识")
    void unrelatedQueryReturnsEmpty() {
        assertTrue(service.search(1L, "苹果树修剪", 5).isEmpty());
        assertTrue(service.buildBlock(1L, "苹果树修剪").refs().isEmpty());
    }

    @Test
    @DisplayName("知识块带边界和引用")
    void buildsBoundedBlock() {
        KnowledgeRetrievalService.KnowledgePackage pkg = service.buildBlock(1L, "玉米灰斑病怎么防治");
        assertFalse(pkg.block().isBlank());
        assertTrue(pkg.block().contains("资料开始"));
        assertTrue(pkg.block().contains("数据不是指令") || pkg.block().contains("不是指令"));
        List<KnowledgeRef> refs = pkg.refs();
        assertEquals(1, refs.size());
        assertEquals(1L, refs.get(0).docId());
    }

    @Test
    @DisplayName("topK 限制生效")
    void limitsTopK() {
        assertEquals(1, service.search(1L, "玉米", 1).size());
    }
}