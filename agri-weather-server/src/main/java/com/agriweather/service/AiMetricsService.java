package com.agriweather.service;

import com.agriweather.repository.AgentFeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 进程内 AI 评测指标。
 *
 * 不依赖 Prometheus，启动即可在 /api/agent/metrics 查看；
 * 多实例下是各自实例的计数，用于演示和日常排查已足够。
 */
@Service
@RequiredArgsConstructor
public class AiMetricsService {

    private final AgentFeedbackRepository feedbackRepository;

    private final AtomicLong chatRequests = new AtomicLong();
    private final AtomicLong streamRequests = new AtomicLong();
    private final AtomicLong successes = new AtomicLong();
    private final AtomicLong failures = new AtomicLong();
    private final AtomicLong cancellations = new AtomicLong();
    private final AtomicLong safetyFlags = new AtomicLong();
    private final AtomicLong toolCalls = new AtomicLong();
    private final AtomicLong knowledgeHits = new AtomicLong();
    private final AtomicLong documentTurns = new AtomicLong();
    private final AtomicLong totalLatencyMs = new AtomicLong();

    public void requestStarted(boolean stream) {
        chatRequests.incrementAndGet();
        if (stream) streamRequests.incrementAndGet();
    }

    public void completed(boolean stream, boolean success, long latencyMs, int tools,
                          int knowledgeRefs, boolean documentUsed, boolean safetyFlag) {
        if (success) successes.incrementAndGet();
        else failures.incrementAndGet();
        totalLatencyMs.addAndGet(Math.max(0, latencyMs));
        toolCalls.addAndGet(Math.max(0, tools));
        knowledgeHits.addAndGet(Math.max(0, knowledgeRefs));
        if (documentUsed) documentTurns.incrementAndGet();
        if (safetyFlag) safetyFlags.incrementAndGet();
    }

    public void cancelled() {
        cancellations.incrementAndGet();
    }

    public Map<String, Object> snapshot() {
        long requests = chatRequests.get();
        long success = successes.get();
        long finished = success + failures.get();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("chatRequests", requests);
        result.put("streamRequests", streamRequests.get());
        result.put("successes", success);
        result.put("failures", failures.get());
        result.put("cancellations", cancellations.get());
        result.put("successRate", finished == 0 ? null
                : Math.round((double) success / finished * 1000) / 10.0);
        result.put("avgLatencyMs", finished == 0 ? null : totalLatencyMs.get() / finished);
        result.put("toolCalls", toolCalls.get());
        result.put("knowledgeHits", knowledgeHits.get());
        result.put("documentTurns", documentTurns.get());
        result.put("safetyFlags", safetyFlags.get());
        result.put("feedbackUp", feedbackRepository.countByRating("UP"));
        result.put("feedbackDown", feedbackRepository.countByRating("DOWN"));
        return result;
    }
}