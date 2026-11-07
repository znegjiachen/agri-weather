# 评测结果目录

`scripts/run-agent-eval.mjs` 默认把结果写入本目录：

```text
YYYY-MM-DD-agent-eval.json   逐题工具轨迹、耗时、完整回答
YYYY-MM-DD-agent-eval.csv    扁平表，便于抽查
blind-review-*.csv           人工盲评表（不含组别）
blind-review-*-key.json      揭盲映射，评审结束前不要打开
```

建议文件名带上环境与模型，例如：

- `2026-11-07-prod-agent.json`
- `2026-11-07-prod-baseline.json`

结果文件可能包含模型回答全文，提交前检查是否含个人信息；测试账号不要使用真实农户数据。
