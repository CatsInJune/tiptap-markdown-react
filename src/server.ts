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
export { ReportContent, type ReportContentProps } from './ReportContent';
export { renderReportHtml, type RenderedReport } from './renderReportHtml';
export { extractToc, type TocItem } from './toc/extractToc';
export { makeTocGetId } from './toc/tocSlug';
