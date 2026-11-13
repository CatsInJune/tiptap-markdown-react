import { ReactNodeViewRenderer } from '@tiptap/react';
import { reportChart, type ReportChartOptions } from './ChartExtension';
import { ChartView } from '../components/ChartView';
import type { ChartTheme } from './types';

export interface CreateChartOptions {
  chartTheme?: ChartTheme | null;
}

export interface InteractiveChartOptions extends ReportChartOptions {
  chartTheme: ChartTheme | null;
}

/**
 * Client chart extension with React NodeView.
 * Server / pure HTML paths should use {@link reportChart} / {@link pureChart}.
 */
export function createChart(options: CreateChartOptions = {}) {
  const { chartTheme = null } = options;
  return reportChart.extend<InteractiveChartOptions>({
    addOptions() {
      return {
        HTMLAttributes: {},
        chartTheme,
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(ChartView);
    },
  });
}
