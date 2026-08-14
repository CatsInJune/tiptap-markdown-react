/**
 * RSC / SSR 安全入口——纯函数与静态渲染，无任何客户端组件、无 antd、无浏览器 API
 * 硬依赖（可在 Server Component / ISR 内直接 import）。
 */
export {
  baseExtensions,
  lowlight,
  pureCodeBlock,
  pureImage,
} from './extensions';
export { CitationRef } from './CitationRef';
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
  type SourceRef,
} from './citationUtils';
export { ReportContent, type ReportContentProps } from './ReportContent';
export {
  renderReportHtml,
  type RenderedReport,
  type RenderReportHtmlOptions,
} from './renderReportHtml';
export { extractToc, type TocItem } from './toc/extractToc';
export { makeTocGetId } from './toc/tocSlug';
