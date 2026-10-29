package com.agriweather.ai.tool;

import com.agriweather.ai.AgriContext;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FarmlandAccessGuardTest {

    @Test
    @DisplayName("地块专属助手只能访问自己的地块")
    void scopedAgentCannotAccessOtherFarmland() {
        FarmlandRepository repo = mock(FarmlandRepository.class);
        Farmland mine = field(7L, 42L, "3号田");
        Farmland other = field(8L, 42L, "5号田");
        when(repo.findById(7L)).thenReturn(Optional.of(mine));
        when(repo.findById(8L)).thenReturn(Optional.of(other));

        FarmlandAccessGuard guard = new FarmlandAccessGuard(repo);
        AgriContext scoped = new AgriContext(42L, 1L, 7L);

        assertEquals(mine, guard.requireOwned(7L, scoped));
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> guard.requireOwned(8L, scoped));
        assertTrue(e.getMessage().contains("只负责"));
        assertTrue(e.getMessage().contains("3号田"));
    }

    @Test
    @DisplayName("全局对话仍可访问自己的其他地块")
    void globalContextKeepsOldBehavior() {
        FarmlandRepository repo = mock(FarmlandRepository.class);
        Farmland other = field(8L, 42L, "5号田");
        when(repo.findById(8L)).thenReturn(Optional.of(other));

        FarmlandAccessGuard guard = new FarmlandAccessGuard(repo);
        assertEquals(other, guard.requireOwned(8L, new AgriContext(42L)));
    }

    @Test
    @DisplayName("跨用户访问被拒绝")
    void otherUserRejected() {
        FarmlandRepository repo = mock(FarmlandRepository.class);
        Farmland other = field(8L, 99L, "别人的地");
        when(repo.findById(8L)).thenReturn(Optional.of(other));

        FarmlandAccessGuard guard = new FarmlandAccessGuard(repo);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> guard.requireOwned(8L, new AgriContext(42L)));
        assertTrue(e.getMessage().contains("无权访问"));
    }

    private Farmland field(Long id, Long userId, String name) {
        Farmland f = new Farmland();
        f.setId(id);
        f.setUserId(userId);
        f.setFieldName(name);
        return f;
    }
}