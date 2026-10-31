# 性能实测档案与待办

> **复现**：`node site/scripts/perf-bench.mjs`（`--only <名>` 过滤；`--profile <名> --profile-action typing|bigtx|load` 出 CPU 热点，按包/函数聚合自耗时）。
> **设施**：`site/bench.html` + `site/src/bench.tsx`（lib 模式走 dist=真实用户路径；custom 模式引 src 做扩展减法归因；`content=json` 对照跳过 markdown 解析层，fixture 在 `site/public/bench-fixtures/`）。矩阵与 query 参数见脚本头注释。
> **产物**：`site/bench-results/`（本地未入库，含 .cpuprofile）。
> **官方资料**：[性能指南](https://tiptap.dev/docs/guides/performance)（只覆盖 React 渲染层，不覆盖装载）；[20 万词示例](https://tiptap.dev/docs/examples/basics/long-texts)（裸编辑器、JSON 直灌、无 markdown 层——官方对大 markdown 装载没有现成方案）。

## 已修复（2026-11-01，feat/perf-large-docs 分支）

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

## 候选优化（动手顺序：1 → 2，3/4 按需）

1. **分块装载**（收益最确定）：块边界扫描器（**新不变量：认领清单须与本库 tokenizer 同步维护**——代码块围栏/表格/列表嵌套/`:::details`/`<figure>`/`$$` 都是多行块，「按空行切」是错的）+ 先 `setContent` 首块、idle 续装 `insertContentAt`。**装载期必须抑制 TOC/CharacterCount/undo（`addToHistory: false`）**，装完放行一次——否则每块一个事务会把每事务税乘以块数。首屏 10.3s→亚秒。切分器组件将来可复用为宿主「分段存储」的存储切分器。
2. **Worker 预解析**：baseExtensions 无 DOM 依赖（server 端已在 Node 跑通），整链（官方 marked 引擎+本库 tokenizer）进 worker 产出 doc JSON，主线程只 `nodeFromJSON`+建 DOM——装载冻结再减半。一期之后叠加。注意：编辑模式必须完整树，「只装视口附近」不成立（光标/查找/undo 都假设整树）。
3. **CharacterCount 防抖计数**：自研增量/防抖版替代官方 storage 直读。等真实宿主抱怨再做。
4. **上游 issue 三连**：tiptap `simplifyChangedRanges` O(N²)；`parseIndentedBlocks` 大文档装配成本；@tiptap/react `captureDOMSelection` 每事务同步读 DOM 选区（打字热点 ~8%）。

## 历史参考值（1.9.x 早期基线，开发机单点）

| 场景 | 打字 P50 | 大事务 P50 | `getMarkdown` |
| --- | --- | --- | --- |
| 3 万字符混合 | ~5ms | ~160ms | ~6ms |
| 6 万字符混合 | ~7ms | ~490ms | ~13ms |
| 6 万字符纯段落 | ~4ms | ~73ms | ~7ms |
