'use client';

import { useRef, type ComponentProps } from 'react';
import type { ChartTheme } from '../chart/types';
import type { OnCitationEnter, OnCitationLeave } from '../citationTypes';
import { ReportContent } from '../ReportContent';
import { ChartMount } from './ChartMount';
import { CitationInteractive } from './CitationInteractive';

export interface ReportContentWithChartsProps
  extends Omit<ComponentProps<typeof ReportContent>, 'ref'> {
  onCitationEnter?: OnCitationEnter;
  onCitationLeave?: OnCitationLeave;
  chartTheme?: ChartTheme | null;
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
  ...rest
}: ReportContentWithChartsProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className={className}>
      <ReportContent html={html} {...rest} />
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
