package com.agriweather.ai.tool;

import com.agriweather.ai.AgriContext;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * 地块归属校验。
 *
 * 属于领域逻辑（框架不知道「地块」是什么），所以放在这里而不是框架里。
 * 所有涉及具体地块的工具都应先过这一关，防止越权访问他人地块。
 */
@Component
@RequiredArgsConstructor
public class FarmlandAccessGuard {

    private final FarmlandRepository farmlandRepo;

    /** 校验地块存在且属于该用户，返回地块实体；否则抛出可读错误 */
    public Farmland requireOwned(Long farmlandId, Long userId) {
        Farmland f = farmlandRepo.findById(farmlandId)
                .orElseThrow(() -> new IllegalArgumentException("地块不存在（ID=" + farmlandId + "）"));
        if (!Objects.equals(f.getUserId(), userId)) {
            throw new IllegalArgumentException("无权访问该地块（ID=" + farmlandId + "）");
        }
        return f;
    }

    /**
     * 专属助农手只能访问自己负责的地块。
     *
     * 全局对话（farmlandId 为空）保持原行为；地块智能体越界时给出可读提示，
     * 让模型转告用户切换地块，而不是查出别的地块数据。
     */
    public Farmland requireOwned(Long farmlandId, AgriContext context) {
        Farmland f = requireOwned(farmlandId, context.userId());
        if (context.farmlandId() != null && !Objects.equals(context.farmlandId(), farmlandId)) {
            String scopedName = farmlandRepo.findById(context.farmlandId())
                    .map(Farmland::getFieldName)
                    .orElse("其他地块");
            throw new IllegalArgumentException(
                    "该助农手只负责「" + scopedName + "」，不能查询其他地块，请切换到对应地块的助农手");
        }
        return f;
    }
}
