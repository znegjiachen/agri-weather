package com.agriweather.service;

import com.agriweather.controller.ResourceNotFoundException;
import com.agriweather.dto.KnowledgeDocDetail;
import com.agriweather.dto.KnowledgeDocView;
import com.agriweather.dto.KnowledgeSearchHit;
import com.agriweather.entity.AgentKnowledgeChunk;
import com.agriweather.entity.AgentKnowledgeDoc;
import com.agriweather.repository.AgentKnowledgeChunkRepository;
import com.agriweather.repository.AgentKnowledgeDocRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 智能体知识库的读写。
 *
 * 文档只存提取后的文本；片段用于检索。所有入口都先校验智能体归属。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentKnowledgeService {

    private static final int MAX_EMBED_CHUNKS = 200;

    public static final int MAX_DOCS = 20;
    public static final int MAX_DOC_CHARS = 200_000;
    public static final int MAX_TOTAL_CHUNKS = 500;
    public static final long MAX_FILE_BYTES = 5 * 1024 * 1024;

    private final AgentService agentService;
    private final AgentKnowledgeDocRepository docRepository;
    private final AgentKnowledgeChunkRepository chunkRepository;
    private final KnowledgeRetrievalService retrievalService;
    private final KnowledgeDocumentExtractor documentExtractor;
    private final EmbeddingService embeddingService;

    public List<KnowledgeDocView> listDocs(Long agentId, Long userId) {
        agentService.requireOwned(agentId, userId);
        Map<Long, Long> chunkCounts = new HashMap<>();
        for (AgentKnowledgeChunkRepository.DocCount count : chunkRepository.countByDoc(agentId)) {
            chunkCounts.put(count.getDocId(), count.getTotal());
        }
        List<KnowledgeDocView> result = new ArrayList<>();
        for (AgentKnowledgeDoc doc : docRepository.findByAgentIdOrderByIdDesc(agentId)) {
            result.add(new KnowledgeDocView(
                    doc.getId(),
                    doc.getTitle(),
                    doc.getSourceType(),
                    doc.getOriginalFilename(),
                    doc.getByteSize(),
                    doc.getCharCount(),
                    chunkCounts.getOrDefault(doc.getId(), 0L),
                    doc.getCreatedAt()
            ));
        }
        return result;
    }

    public KnowledgeDocDetail getDoc(Long agentId, Long docId, Long userId) {
        agentService.requireOwned(agentId, userId);
        AgentKnowledgeDoc doc = requireDoc(agentId, docId);
        return new KnowledgeDocDetail(
                doc.getId(), doc.getTitle(), doc.getSourceType(), doc.getOriginalFilename(),
                doc.getCharCount(), doc.getContent(), doc.getCreatedAt());
    }

    @Transactional
    public KnowledgeDocView addText(Long agentId, Long userId, String title, String rawContent) {
        return save(agentId, userId, title, rawContent, "TEXT", null, "text/plain", null);
    }

    @Transactional
    public KnowledgeDocView addFile(Long agentId, Long userId, MultipartFile file, String title) throws IOException {
        agentService.requireOwned(agentId, userId);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择要上传的文件");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new IllegalArgumentException("知识文件不能超过 5MB");
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "knowledge.txt";
        byte[] bytes = file.getBytes();
        KnowledgeDocumentExtractor.Extracted extracted = documentExtractor.extract(filename, bytes);
        String docTitle = title != null && !title.isBlank() ? title : stripExtension(filename);
        return save(agentId, userId, docTitle, extracted.text(), "FILE", filename,
                extracted.mimeType(), bytes.length);
    }

    @Transactional
    public void deleteDoc(Long agentId, Long docId, Long userId) {
        agentService.requireOwned(agentId, userId);
        AgentKnowledgeDoc doc = requireDoc(agentId, docId);
        chunkRepository.deleteByDocId(doc.getId());
        docRepository.delete(doc);
    }

    public List<KnowledgeSearchHit> search(Long agentId, Long userId, String query) {
        agentService.requireOwned(agentId, userId);
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("请输入检索关键词");
        }
        return retrievalService.search(agentId, query.trim(), 5);
    }

    @Transactional
    public void deleteForAgent(Long agentId) {
        chunkRepository.deleteByAgentId(agentId);
        docRepository.deleteByAgentId(agentId);
    }

    private KnowledgeDocView save(Long agentId, Long userId, String title, String rawContent,
                                  String sourceType, String filename, String mimeType, Integer byteSize) {
        agentService.requireOwned(agentId, userId);
        String content = KnowledgeTextDecoder.normalize(rawContent);
        if (content.isBlank()) {
            throw new IllegalArgumentException("知识内容为空");
        }
        if (content.length() > MAX_DOC_CHARS) {
            throw new IllegalArgumentException("单篇知识不能超过 20 万字符");
        }

        long docs = docRepository.countByAgentId(agentId);
        if (docs >= MAX_DOCS) {
            throw new IllegalArgumentException("每个智能体最多保存 " + MAX_DOCS + " 篇知识");
        }
        List<String> chunks = KnowledgeChunker.split(content);
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("知识内容无法切分，请检查文本");
        }
        long existingChunks = chunkRepository.countByAgentId(agentId);
        if (existingChunks + chunks.size() > MAX_TOTAL_CHUNKS) {
            throw new IllegalArgumentException("该智能体知识库已达上限（" + MAX_TOTAL_CHUNKS + " 个片段），请先删除部分文档");
        }

        AgentKnowledgeDoc doc = new AgentKnowledgeDoc();
        doc.setAgentId(agentId);
        doc.setUserId(userId);
        doc.setTitle(defaultTitle(title));
        doc.setSourceType(sourceType);
        doc.setOriginalFilename(filename);
        doc.setMimeType(mimeType);
        doc.setByteSize(byteSize != null ? byteSize
                : content.getBytes(StandardCharsets.UTF_8).length);
        doc.setCharCount(content.length());
        doc.setContent(content);
        doc.setCreatedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        docRepository.save(doc);

        List<AgentKnowledgeChunk> entities = new ArrayList<>();
        int index = 0;
        for (String chunk : chunks) {
            entities.add(new AgentKnowledgeChunk(
                    null, doc.getId(), agentId, index++, chunk, LocalDateTime.now()));
        }
        applyEmbeddings(entities);
        chunkRepository.saveAll(entities);

        return new KnowledgeDocView(doc.getId(), doc.getTitle(), doc.getSourceType(),
                doc.getOriginalFilename(), doc.getByteSize(), doc.getCharCount(),
                chunks.size(), doc.getCreatedAt());
    }

    /** 重建该智能体已有片段的向量；返回成功写入的片段数 */
    @Transactional
    public int reindex(Long agentId, Long userId) {
        agentService.requireOwned(agentId, userId);
        List<AgentKnowledgeChunk> chunks = chunkRepository
                .findByAgentIdOrderByDocIdAscChunkIndexAsc(agentId);
        if (chunks.isEmpty()) return 0;
        if (chunks.size() > MAX_EMBED_CHUNKS) {
            chunks = chunks.subList(0, MAX_EMBED_CHUNKS);
        }
        try {
            List<float[]> vectors = embeddingService.embed(
                    chunks.stream().map(AgentKnowledgeChunk::getContent).toList());
            String model = embeddingService.modelName();
            for (int i = 0; i < chunks.size() && i < vectors.size(); i++) {
                float[] vector = vectors.get(i);
                if (vector == null || vector.length == 0) continue;
                chunks.get(i).setEmbedding(EmbeddingService.toBytes(vector));
                chunks.get(i).setEmbeddingDim(vector.length);
                chunks.get(i).setEmbeddingModel(model);
            }
            chunkRepository.saveAll(chunks);
            return chunks.size();
        } catch (Exception e) {
            throw new IllegalArgumentException("重建向量失败：" + e.getMessage());
        }
    }

    private void applyEmbeddings(List<AgentKnowledgeChunk> chunks) {
        if (chunks.isEmpty()) return;
        List<AgentKnowledgeChunk> target = chunks.size() > MAX_EMBED_CHUNKS
                ? chunks.subList(0, MAX_EMBED_CHUNKS) : chunks;
        try {
            List<float[]> vectors = embeddingService.embed(
                    target.stream().map(AgentKnowledgeChunk::getContent).toList());
            String model = embeddingService.modelName();
            for (int i = 0; i < target.size() && i < vectors.size(); i++) {
                float[] vector = vectors.get(i);
                if (vector == null || vector.length == 0) continue;
                target.get(i).setEmbedding(EmbeddingService.toBytes(vector));
                target.get(i).setEmbeddingDim(vector.length);
                target.get(i).setEmbeddingModel(model);
            }
        } catch (Exception e) {
            log.warn("生成知识库向量失败，本次仅使用关键词检索: {}", e.getMessage());
        }
    }

    private AgentKnowledgeDoc requireDoc(Long agentId, Long docId) {
        return docRepository.findByIdAndAgentId(docId, agentId)
                .orElseThrow(() -> new ResourceNotFoundException("知识文档不存在"));
    }

    private String defaultTitle(String title) {
        String value = title != null && !title.isBlank() ? title.trim() : "未命名知识";
        return value.length() > 200 ? value.substring(0, 200) : value;
    }

    private String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        String name = dot > 0 ? filename.substring(0, dot) : filename;
        return name.isBlank() ? "知识文件" : name;
    }
}