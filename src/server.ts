/**
 * RSC / SSR 安全入口——纯函数与静态渲染，无任何客户端组件、无 UI 框架依赖、无浏览器 API
 * 硬依赖（可在 Server Component / ISR 内直接导入）。
 *
 * 注意：导出的 `ReportContent` 是**无 'use client' 的 React 组件**，因此本入口在
 * 非 React 的 Node SSR 里仍需要 React peer；只做 markdown→HTML 时用
 * `renderReportHtml`（它本身不依赖 React）。
 *
 * 纯工具（章节切分、规范化、块 ID、脚注抽取、图片属性归一化）也从这里导出，
 * 避免 RSC 宿主为了用它们被迫 import 主入口（主入口带 'use client'）。
 */
export {
  baseExtensions,
  lowlight,
  pureCodeBlock,
  pureImage,
  pureChart,
  reportChart,
} from './extensions';
export { CitationRef } from './CitationRef';
export { prepareChartMarkdown } from './chart/prepareChartMarkdown';
export { serializeChartPayload } from './chart/serialize';
export type {
  ChartConfig,
  ChartColumn,
  ChartPayload,
  ChartTheme,
  MvpChartType,
} from './chart/types';
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
  applyCitationSources,
  enrichMarkdownCitations,
  extractFootnoteSources,
  type ExtractedFootnotes,
  type SourceRef,
} from './citationUtils';
export { ReportContent, type ReportContentProps } from './ReportContent';
export {
  renderReportHtml,
  type RenderedReport,
  type RenderReportHtmlOptions,
} from './renderReportHtml';
export { stabilizeMarkdown } from './stabilizeMarkdown';
export { extractToc, type TocItem } from './toc/extractToc';
export { makeTocGetId } from './toc/tocSlug';

// ── 纯工具（不依赖编辑器 / 浏览器）──
export { splitIntoChapters } from './chapters/splitIntoChapters';
export { serializeChapterMarkdown } from './chapters/chapterMarkdown';
export {
  alignChapters,
  type ChapterBaseline,
  type ChapterDraft,
  type ChapterDelta,
} from './chapters/alignChapters';
export { normalizeMarkdown } from './normalizeMarkdown';
export {
  BLOCK_ID_ATTR,
  BLOCK_ID_LINE_RE,
  createBlockId,
  formatBlockIdLine,
  normalizeBlockId,
  readBlockIdLine,
  stripBlockIdComments,
} from './blockId/id';
export {
  normalizeImageAlign,
  normalizeImageCaption,
  normalizeImageCrop,
  type ImageAlign,
  type ImageCrop,
} from './imageMarkdown';
