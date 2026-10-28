/** 把结构化识别结果转成文字，用于展示给智能体和历史消息 */
export function formatVision(vision) {
  if (!vision) return '';
  const lines = [];
  lines.push(`植物：${vision.plantName || '未识别'}${vision.scientificName ? `（${vision.scientificName}）` : ''}`);
  lines.push(`生长阶段：${vision.growthStage || '无法判断'}`);
  lines.push(`健康状态：${vision.healthStatus || '无法判断'}`);

  if (vision.issues?.length) {
    lines.push('发现的问题：');
    vision.issues.forEach((issue, index) => {
      const confidence = typeof issue.confidence === 'number'
        ? `，置信度 ${Math.round(issue.confidence * 100)}%`
        : '';
      lines.push(`${index + 1}. [${issue.type || 'unknown'}] ${issue.name || '未知问题'}${confidence}`);
      if (issue.symptoms) lines.push(`   症状：${issue.symptoms}`);
      if (issue.suggestion) lines.push(`   建议：${issue.suggestion}`);
    });
  } else {
    lines.push('未发现明显问题。');
  }

  if (vision.overallAssessment) lines.push(`综合判断：${vision.overallAssessment}`);
  if (vision.careAdvice?.length) {
    lines.push('照护建议：');
    vision.careAdvice.forEach((advice, index) => lines.push(`${index + 1}. ${advice}`));
  }
  return lines.join('\n');
}