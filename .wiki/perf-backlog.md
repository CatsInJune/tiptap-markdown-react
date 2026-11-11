# 性能实测档案与待办

> **复现**：`node site/scripts/perf-bench.mjs`（`--only <名>` 过滤；`--profile <名> --profile-action typing|bigtx|load` 出 CPU 热点，按包/函数聚合自耗时）。历史面板装载：`node site/scripts/history-bench.mjs --chars 160000`。
> **设施**：`site/bench.html` + `site/src/bench.tsx`（lib 模式走 dist=真实用户路径；custom 模式引 src 做扩展减法归因；`content=json` 对照跳过 markdown 解析层，fixture 在 `site/public/bench-fixtures/`）。矩阵与 query 参数见脚本头注释。
> **产物**：`site/bench-results/`（本地未入库，含 .cpuprofile）。
> **官方资料**：[性能指南](https://tiptap.dev/docs/guides/performance)（只覆盖 React 渲染层，不覆盖装载）；[20 万词示例](https://tiptap.dev/docs/examples/basics/long-texts)（裸编辑器、JSON 直灌、无 markdown 层——官方对大 markdown 装载没有现成方案）。

## 已修复（1.12.3，2026-11-11）— 历史版本对比

同一台机器、220 段、138,941 字（每段约 628 字）。改之前是逐字最长公共子串，相同段落也要算；打开面板同步解析 6 次并重建第二个编辑器。

| 场景 | 改之前 | 改之后 |
| --- | --- | --- |
| 两篇完全相同 | 1.60 秒（比较 1.32 秒） | 261 毫秒，高亮 0 处 |
| 31 段有改动 | 1.71 秒（比较 1.42 秒） | 266 毫秒 |
| 193 段有改动 | 2.24 秒（比较 1.94 秒） | 274 毫秒 |
| 原文相同的「是不是同一版」 | 285 毫秒，解析 2 次 | 0.3 毫秒，不解析 |
| 正文不同，当前稿已是编辑器输出 | 286 毫秒，两边都解析 | 94 毫秒，只解析快照一次；再问一次 0.2 毫秒 |
| 打开面板 | 2.75 秒，解析 6 次 | 先画选中版，差异空闲时算，切版本取消 |
| 面板关着打一个字 | 读全文；正文缓存后一次按键约 1.2 秒 | 不读全文 |

剩下的约 260 毫秒是两遍 markdown 解析。31 段和 193 段只差 8 毫秒，词级 Myers 不再随改动段数涨。对应 [issue #55](https://github.com/CatsInJune/tiptap-markdown-react/issues/55)。

那次计时只跑了 `diffAnnotations`（纯段落、不建编辑器 DOM）。下面这组才是历史面板在 Chrome 里换一篇长文的基线。

## 当前基线（未修，2026-11-11）— 历史面板装载

复现：`node site/scripts/history-bench.mjs --chars 160000`。Chrome，扩展与 `VersionDiffView` 相同。报告形文档对齐宿主长报告的密度（约 16 万字、约 700 个引用、30 余张表、300 余个列表项），不含原文。量之前先在页面上挂好另一棵同样的长文，模拟正文编辑器已经开着。

| 步骤 | 纯段落（16.3 万字） | 报告形（16.5 万字） |
| --- | --- | --- |
| `setContent` 装进历史预览 | 619 毫秒，DOM 1,540 节点 | **1.95 秒**，正文 15.1 万字，DOM 6,154 节点 |
| `parseVersionDoc` 对比版 | 1.13 秒 | **1.85 秒** |
| 再 `setContent` 切到对比版 | — | **1.85 秒** |

一次切换在主线程上是「装选中版 + 再解析对比版」，报告形合计约 **3.8 秒**。纯段落装载只要 0.6 秒，所以 1.12.3 那组 260 毫秒的对比基线看不到这个问题。

宿主报告 1305（正文约 15.7 万字、652 个引用、31 张表，Markdown 185,870 字）同日在页面上的抽查：快照接口 827 毫秒；数据回到主线程之后，装载长任务 **4.3 秒**，加载圈才消失；对比版再解析 **1.9 秒**。接口只占开头不到 1 秒，其余是编辑器。抽查比上面的脚本更慢，因为页面上还有正在编辑的那棵全文，以及 Next 开发态。脚本数字是以后优化要打的可重复基线。

## 已修复（1.12.4，2026-11-11）— 历史面板首屏分块 + JSON 缓存

不动 Worker。`VersionDiffView`：块边界切开 markdown（`splitTopLevelMarkdown`）→ 首屏约 8k 字符 `setContent` → idle 续装（`addToHistory: false`，切版取消）→ 按版本 id 缓存 JSON（最多 3 版）。对比正文未到齐时也先装选中版。

同机复测 `node site/scripts/history-bench.mjs --chars 160000`（报告形 16.5 万字，正文编辑器已挂同篇）：

| 步骤 | 1.12.3 整篇 | 1.12.4 分块 |
| --- | --- | --- |
| 报告形首屏（`firstMs`） | ≈ 整篇 1.95 秒 | **52 毫秒** |
| 报告形装完（`readyMs`） | 1.95 秒 | **587 毫秒** |
| 同版再开（缓存命中装完） | 再解析 ≈1.95 秒 | **290 毫秒**（首屏 48 毫秒） |
| 切到对比版（分块装完） | 整篇 1.85 秒 | **549 毫秒**（首屏 51 毫秒） |
| `parseVersionDoc` 对比版 | 1.85 秒 | **仍 1.83 秒**（未改） |

纯段落首屏 6 毫秒 / 装完 141 毫秒（整篇曾 655 毫秒）。对比版整篇解析仍是下一刀。

## 已修复（1.9.2，2026-11-01）

| 修复 | 内容 | 实测收益 |
| --- | --- | --- |
| emoji addStorage 缓存 | 官方 `Extension.storage` 是无缓存 getter，事务路径（`getAttributesFromExtensions`）反复触发官方 Emoji 几千项的去重+O(N²) 查找（大事务 CPU 自耗时 ~15%）。`emoji/markdownEmoji.ts` 用 WeakMap 按 `options.emojis` 引用缓存父级返回值 | 3 万字全选加粗 -17% |
| TOC 按需注册 | 官方 TableOfContents 每内容事务全文档遍历两遍（appendTransaction + onTransaction）。改为 `toc \|\| onTocChange` 传入才注册，语义「谁用谁付」 | 3 万字打字 P50 -26%、Enter P95 -53%；规模越大越多（见下表） |
| queueMicrotask 防御 | 目录 onUpdate 里的 setTocItems 按官方指南推迟到微任务，避免与 PM 的 DOM 变更同帧竞争 | React 19 实测无警告，保险性质 |

## 修复前后对比（同条件同脚本相邻执行，默认档，单位：汉字）

| 指标 | 10 万字 | 20 万字 | 30 万字 | 50 万字 |
| --- | --- | --- | --- | --- |
| 打字 P50 前→后 | 10.6→6.3ms | 32.3→11.8ms | 57.6→17.6ms | 126.2→30.4ms |
| Enter P95 前→后 | 16.8→11.3ms | 49.4→15.5ms | 63.7→20.0ms | 215.6→34.9ms |
| 滚动帧 P95 前→后 | 满帧 | 满帧 | 33.4→16.8ms | **83.4→16.7ms（12fps→满帧）** |
| 全选加粗 前→后 | 1.34→1.19s | 4.78→3.90s | 8.92→8.69s | 26.8→25.8s |
| 堆内存（GC 后） | 27MB | 36.6MB | 46.3MB | 110.9→61.7MB |

- `toc=1` 显式开目录的宿主仍付 TOC 扫描（20 万字打字 P50 31ms）——默认档不再为未开启的功能买单。
- 大事务只改善 4~18%：主成本在 prosemirror-transform 位置映射与 tiptap `getChangedRanges`（上游固有）。

## 剩余瓶颈（修复后重测归因）

1. **大范围事务（唯一"不可用级"，库层无解）**——50 万字全选加粗 25.8s。构成：prosemirror-transform StepMap/appendMap/invert ~25% 自耗时 + tiptap `getChangedRanges`/`simplifyChangedRanges`（O(N²) 区间化简）~29%。富文本结构放大 6 倍（6 万字纯段落 87.6ms vs 混合 508ms）。出路：上游 issue；宿主批量操作走 `markdownRange`/`replaceRange` 区间级路径。
2. **装载期 markdown 解析**——editor-ready（数据就绪→可打字，主线程冻结）：10 万 593ms / 30 万 3.8s / 50 万 10.3s。构成：官方解析装配（`parseIndentedBlocks`+`tokenize`，均在 @tiptap core/markdown 内）~47% 采样 + 本库自定义 tokenizer 正则 ~12% + PM 建树/DOM ~40%。本质：解析=搜索（字符串→树需消歧义），序列化=遍历（50 万字 getMarkdown 仅 44ms），不对称固有。官方无现成方案。
3. **可选功能每事务税**——`toc=1`（见上）；`characterCount=1`（官方 CharacterCount 每次调用全文档遍历，useEditorState 每事务 2 次，事务 P50 ×4）；查找有搜索词时的装饰。语义：显式开启者付。
4. **DOM 规模天花板**——50 万字 DOM 7.5 万节点、监听器 2.5 万；虚拟化官方无方案且 PM 坐标模型不支持。超大规模持续编辑只能产品级分章。

## 候选优化（动手顺序）

1. ~~**分块装载 + 版本 JSON 缓存**~~：历史预览已落地（见上「进行中」）；编辑器主路径大文档装载仍可复用同一套切分器。**不变量**：`splitTopLevelMarkdown` 认领清单须与本库 tokenizer 同步——围栏/表格/列表/`<details>`/`<figure>`/`$$`，「按空行切」是错的。装载期 `addToHistory: false`。
2. **Worker 预解析**（刻意延后）：baseExtensions 无 DOM 依赖，整链进 worker 产出 JSON，主线程只建 DOM。注意：编辑模式必须完整树。
3. **CharacterCount 防抖计数**：自研增量/防抖版替代官方 storage 直读。等真实宿主抱怨再做。
4. **上游 issue 三连**：tiptap `simplifyChangedRanges` O(N²)；`parseIndentedBlocks` 大文档装配成本；@tiptap/react `captureDOMSelection` 每事务同步读 DOM 选区（打字热点 ~8%）。

## 历史参考值（1.9.x 早期基线，开发机单点）

| 场景 | 打字 P50 | 大事务 P50 | `getMarkdown` |
| --- | --- | --- | --- |
| 3 万字符混合 | ~5ms | ~160ms | ~6ms |
| 6 万字符混合 | ~7ms | ~490ms | ~13ms |
| 6 万字符纯段落 | ~4ms | ~73ms | ~7ms |
