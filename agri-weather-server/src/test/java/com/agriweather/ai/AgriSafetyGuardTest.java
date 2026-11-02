package com.agriweather.ai;

import com.agriweather.agent.AgentResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgriSafetyGuardTest {

    private final AgriSafetyGuard guard = new AgriSafetyGuard();

    private AgentResult result(String reply) {
        return new AgentResult(reply, List.of(), List.of(), 1, false);
    }

    @Test
    void flagsHighRiskPesticide() {
        AgentResult result = result("可以用百草枯快速除草。");
        assertTrue(guard.isRisky(result.reply()));
        assertTrue(guard.review(result).reply().contains("严禁违规使用"));
    }

    @Test
    void flagsAbsoluteClaim() {
        AgentResult result = result("按这个方法保证增产。");
        assertTrue(guard.isRisky(result.reply()));
        assertTrue(guard.review(result).reply().contains("不应理解为绝对保证"));
    }

    @Test
    void redactsPhoneAndIdCard() {
        AgentResult result = result("联系人 13812345678，身份证 430102199001011234。");
        AgentResult reviewed = guard.review(result);
        assertTrue(reviewed.reply().contains("手机号已隐去"));
        assertTrue(reviewed.reply().contains("身份证号已隐去"));
        assertTrue(reviewed.reply().contains("【隐私提示】"));
    }

    @Test
    void keepsNormalReplyUntouched() {
        AgentResult result = result("明天风速较大，建议推迟打药。");
        assertFalse(guard.isRisky(result.reply()));
        assertSame(result, guard.review(result));
    }
}