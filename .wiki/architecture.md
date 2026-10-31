# 架构与代码地图

## 三个入口（产物级边界）

| 入口 | 定位 | 关键约束 |
| --- | --- | --- |
| `src/index.ts`（`tiptap-markdown-react`） | 编辑器 / 工具栏 / 实时预览 | 加载 `TableKit` |
| `src/server.ts`（`./server`） | RSC/ISR 的 `renderReportHtml` | 无 React 组件、无浏览器 API 硬依赖；也加载 `TableKit` |
| `src/reader.ts`（`./reader`） | 客户端阅读页水合 | **不 import `./extensions`**——`.` 与 `./server` 在模块加载时都会 `jsonID("cell")`，同一 JS realm 双载会抛 `Duplicate use of selection JSON ID cell` |

入口头的注释写了完整机制，改入口前先读。

## base / 增强分层（`src/extensions.ts`）

`baseExtensions` 是「内容 schema 级」扩展集：纯节点/标记定义，**不含 React NodeView 与键盘绑定**，被编辑器、预览、server 三处共用（server bundle 不能进 React 代码）。

关键规则（详见 `extensions.ts` 头注释）：CodeBlock / Image / CitationRef 会被客户端增强，**不放进 base**——否则编辑器追加增强版会和 base 纯版同名冲突（`Duplicate extension names`）。base 不含它们，由调用方注入：编辑器/预览注增强版，server 注纯版（`pureCodeBlock` / `pureImage` / `pureChart`）。

`InlineCode` 特意 `excludes: ''`：StarterKit 默认的 Code 禁止与其他 mark 共存，会在 `**bold \`code\` bold**` 导入时抛 RangeError。

## 共享 tokenizer

markdown 没有原生语法的样式（图片缩放/对齐/图注、段落对齐缩进行高、颜色字号）序列化为行内 HTML。解析端由**自建 tokenizer 认领整段标签**（先于 `window.DOMParser` 路径），内层再交回 inline lexer——这样 SSR（无 DOMParser）也能还原，且标签内的 `**加粗**` 等照常解析。相关序列化器都写在对应功能文件里（`imageMarkdown.ts`、`paragraphMarkdown.ts`、`paragraphStyles.ts`、`math.ts`、`detailsMarkdown.ts`），认领逻辑集中在 `extensions.ts`。

## `src/` 顶层文件速查

按职责分组（`.test.ts(x)` 同名配对，未列出）：

- **入口与组装**：`index.ts`（导出面，~69 个导出）、`server.ts`、`reader.ts`、`extensions.ts`（baseExtensions + 共享 lowlight）
- **编辑器组件**：`components/MarkdownWysiwygEditor.tsx`（主组件）、`MarkdownPreview.tsx`、`ReportContent.tsx`（server 用）、`components/ReaderReportContent.tsx` 等
- **工具栏**：`components/EditorToolbar.tsx`、`ColorPalette.tsx`、`LinkPopover.tsx`、`components/FindReplaceBar.tsx`（可与 `findReplace.ts` 配合）
- **功能域目录**（`src/<域>/`，各自带 Extension + 序列化 + 测试）：
  - `chart/` — 图表（注释 JSON + GFM 表；`ChartExtension`、`codeBlockChartParse`、`createChart`）
  - `commentAnchor/` — 评论锚（session-only mark、gutter、popover、`commentMapper` 段落定位）
  - `emoji/` — `:smile:` 短代码（`markdownEmoji.ts`、`EmojiSuggestion.tsx`）
  - `slashMenu/` — 斜杠菜单（官方 `@tiptap/suggestion` 自绘）
  - `blockDrag/` — 块拖拽（含列表内 drop 规则）
  - `toc/` — 目录抽取与 slug（`extractToc`、`tocSlug`、`scrollToTocHeading`）
  - `versionHistory/` — 历史版本面板的 diff/还原（`buildDiffDoc`、`restoreVersion`）
  - `shortcuts/` — 快捷键抽屉面板
- **单文件功能**：`math.ts`（公式往返）、`imageMarkdown.ts` / `imageUpload.ts` / `imageResize.dom` / `imageAlign.ts` / `imageCaption.ts` / `imageCrop.ts` / `imagePreview.ts`（图片系）、`paragraphStyles.ts` / `paragraphMarkdown.ts`（段落三件套）、`numberingFormat.ts`、`supSub`（序列化器在 `extensions.ts`）、`highlightMarkdown` / `textStyleMarkdown`（测试见证语法）、`findReplace.ts`、`formatBrush.ts`、`fullscreen.ts`、`characterCount.ts`（正文文档标题在 `components/MarkdownWysiwygEditor.tsx` 内，无独立文件）
- **markdown 管线**：`markdownPaste.ts`（粘贴启发式 `looksLikeMarkdown`）、`markdownFileDrop.ts`、`importMenu.ts`、`insertMarkdown.ts`、`normalizeMarkdown.ts`、`stabilizeMarkdown.ts`（补未闭合围栏）、`markdownRange.ts` / `replaceRange.ts` / `anchorRange.ts`（区间级操作）、`pendingAnchor.ts`
- **服务端/阅读**：`renderReportHtml.ts`、`citationUtils.ts` / `CitationRef.ts` / `extractFootnoteSources`（脚注抽取）、`ReportContentInteractive.tsx`（水合）
- **i18n**：`labels.ts`（类型 + 英文默认）、`i18n/zh.ts`（中文包）、`i18n/store.ts`
- **样式**：`styles/*.module.css`（每功能一个），内容样式在 `styles/content.module.css`，主题变量 `--tmr-*`

## 测试布局

- 单测与 DOM 测试同目录共存：`*.test.ts`（node 环境）/ `*.dom.test.tsx`（happy-dom，文件头 `// @vitest-environment happy-dom`）
- markdown 往返行为变更必须补往返用例（模式：`getMarkdown()` 断言 → 重新 parse → 再断言）
- 没有布局/视觉快照测试——见 [conventions.md](conventions.md) 的验收方法
