import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
} from 'chart.js';
import { buildChartJsData } from './mapData';
import { resolveChartTheme } from './theme';
import type { ChartConfig, ChartPayload, ChartTheme } from './types';

let registered = false;

function ensureRegister() {
  if (registered) return;
  if (typeof window === 'undefined') return;
  Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    LineController,
    BarController,
    PieController,
    DoughnutController,
    Filler,
    Legend,
    Tooltip,
  );
  registered = true;
}

function toChartJsType(chartType: string): ChartType {
  switch (chartType) {
    case 'bar':
      return 'bar';
    case 'column':
      return 'bar';
    case 'line':
      return 'line';
    case 'area':
      return 'line';
    case 'pie':
      return 'pie';
    case 'donut':
      return 'doughnut';
    default:
      return 'bar';
  }
}

export interface RenderChartOptions {
  canvas: HTMLCanvasElement;
  config: ChartConfig;
  payload: Pick<ChartPayload, 'dataSource' | 'columns'>;
  theme?: ChartTheme | null;
  /** Existing instance to update in place (streaming). */
  chart?: Chart | null;
}

export function renderOrUpdateChart({
  canvas,
  config,
  payload,
  theme,
  chart,
}: RenderChartOptions): Chart | null {
  if (typeof window === 'undefined') return null;
  ensureRegister();

  const host = canvas.parentElement;
  const colors = resolveChartTheme(host, theme);
  const built = buildChartJsData(config, payload);
  const jsType = toChartJsType(config.chartType);
  const isBarHorizontal = config.chartType === 'bar';
  const isArea = config.chartType === 'area';

  const datasets = built.datasets.map((ds, i) => {
    const color = colors.palette[i % colors.palette.length];
    if (!built.isCartesian) {
      return {
        ...ds,
        backgroundColor: built.labels.map(
          (_, j) => colors.palette[j % colors.palette.length],
        ),
        borderWidth: 0,
      };
    }
    return {
      ...ds,
      backgroundColor: isArea ? `${color}33` : color,
      borderColor: color,
      borderWidth: 2,
      fill: isArea,
      tension: 0.25,
    };
  });

  const configuration: ChartConfiguration = {
    type: jsType,
    data: {
      labels: built.labels,
      datasets,
    },
    options: {
      indexAxis: isBarHorizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: built.datasets.length > 1 || !built.isCartesian,
          labels: {
            color: colors.textColor,
            font: { family: colors.fontFamily },
          },
        },
        title: { display: false },
        tooltip: {
          titleFont: { family: colors.fontFamily },
          bodyFont: { family: colors.fontFamily },
        },
      },
      scales: built.isCartesian
        ? {
            x: {
              ticks: {
                color: colors.textColor,
                font: { family: colors.fontFamily },
              },
              grid: { color: colors.gridColor },
              border: { color: colors.borderColor },
            },
            y: {
              ticks: {
                color: colors.textColor,
                font: { family: colors.fontFamily },
              },
              grid: { color: colors.gridColor },
              border: { color: colors.borderColor },
            },
          }
        : undefined,
    },
  };

  if (chart) {
    (chart.config as { type: ChartType }).type = jsType;
    chart.data.labels = configuration.data.labels;
    chart.data.datasets = configuration.data.datasets as never;
    chart.options = configuration.options as never;
    chart.update('none');
    return chart;
  }

  return new Chart(canvas, configuration);
}

export function destroyChart(chart: Chart | null | undefined) {
  chart?.destroy();
}
