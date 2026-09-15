'use client';

/**
 * 阅读页入口：只贴 SSR HTML + 脚注 click 委托。
 *
 * 不 import `./extensions`（TableKit / CellSelection）。主入口 `.` 与 `./server`
 * 都会在模块加载时 `jsonID("cell")`；同一 JS realm 里两套一起加载会抛
 * `Duplicate use of selection JSON ID cell`。阅读页用本入口即可与 `/server`
 * 共存（表格已是静态 HTML，不必再注册选区）。
 */
export { ReportContent, type ReportContentProps } from './ReportContent';
export {
  CitationInteractive,
  type CitationInteractiveProps,
} from './components/CitationInteractive';
export {
  ReportContentInteractive,
  type ReportContentInteractiveProps,
} from './components/ReportContentInteractive';
export type {
  CitationEnterContext,
  OnCitationEnter,
  OnCitationLeave,
  RenderCitation,
  RenderCitationContext,
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
export { scrollToTocHeading } from './toc/scrollToTocHeading';
export type { TocItem } from './toc/extractToc';
