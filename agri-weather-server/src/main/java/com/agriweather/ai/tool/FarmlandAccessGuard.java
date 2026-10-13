package com.agriweather.ai.tool;

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
}
