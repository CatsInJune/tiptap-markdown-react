'use client';

import {
  ReportContent,
  type ReportContentProps,
} from '../ReportContent';
import { ContentOutline } from './ContentOutline';
import { ImagePreviewHost } from './ImageLightbox';
import { useMarkdownLocale } from './TiptapConfigProvider';

export interface ReaderReportContentProps extends ReportContentProps {
  /**
   * 内置左缘目录（默认关闭）。传入后，有 `data-toc-id` 的标题时显示短横线，
   * 悬停展开，点击滚动。宽度小于 768px 时不显示。
   */
  toc?: boolean;
}

/**
 * `./reader` 的 ReportContent：静态 HTML 加上和编辑器同一套左缘目录。
 * `./server` 导出的同名组件仍是纯 HTML，没有这块界面。
 */
export function ReaderReportContent({
  html,
  className,
  toc = false,
  ...rest
}: ReaderReportContentProps) {
  const locale = useMarkdownLocale();
  return (
    <ContentOutline toc={toc} locale={locale} watch={html}>
      <ImagePreviewHost locale={locale} activate="click">
        <ReportContent html={html} className={className} {...rest} />
      </ImagePreviewHost>
    </ContentOutline>
  );
}
