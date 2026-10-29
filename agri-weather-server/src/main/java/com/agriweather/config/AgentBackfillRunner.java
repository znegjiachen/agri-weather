package com.agriweather.config;

import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.AgentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 为存量地块补齐专属智能体。
 *
 * 失败只记日志，不影响应用启动；列表/聊天接口也会兜底创建。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentBackfillRunner implements ApplicationRunner {

    private final FarmlandRepository farmlandRepository;
    private final AgentService agentService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Farmland> fields = farmlandRepository.findAll();
            int created = 0;
            for (Farmland field : fields) {
                agentService.ensureForFarmland(field);
                created++;
            }
            if (created > 0) {
                log.info("地块专属智能体检查完成，共 {} 块地", created);
            }
        } catch (Exception e) {
            log.warn("存量地块智能体补齐失败（可稍后由接口自动创建）: {}", e.getMessage());
        }
    }
}