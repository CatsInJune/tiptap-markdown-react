# tiptap-markdown-react 工程 Wiki（内部）

> **Agent 开工前先读本页**，再按需跳到对应页面。本目录是工程视角的内部知识库；对外文档在 [GitHub Wiki](https://github.com/CatsInJune/tiptap-markdown-react/wiki) 与 [README](../README.md)，两边不复制内容、互相链接。

**项目**：Markdown 优先的所见即所得编辑器 + 阅读器套件（Tiptap v3），Markdown 进 / Markdown 出，编辑器 + 客户端预览 + 服务端渲染三端一致。
**版本节奏**：高频小版本发布（见 `.wiki/decisions.md` 与 GitHub Wiki 的 Changelog）。
**最后更新**：2026-11-01

## 页面索引

| 页面 | 内容 | 什么时候读 |
| --- | --- | --- |
| [architecture.md](architecture.md) | 三入口分层、`src/` 代码地图、共享 tokenizer、测试布局 | 动任何代码前；找不到某功能在哪个文件时 |
| [conventions.md](conventions.md) | 硬约束（依赖锁版本、禁用词）、markdown 往返约束、i18n 双份同步、验收方法 | 改代码 / 加功能 / 改文案 / 改样式前 |
| [decisions.md](decisions.md) | 架构决策记录（为什么 `$` 是货币符、为什么没有合并单元格……） | 想改某个「看起来不合理」的行为前，先确认它是决策不是缺陷 |
| [perf-backlog.md](perf-backlog.md) | 性能实测档案（10–50 万字前后对比）、剩余瓶颈归因、候选优化 | 做性能工作前 |

## 外部文档分工

| 载体 | 受众 | 内容 |
| --- | --- | --- |
| README | npm 用户（英文） | 安装、上手、完整 props/API 表 |
| GitHub Wiki | 库的使用者（中文） | 往返规则、架构讲解、性能基准数据、设计决策的用户视角、Changelog、发版流程 |
| `.wiki/`（本目录） | 本仓库的 AI agent 与开发者（中文） | 代码地图、工程约束、坑清单、内部待办 |

## 常用命令

```bash
npm run test        # vitest（含 happy-dom 的 .dom.test.tsx）
npm run typecheck   # tsc --noEmit
npm run build       # vite build + scripts/split-fonts.mjs
node site/scripts/perf-bench.mjs   # 性能基准（见 perf-backlog.md）
```
