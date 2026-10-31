# 性能待办（未排期）

> 基准方法与当前数据见 [GitHub Wiki: Performance](https://github.com/CatsInJune/tiptap-markdown-react/wiki/Performance)；复现命令 `node site/scripts/perf-bench.mjs`（`--profile <name>` 出 CPU 热点）。数据文件在 `site/bench-results/`（本地，未入库）。

## 实证瓶颈（bench/profile 归因过的）

1. **emoji storage 全量重算**——输入时 emoji 相关 storage 被整表重算，长文档打字路径上有份。
2. **TOC 无条件注册 + setState 不看 prop**——目录扩展与订阅在不开启 `toc` 时也付成本；更新路径有不看 prop 的 setState。
3. **无大文档降级路径**——超过某规模后没有「关掉重交互」的自动降级，6 万字符混合文档大事务 ~490ms 全额支付。

## 候选优化（按动手顺序待确认：1 → 2 → 9）

顺序编号来自基准对照实验的归因结论；具体条目以 `--profile` 热点为准，动每一项前先跑基线、后跑对照（`custom-*` 减法矩阵就是为归因设计的）。

## 现状参考值（1.9.x，开发机单点）

| 场景 | 打字 P50 | 大事务 P50 | `getMarkdown` |
| --- | --- | --- | --- |
| 3 万字符混合 | ~5ms | ~160ms | ~6ms |
| 6 万字符混合 | ~7ms | ~490ms | ~13ms |
| 6 万字符纯段落 | ~4ms | ~73ms | ~7ms |
