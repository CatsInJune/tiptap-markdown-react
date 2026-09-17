/** MVP chart types aligned with agentic-ui (subset). */
export const MVP_CHART_TYPES = [
  'line',
  'bar',
  'column',
  'pie',
  'donut',
  'area',
] as const;

export type MvpChartType = (typeof MVP_CHART_TYPES)[number];

export function isMvpChartType(value: unknown): value is MvpChartType {
  return (
    typeof value === 'string' &&
    (MVP_CHART_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Flat chart config (author / LLM form).
 * `subgraphBy` is accepted but ignored in v1.
 */
export interface ChartConfig {
  chartType: string;
  x?: string;
  y?: string;
  title?: string;
  height?: number;
  dataTime?: string;
  groupBy?: string;
  filterBy?: string;
  colorLegend?: string;
  sortBy?: string;
  subgraphBy?: string;
  [key: string]: unknown;
}

export interface ChartColumn {
  title: string;
  dataIndex: string;
}

/** Normalized payload stored on the TipTap chart node. */
export interface ChartPayload {
  config: ChartConfig[];
  columns: ChartColumn[];
  dataSource: Record<string, unknown>[];
}

/** Optional host override for Chart.js colors / fonts. */
export interface ChartTheme {
  backgroundColor?: string;
  textColor?: string;
  gridColor?: string;
  borderColor?: string;
  fontFamily?: string;
  palette?: string[];
}
