# RAG 检索评测报告

- 日期：2026-11-02
- 知识库：水稻资料 8 份（PDF / Word / TXT / Markdown）
- 检索方式：中文 bigram + 本地字词哈希向量（未配置外部 Embedding）
- 评测集：[ai-eval-set.json](ai-eval-set.json)，10 条真实农事问题
- 指标：**hit@5 = 10/10 = 100%**

> 口径说明：hit 指 top 5 检索片段中包含任一期望关键词。这是**宽松的检索命中率**，不等于答案正确率，也不代表 top 1 排名正确。样本只有 10 条，结论是方向性的，不是 benchmark。

| # | 问题 | 结果 |
|---|---|---|
| 1 | 稻瘟病在什么温湿度条件下容易发生？ | PASS |
| 2 | 水稻育秧期遇到低温应该怎么处理？ | PASS |
| 3 | 水稻分蘖期适合施什么肥？ | PASS |
| 4 | 水稻主要害虫有哪些，怎么防治？ | PASS |
| 5 | 水稻抽穗扬花期遇到连续降雨怎么办？ | PASS |
| 6 | 水稻收获后如何烘干和储存？ | PASS |
| 7 | 水稻田什么时候需要晒田？ | PASS |
| 8 | 水稻纹枯病怎么识别和防治？ | PASS |
| 9 | 杂交水稻和常规稻在管理上有什么区别？ | PASS |
| 10 | 水稻插秧深度多少合适？ | PASS |

## 复现方式

1. 创建地块后，向该地块智能体上传 `docs/knowledge-samples/rice/` 下的资料
2. 调用：

```bash
curl -X POST "http://localhost:8082/api/agents/{agentId}/knowledge/eval" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data-binary @docs/ai-eval-set.json
```

## 下一步

- 增加 top1 / top3 命中率，不要只看 hit@5
- 增加“答案是否被用户采纳”的离线标注或 LLM 评审
- 扩充到 30–50 条问题，覆盖不同作物和病虫害
- 配置外部 Embedding 后对比本地向量的命中率差异
