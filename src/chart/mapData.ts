import type { ChartConfig, ChartPayload } from './types';

export interface ChartJsPoint {
  x: string | number;
  y: number;
  category?: string;
  type?: string;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, ''));
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/**
 * Map table rows to flat chart points for one config.
 * colorLegend → series `type`; groupBy stored as category (no UI filter in v1).
 */
export function mapChartDataItems(
  config: ChartConfig,
  dataSource: Record<string, unknown>[],
): ChartJsPoint[] {
  const xKey = config.x!;
  const yKey = config.y!;
  const legendKey = config.colorLegend;
  const groupKey = config.groupBy;

  let rows = [...dataSource];
  const sortKey = config.sortBy;
  if (sortKey) {
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
        numeric: true,
      });
    });
  }

  return rows.map((row) => {
    const point: ChartJsPoint = {
      x: row[xKey] as string | number,
      y: toNumber(row[yKey]),
    };
    if (legendKey) point.type = String(row[legendKey] ?? '');
    if (groupKey) point.category = String(row[groupKey] ?? '');
    return point;
  });
}

export interface BuiltChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
  isCartesian: boolean;
}

/** Build Chart.js labels/datasets for one active config. */
export function buildChartJsData(
  config: ChartConfig,
  payload: Pick<ChartPayload, 'dataSource'>,
): BuiltChartData {
  const points = mapChartDataItems(config, payload.dataSource);
  const type = config.chartType;
  const isCartesian = !['pie', 'donut'].includes(type);

  if (!isCartesian) {
    return {
      labels: points.map((p) => String(p.x)),
      datasets: [
        {
          label: config.title || config.y || 'value',
          data: points.map((p) => p.y),
        },
      ],
      isCartesian: false,
    };
  }

  const seriesKeys = new Set<string>();
  for (const p of points) {
    seriesKeys.add(p.type || config.title || config.y || 'series');
  }
  const seriesList = [...seriesKeys];
  const labelSet: string[] = [];
  for (const p of points) {
    const lab = String(p.x);
    if (!labelSet.includes(lab)) labelSet.push(lab);
  }

  const datasets = seriesList.map((series) => ({
    label: series,
    data: labelSet.map((lab) => {
      const hit = points.find(
        (p) =>
          String(p.x) === lab &&
          (p.type || config.title || config.y || 'series') === series,
      );
      return hit ? hit.y : 0;
    }),
  }));

  return { labels: labelSet, datasets, isCartesian: true };
}
