'use client';

import type { LocaleCode } from '../i18n';
import {
  ReportContent,
  type ReportContentProps,
} from '../ReportContent';
import { ContentOutline } from './ContentOutline';

export interface ReaderReportContentProps extends ReportContentProps {
  /**
   * 内置左缘目录（默认关闭）。传入后，有 `data-toc-id` 的标题时显示短横线，
   * 悬停展开，点击滚动。宽度小于 768px 时不显示。
   */
  toc?: boolean;
  /** 目录按钮的无障碍文案。默认英文。 */
  locale?: LocaleCode;
}

/**
 * `./reader` 的 ReportContent：静态 HTML 加上和编辑器同一套左缘目录。
 * `./server` 导出的同名组件仍是纯 HTML，没有这块界面。
 */
export function ReaderReportContent({
  html,
  className,
  toc = false,
  locale = 'en',
  ...rest
}: ReaderReportContentProps) {
  return (
    <ContentOutline toc={toc} locale={locale} watch={html}>
      <ReportContent html={html} className={className} {...rest} />
    </ContentOutline>
  );
}
