'use client';

import { useRef, type ComponentProps } from 'react';
import type { ChartTheme } from '../chart/types';
import type { OnCitationEnter, OnCitationLeave } from '../citationTypes';
import type { LocaleCode } from '../i18n';
import { ReportContent } from '../ReportContent';
import { ChartMount } from './ChartMount';
import { CitationInteractive } from './CitationInteractive';
import { ReaderReportContent } from './ReaderReportContent';

export interface ReportContentWithChartsProps
  extends Omit<ComponentProps<typeof ReportContent>, 'ref'> {
  onCitationEnter?: OnCitationEnter;
  onCitationLeave?: OnCitationLeave;
  chartTheme?: ChartTheme | null;
  /** 内置左缘目录，默认关闭。 */
  toc?: boolean;
  /** 目录按钮的无障碍文案。默认英文。 */
  locale?: LocaleCode;
}

/**
 * SSR HTML reading surface with Chart.js hydration (+ optional citation clicks).
 */
export function ReportContentWithCharts({
  onCitationEnter,
  onCitationLeave,
  chartTheme,
  className,
  html,
  toc = false,
  locale = 'en',
  ...rest
}: ReportContentWithChartsProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className={className}>
      <ReaderReportContent html={html} toc={toc} locale={locale} {...rest} />
      <ChartMount
        containerRef={ref}
        chartTheme={chartTheme}
        html={html}
      />
      {onCitationEnter && onCitationLeave ? (
        <CitationInteractive
          containerRef={ref}
          onCitationEnter={onCitationEnter}
          onCitationLeave={onCitationLeave}
        />
      ) : null}
    </div>
  );
}
