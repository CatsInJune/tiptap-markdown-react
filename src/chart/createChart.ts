import { ReactNodeViewRenderer } from '@tiptap/react';
import { reportChart, type ReportChartOptions } from './ChartExtension';
import { ChartView } from '../components/ChartView';
import type { ChartTheme } from './types';
import type { ChartLabels } from '../labels';

export interface CreateChartOptions {
  /** When true, reserved for future in-place chart editing. Currently unused (no edit UI). Default false. */
  editable?: boolean;
  chartTheme?: ChartTheme | null;
  chartLabels?: Partial<ChartLabels>;
}

export interface InteractiveChartOptions extends ReportChartOptions {
  chartEditable: boolean;
  chartTheme: ChartTheme | null;
  chartLabels?: Partial<ChartLabels>;
}

/**
 * Client chart extension with React NodeView.
 * Server / pure HTML paths should use {@link reportChart} / {@link pureChart}.
 */
export function createChart(options: CreateChartOptions = {}) {
  // Chart config editing (modal) is disabled for now; keep option for later.
  const { editable = false, chartTheme = null, chartLabels } = options;
  return reportChart.extend<InteractiveChartOptions>({
    addOptions() {
      return {
        HTMLAttributes: {},
        chartEditable: editable,
        chartTheme,
        chartLabels,
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(ChartView);
    },
  });
}
