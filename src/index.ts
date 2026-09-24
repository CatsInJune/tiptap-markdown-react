'use client';

// 副作用：增强 Editor.insertContent / getMarkdown 的 @tiptap/markdown 类型。
import '@tiptap/markdown';
import 'katex/dist/katex.min.css';
import './styles/math.css';
import './styles/chart.css';

// ── 编辑器 / 预览 ──
export {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorHandle,
  type MarkdownWysiwygEditorProps,
} from './components/MarkdownWysiwygEditor';
export {
  MarkdownPreview,
  type MarkdownPreviewProps,
} from './components/MarkdownPreview';

// ── 工具栏 / 色板 / 目录 ──
export {
  EditorToolbar,
  type EditorToolbarProps,
  type ExtraToolbarItem,
  type ImportDocumentContext,
  type ImportDocumentProgress,
  type ImportDocumentResult,
  type ImportMenuItem,
} from './components/EditorToolbar';
export { ColorPalette, type ColorPaletteProps } from './components/ColorPalette';
export { TocPanel, type TocPanelProps } from './components/TocPanel';
export { CodeBlockView } from './components/CodeBlockView';
export {
  FindReplaceBar,
  type FindReplaceBarProps,
} from './components/FindReplaceBar';

// ── 只读静态正文（阅读页请改从 ./reader 引入，避免与 ./server 重复注册 TableKit） ──
export { ReportContent, type ReportContentProps } from './ReportContent';
export {
  CitationInteractive,
  type CitationInteractiveProps,
} from './components/CitationInteractive';
export {
  ReportContentInteractive,
  type ReportContentInteractiveProps,
} from './components/ReportContentInteractive';

// ── 扩展（供组合 extraExtensions 或自建管线） ──
export {
  baseExtensions,
  lowlight,
  pureCodeBlock,
  pureImage,
  pureChart,
  reportChart,
} from './extensions';
export { createChart } from './chart/createChart';
export { prepareChartMarkdown } from './chart/prepareChartMarkdown';
export { serializeChartPayload } from './chart/serialize';
export type {
  ChartConfig,
  ChartColumn,
  ChartPayload,
  ChartTheme,
  MvpChartType,
} from './chart/types';
export { ChartMount, mountChartsInContainer } from './components/ChartMount';
export {
  ReportContentWithCharts,
  type ReportContentWithChartsProps,
} from './components/ReportContentWithCharts';
export { CitationRef } from './CitationRef';
export { ImportPlaceholder } from './importPlaceholder';
export { createCitationRef } from './createCitationRef';
export type {
  RenderCitation,
  RenderCitationContext,
  CitationEnterContext,
  OnCitationEnter,
  OnCitationLeave,
} from './citationTypes';
export {
  findCitationRefElement,
  readCitationAttrs,
} from './citationDom';
export {
  applyCitationSources,
  enrichMarkdownCitations,
  type SourceRef,
} from './citationUtils';
export { stabilizeMarkdown } from './stabilizeMarkdown';
export { MarkdownPaste, looksLikeMarkdown } from './markdownPaste';
export { MarkdownFileDrop } from './markdownFileDrop';

// ── 目录工具 / 类型 ──
export { extractToc, type TocItem } from './toc/extractToc';
export { makeTocGetId } from './toc/tocSlug';
export { scrollToTocHeading } from './toc/scrollToTocHeading';

// ── 文案默认值 / 类型（i18n 注入） ──
export {
  defaultChartLabels,
  defaultCodeBlockLabels,
  defaultColorPaletteLabels,
  defaultCommentLabels,
  defaultFindLabels,
  defaultTocLabels,
  defaultToolbarLabels,
  type ChartLabels,
  type CodeBlockLabels,
  type ColorPaletteLabels,
  type CommentLabels,
  type FindLabels,
  type TocLabels,
  type ToolbarLabels,
} from './labels';

// ── 评论锚定（编辑态专属） ──
export { CommentMark, type CommentMarkOptions, type CommentInterval } from './commentAnchor/CommentMark';
export {
  mapCommentAnchors,
  mergeCommentIntervals,
  blockTextHash,
  type CommentSegment,
  type CommentAnchorInput,
  type CommentAnchorResult,
  type CommentAnchorStatus,
  type CommentRange,
} from './commentAnchor/commentMapper';
export {
  commentAnchorPlugin,
  commentAnchorExtension,
  commentAnchorPluginKey,
  stripCommentAnchorMarks,
  COMMENT_ACTIVE_META,
  COMMENT_CLICK_META,
  COMMENT_GUTTER_META,
  type CommentAnchorPluginOptions,
  type CommentAnchorPluginState,
  type CommentGutterPayload,
} from './commentAnchor/commentAnchorPlugin';
export {
  applyCommentAnchorsToEditor,
  collectCommentIds,
  commentRangesById,
  focusComment,
  nextComment,
} from './commentAnchor/commentAnchorController';
export { CommentPopover, type CommentPopoverProps } from './commentAnchor/CommentPopover';
export type {
  CommentRef,
  CommentClickPayload,
  RenderComment,
  RenderCommentContext,
} from './commentAnchor/commentTypes';

// ── 其它 ──
export { useIsMobile } from './hooks/useIsMobile';
export * from './icons';

export { insertMarkdown } from './insertMarkdown';
export { findRangeByAnchor, type AnchorRange } from './anchorRange';
export {
  getMarkdownForRange,
  type GetMarkdownForRangeOptions,
  type MarkdownRange,
} from './markdownRange';
export { normalizeMarkdown } from './normalizeMarkdown';
export {
  PENDING_ANCHOR_CLASS,
  type PendingAnchor,
} from './pendingAnchor';
export { replaceRangeWithMarkdown, type ReplaceRangeOptions } from './replaceRange';
export { FIND_DEBOUNCE_MS, runFindCommand } from './findReplace';
export { selectionKind, type SelectionKind } from './selectionKind';

// ── 常用 Tiptap 类型（宿主无需再安装 / import @tiptap/*） ──
export type { Editor } from '@tiptap/react';
export type { JSONContent } from '@tiptap/core';
// 必须**从类型上**再导出一次 @tiptap/markdown 的东西：文件顶部那个副作用 import 只保证
// 库自身编译时带上 `Editor.getMarkdown` 的 module augmentation，vite-plugin-dts 不会把它
// 写进 dist/index.d.ts，于是宿主那边 `editor.getMarkdown()` 报「属性不存在」。
// 类型再导出会让 TS 加载该模块的声明，augmentation 才跟着生效。
export type { MarkdownManager } from '@tiptap/markdown';
// 查找替换扩展同样再导出：宿主自建管线（extraExtensions / 自组 extensions）时不必再装一次
// @tiptap/extension-find-and-replace，拿到的也是与本组件注册的同一份（单例 schema）。
export { default as FindAndReplace } from '@tiptap/extension-find-and-replace';
export type {
  FindAndReplaceOptions,
  FindAndReplaceStorage,
  SearchResult as FindSearchResult,
} from '@tiptap/extension-find-and-replace';
