package com.agriweather.service;

import com.agriweather.agent.ToolRegistry;
import com.agriweather.controller.ResourceNotFoundException;
import com.agriweather.dto.AgentDetail;
import com.agriweather.dto.AgentSummary;
import com.agriweather.dto.AgentUpdateRequest;
import com.agriweather.entity.CropInfo;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandAgent;
import com.agriweather.repository.AgentChatMessageRepository;
import com.agriweather.repository.AgentKnowledgeChunkRepository;
import com.agriweather.repository.AgentKnowledgeDocRepository;
import com.agriweather.repository.CropInfoRepository;
import com.agriweather.repository.FarmlandAgentRepository;
import com.agriweather.repository.FarmlandRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 地块智能体的生命周期与所有权。
 *
 * 一块地一个智能体：创建地块时自动生成，存量地块在列表/聊天/启动时补齐。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final FarmlandAgentRepository agentRepository;
    private final AgentKnowledgeDocRepository docRepository;
    private final AgentKnowledgeChunkRepository chunkRepository;
    private final AgentChatMessageRepository chatMessageRepository;
    private final FarmlandRepository farmlandRepository;
    private final CropInfoRepository cropInfoRepository;
    private final AgentDefaults defaults;
    private final BuiltInKnowledgeService builtInKnowledgeService;
    private final ToolRegistry toolRegistry;

    @Transactional
    public FarmlandAgent ensureForFarmland(Farmland field) {
        if (field == null || field.getId() == null) {
            throw new IllegalArgumentException("地块不存在");
        }
        FarmlandAgent existing = agentRepository.findByFarmlandId(field.getId()).orElse(null);
        if (existing != null) return existing;

        FarmlandAgent draft = new FarmlandAgent();
        defaults.applyDefault(draft, field);
        agentRepository.insertIfAbsent(
                draft.getUserId(),
                draft.getFarmlandId(),
                draft.getName(),
                draft.getAvatar(),
                draft.getPersona(),
                draft.getWelcome(),
                false
        );
        return agentRepository.findByFarmlandId(field.getId())
                .orElseThrow(() -> new IllegalStateException("智能体创建失败"));
    }

    @Transactional
    public List<FarmlandAgent> ensureForUser(Long userId) {
        List<FarmlandAgent> result = new ArrayList<>();
        for (Farmland field : farmlandRepository.findByUserId(userId)) {
            result.add(ensureForFarmland(field));
        }
        return result;
    }

    @Transactional
    public List<AgentSummary> listSummaries(Long userId) {
        List<FarmlandAgent> agents = ensureForUser(userId);
        if (agents.isEmpty()) return List.of();

        Map<Long, Farmland> fields = new HashMap<>();
        for (Farmland field : farmlandRepository.findByUserId(userId)) {
            fields.put(field.getId(), field);
        }

        Map<Long, CropInfo> crops = new HashMap<>();
        for (CropInfo crop : cropInfoRepository.findAll()) {
            crops.put(crop.getId(), crop);
        }

        List<Long> ids = agents.stream().map(FarmlandAgent::getId).toList();
        Map<Long, Long> docCounts = toCountMap(docRepository.countByAgentIds(ids));
        Map<Long, Long> chunkCounts = toCountMap(chunkRepository.countByAgentIds(ids));

        List<AgentSummary> result = new ArrayList<>();
        for (FarmlandAgent agent : agents) {
            Farmland field = fields.get(agent.getFarmlandId());
            CropInfo crop = field != null && field.getCropId() != null
                    ? crops.get(field.getCropId()) : null;
            result.add(new AgentSummary(
                    agent.getId(),
                    agent.getFarmlandId(),
                    field != null ? field.getFieldName() : null,
                    crop != null ? crop.getId() : null,
                    crop != null ? crop.getCropName() : null,
                    agent.getName(),
                    agent.getAvatar(),
                    Boolean.TRUE.equals(agent.getPersonaCustom()),
                    docCounts.getOrDefault(agent.getId(), 0L),
                    chunkCounts.getOrDefault(agent.getId(), 0L),
                    agent.getUpdatedAt()
            ));
        }
        result.sort((a, b) -> Long.compare(
                a.farmlandId() != null ? a.farmlandId() : 0,
                b.farmlandId() != null ? b.farmlandId() : 0));
        return result;
    }

    public AgentDetail detail(Long agentId, Long userId) {
        FarmlandAgent agent = requireOwned(agentId, userId);
        Farmland field = farmlandRepository.findById(agent.getFarmlandId())
                .orElseThrow(() -> new ResourceNotFoundException("地块不存在"));
        CropInfo crop = field.getCropId() != null
                ? cropInfoRepository.findById(field.getCropId()).orElse(null) : null;

        return new AgentDetail(
                agent.getId(),
                agent.getFarmlandId(),
                field.getFieldName(),
                crop != null ? crop.getId() : null,
                crop != null ? crop.getCropName() : null,
                agent.getName(),
                agent.getAvatar(),
                agent.getPersona(),
                agent.getWelcome(),
                Boolean.TRUE.equals(agent.getPersonaCustom()),
                docRepository.countByAgentId(agent.getId()),
                chunkRepository.countByAgentId(agent.getId()),
                builtInKnowledgeService.build(field),
                enabledTools(agent),
                agent.getUpdatedAt()
        );
    }

    @Transactional
    public AgentDetail update(Long agentId, Long userId, AgentUpdateRequest request) {
        FarmlandAgent agent = requireOwned(agentId, userId);
        String persona = request.getPersona().trim();
        if (!persona.equals(agent.getPersona())) {
            agent.setPersonaCustom(true);
        }
        agent.setName(request.getName().trim());
        agent.setPersona(persona);
        agent.setWelcome(request.getWelcome() != null ? request.getWelcome().trim() : agent.getWelcome());
        if (request.getAvatar() != null && !request.getAvatar().isBlank()) {
            agent.setAvatar(request.getAvatar().trim());
        }
        if (request.getEnabledTools() != null) {
            List<String> tools = request.getEnabledTools().stream()
                    .filter(t -> t != null && !t.isBlank())
                    .map(String::trim)
                    .distinct()
                    .toList();
            if (tools.isEmpty()) {
                throw new IllegalArgumentException("至少启用一个工具");
            }
            for (String tool : tools) {
                if (!toolRegistry.contains(tool)) {
                    throw new IllegalArgumentException("未知工具：" + tool);
                }
            }
            agent.setEnabledTools(String.join(",", tools));
        }
        agent.setUpdatedAt(LocalDateTime.now());
        agentRepository.save(agent);
        return detail(agentId, userId);
    }

    @Transactional
    public AgentDetail reset(Long agentId, Long userId) {
        FarmlandAgent agent = requireOwned(agentId, userId);
        Farmland field = farmlandRepository.findById(agent.getFarmlandId())
                .orElseThrow(() -> new ResourceNotFoundException("地块不存在"));
        defaults.applyDefault(agent, field);
        agentRepository.save(agent);
        return detail(agentId, userId);
    }

    /** 地块作物/面积变化后：只刷新没有自定义过人设的智能体 */
    @Transactional
    public void refreshDefaultAfterFarmlandUpdate(Farmland field) {
        FarmlandAgent agent = agentRepository.findByFarmlandId(field.getId()).orElse(null);
        if (agent == null || Boolean.TRUE.equals(agent.getPersonaCustom())) return;
        defaults.applyDefault(agent, field);
        agentRepository.save(agent);
    }

    @Transactional
    public void deleteFarmlandAndAgent(Long farmlandId, Long userId) {
        Farmland field = requireOwnedFarmland(farmlandId, userId);
        deleteForFarmland(farmlandId, userId);
        farmlandRepository.delete(field);
    }

    @Transactional
    public void deleteForFarmland(Long farmlandId, Long userId) {
        FarmlandAgent agent = agentRepository.findByFarmlandId(farmlandId).orElse(null);
        if (agent == null) return;
        if (userId != null && !Objects.equals(agent.getUserId(), userId)) {
            throw new SecurityException("无权操作该地块的智能体");
        }
        chunkRepository.deleteByAgentId(agent.getId());
        docRepository.deleteByAgentId(agent.getId());
        chatMessageRepository.deleteByAgentId(agent.getId());
        agentRepository.delete(agent);
    }

    /** 把 agentId 回填到地块返回值，供前端直接使用 */
    @Transactional
    public void attachAgentIds(Long userId, List<Farmland> fields) {
        if (fields == null || fields.isEmpty()) return;
        ensureForUser(userId);
        List<Long> ids = fields.stream().map(Farmland::getId).toList();
        Map<Long, FarmlandAgent> byField = new HashMap<>();
        for (FarmlandAgent agent : agentRepository.findByFarmlandIdIn(ids)) {
            byField.put(agent.getFarmlandId(), agent);
        }
        for (Farmland field : fields) {
            FarmlandAgent agent = byField.get(field.getId());
            field.setAgentId(agent != null ? agent.getId() : null);
        }
    }

    @Transactional
    public FarmlandAgent resolveForChat(Long userId, Long agentId, Long farmlandId) {
        if (agentId != null) {
            FarmlandAgent agent = agentRepository.findById(agentId)
                    .orElseThrow(() -> new ResourceNotFoundException("智能体不存在"));
            if (!Objects.equals(agent.getUserId(), userId)) {
                throw new SecurityException("无权访问该智能体");
            }
            if (farmlandId != null && !Objects.equals(agent.getFarmlandId(), farmlandId)) {
                throw new IllegalArgumentException("智能体与地块不匹配");
            }
            return agent;
        }
        if (farmlandId != null) {
            Farmland field = farmlandRepository.findById(farmlandId)
                    .orElseThrow(() -> new ResourceNotFoundException("地块不存在"));
            if (!Objects.equals(field.getUserId(), userId)) {
                throw new SecurityException("无权访问该地块");
            }
            return ensureForFarmland(field);
        }
        return null;
    }

    public FarmlandAgent requireOwned(Long agentId, Long userId) {
        FarmlandAgent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new ResourceNotFoundException("智能体不存在"));
        if (!Objects.equals(agent.getUserId(), userId)) {
            throw new SecurityException("无权访问该智能体");
        }
        return agent;
    }

    public Farmland requireOwnedFarmland(Long farmlandId, Long userId) {
        Farmland field = farmlandRepository.findById(farmlandId)
                .orElseThrow(() -> new ResourceNotFoundException("地块不存在"));
        if (!Objects.equals(field.getUserId(), userId)) {
            throw new SecurityException("无权访问该地块");
        }
        return field;
    }

    /** 智能体启用的工具；空配置表示全部工具 */
    public List<String> enabledTools(FarmlandAgent agent) {
        String raw = agent.getEnabledTools();
        if (raw != null && !raw.isBlank()) {
            List<String> tools = new ArrayList<>();
            for (String item : raw.split(",")) {
                String name = item.trim();
                if (!name.isEmpty() && toolRegistry.contains(name) && !tools.contains(name)) {
                    tools.add(name);
                }
            }
            if (!tools.isEmpty()) return tools;
        }
        List<String> all = new ArrayList<>(toolRegistry.allToolNames());
        all.sort(String::compareTo);
        return all;
    }

    public Set<String> enabledToolSet(FarmlandAgent agent) {
        return new LinkedHashSet<>(enabledTools(agent));
    }

    private Map<Long, Long> toCountMap(List<?> rows) {
        Map<Long, Long> result = new HashMap<>();
        for (Object row : rows) {
            if (row instanceof AgentKnowledgeDocRepository.AgentCount count) {
                result.put(count.getAgentId(), count.getTotal());
            } else if (row instanceof AgentKnowledgeChunkRepository.AgentCount count) {
                result.put(count.getAgentId(), count.getTotal());
            }
        }
        return result;
    }
}