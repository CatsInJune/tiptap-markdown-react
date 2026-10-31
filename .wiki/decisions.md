# 决策记录

每条 = 决策 + 背景 + 影响面。对外（用户视角）的完整叙述在 [GitHub Wiki: Design-Decisions](https://github.com/CatsInJune/tiptap-markdown-react/wiki/Design-Decisions)，这里只留工程要点，两边不重复维护。

| # | 决策 | 背景 | 影响代码 | 状态 |
| --- | --- | --- | --- | --- |
| D1 | 单 `$` 永远是货币符；公式用 `$$…$$`（内联）/ 换行 `$$`（块） | 业务文本（财报/价格）里 `$` 是货币，标准 `$x$` 会误判；`$24.4B$` 也不是公式 | `math.ts`、`extensions.ts`（typography 配置） | 已拍板，保持现状 |
| D2 | 付费 Tiptap 组件不进 MIT 包 | `table-node` 注册接口 401、`image-align-button` 付费、`extension-figure` npm 404 | 表格手柄 `components/TableHandles.tsx`、图片对齐 `ImageAlignTools.tsx`、图注 `imageCaption.ts` 全部自研 | 长期 |
| D3 | 不暴露 `mergeCells`/`splitCell` | GFM 无 colspan，合并后导出 `| 1<br>2 |` 无法还原；只留「清空内容」「重置单元格样式」 | `TableHandles.tsx` | 长期（除非 GFM 改） |
| D4 | `@tiptap/*` 精确版本 | caret 跨小版本插件状态不兼容（pnpm 宿主错配 3.31.4/3.31.3） | `package.json` | 长期 |
| D5 | 样式「只在用到时」写 HTML | 未触碰内容保持原生 markdown；其他渲染器净化 style 只丢装饰不丢内容 | 各 `*Markdown.ts` 序列化器 | 长期 |
| D6 | 零 UI 框架、Radix + 内联 SVG、`--tmr-*` 主题 | 库的卖点；宿主可能带任何框架 | `components/`、`styles/` | 长期 |
| D7 | 移植逻辑不 vendor 源码 | LinkPopover 按官方 MIT 组件逻辑重写（修了官方两个 bug），无 Tailwind/额外依赖 | `components/LinkPopover.tsx` | 模式惯例 |
| D8 | tag/GitHub Release 停用 | 发布只走 npm + GitHub Wiki Changelog | 发布流程（GitHub Wiki: Release-Process） | 长期 |
| D9 | 目录扩展按需注册：`toc \|\| onTocChange` 传入才注册 TableOfContents | 官方扩展每内容事务全文档遍历两遍，不开目录的宿主不该付税（20 万字打字 P50 32.3→11.8ms）；扩展注册只在初始化，onTocChange 契约不变 | `components/MarkdownWysiwygEditor.tsx` | 已发布（1.9.2）；对使用者可见，**待同步 GitHub Wiki** |
| D10 | 官方 Emoji 的 addStorage 按引用缓存（WeakMap） | 官方 `Extension.storage` 是无缓存 getter，事务路径反复触发几千 emoji 的 O(N²) 重算（大事务自耗时 ~15%）；按 `options.emojis` 引用缓存，自定义 emojis 配置互不串 | `emoji/markdownEmoji.ts` | 已发布（1.9.2） |

新增决策时：在本表加行；若对使用者可见，同步 GitHub Wiki 对应页。
