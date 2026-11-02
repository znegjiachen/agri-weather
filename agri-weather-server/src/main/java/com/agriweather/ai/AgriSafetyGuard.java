package com.agriweather.ai;

import com.agriweather.agent.AgentResult;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * AI 输出安全兜底。
 *
 * 不做内容改写，只在检测到高风险农资或绝对化承诺时追加明确的安全提示；
 * 真正的用药决策仍应回到农药标签和当地农技部门。
 */
@Service
public class AgriSafetyGuard {

    private static final Pattern HIGH_RISK_PESTICIDE = Pattern.compile(
            "百草枯|甲胺磷|对硫磷|甲基对硫磷|久效磷|磷化锌|毒鼠强|六六六|滴滴涕|"
                    + "禁用农药|剧毒农药|高毒农药");

    private static final Pattern ABSOLUTE_CLAIM = Pattern.compile(
            "保证(增产|丰收|有效|治好)|百分之百|100%有效|绝对安全|包治");

    /** 手机号 / 身份证号：模型偶尔会复述用户输入，输出前统一隐去 */
    private static final Pattern PHONE = Pattern.compile("1[3-9]\\d{9}");
    private static final Pattern ID_CARD = Pattern.compile("\\d{17}[\\dXx]");

    private static final String PESTICIDE_NOTICE =
            "\n\n【安全提示】以上内容涉及高毒或禁用农药风险。请以农药标签、登记作物和当地农技部门意见为准，"
                    + "严禁违规使用；施药时做好个人防护并遵守安全间隔期。";

    private static final String ABSOLUTE_NOTICE =
            "\n\n【安全提示】农业效果受品种、土壤、气候和管理等多种因素影响，"
                    + "以上结论不应理解为绝对保证。";

    public boolean isRisky(String reply) {
        if (reply == null || reply.isBlank()) return false;
        return HIGH_RISK_PESTICIDE.matcher(reply).find()
                || ABSOLUTE_CLAIM.matcher(reply).find()
                || PHONE.matcher(reply).find()
                || ID_CARD.matcher(reply).find();
    }

    /** 返回脱敏并追加安全提示后的结果；没有风险时原样返回 */
    public AgentResult review(AgentResult result) {
        if (result == null || result.reply() == null || result.reply().isBlank()) return result;
        String reply = result.reply();
        boolean hasNotice = reply.contains("【安全提示】") || reply.contains("【隐私提示】");

        boolean pii = false;
        // 先处理 18 位身份证，避免其中的 11 位数字被手机号规则抢先匹配
        if (ID_CARD.matcher(reply).find()) {
            reply = ID_CARD.matcher(reply).replaceAll("［身份证号已隐去］");
            pii = true;
        }
        if (PHONE.matcher(reply).find()) {
            reply = PHONE.matcher(reply).replaceAll("［手机号已隐去］");
            pii = true;
        }

        StringBuilder notice = new StringBuilder();
        if (pii) {
            notice.append("\n\n【隐私提示】回答中的手机号/身份证号已自动隐去。");
        }
        if (!hasNotice) {
            if (HIGH_RISK_PESTICIDE.matcher(result.reply()).find()) {
                notice.append(PESTICIDE_NOTICE);
            } else if (ABSOLUTE_CLAIM.matcher(result.reply()).find()) {
                notice.append(ABSOLUTE_NOTICE);
            }
        }
        if (notice.length() == 0) return result;

        return new AgentResult(reply + notice, result.trace(), result.thoughts(),
                result.rounds(), result.truncated());
    }
}