'use client';

import type { Chart as ChartJs } from 'chart.js';
import {
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { destroyChart, renderOrUpdateChart } from '../chart/renderChart';
import type { ChartPayload, ChartTheme } from '../chart/types';
import { defaultChartLabels } from '../labels';
import '../styles/chart.css';

function tabLabel(
  chartType: string,
  title: string | undefined,
  index: number,
  fallback: (type: string, i: number) => string,
): string {
  if (title?.trim()) return title;
  return fallback(chartType, index);
}

/**
 * Chart NodeView: render + NodeSelection (like Image).
 * Config editing is intentionally disabled for now (no modal).
 */
export function ChartView({
  node,
  editor,
  extension,
  selected,
  getPos,
}: NodeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJs | null>(null);
  const [active, setActive] = useState(0);

  const payload: ChartPayload = useMemo(
    () => ({
      config: (node.attrs.config ?? []) as ChartPayload['config'],
      columns: (node.attrs.columns ?? []) as ChartPayload['columns'],
      dataSource: (node.attrs.dataSource ??
        []) as ChartPayload['dataSource'],
    }),
    [node.attrs.config, node.attrs.columns, node.attrs.dataSource],
  );

  const theme = (extension.options.chartTheme ?? null) as ChartTheme | null;
  const configs = payload.config;
  const safeIndex = Math.min(active, Math.max(0, configs.length - 1));
  const config = configs[safeIndex];
  const height = config?.height ?? 320;
  const canSelect = Boolean(editor?.isEditable);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;
    chartRef.current = renderOrUpdateChart({
      canvas,
      config,
      payload,
      theme,
      chart: chartRef.current,
    });
  }, [config, payload, theme]);

  useEffect(() => {
    return () => {
      destroyChart(chartRef.current);
      chartRef.current = null;
    };
  }, []);

  // When active tab changes, recreate chart (type may differ)
  useEffect(() => {
    destroyChart(chartRef.current);
    chartRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !config) return;
    chartRef.current = renderOrUpdateChart({
      canvas,
      config,
      payload,
      theme,
      chart: null,
    });
  }, [safeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const labels = {
    ...defaultChartLabels,
    ...(extension.options.chartLabels as
      | Partial<typeof defaultChartLabels>
      | undefined),
  };

  const selectChart = () => {
    if (!editor || !canSelect) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.commands.setNodeSelection(pos);
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`tmr-chart${canSelect ? ' tmr-chart--interactive' : ''}${
        selected ? ' ProseMirror-selectednode' : ''
      }`}
      data-type="chart"
      data-selected={selected ? 'true' : undefined}
      contentEditable={false}
      onMouseDown={(e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (e.button !== 0) return;
        // Select node but do not preventDefault — Chart.js needs hover/click.
        selectChart();
      }}
    >
      {config?.title ? (
        <div className="tmr-chart-title">{config.title}</div>
      ) : null}
      {config?.dataTime ? (
        <div className="tmr-chart-time">{config.dataTime}</div>
      ) : null}
      {configs.length > 1 ? (
        <div className="tmr-chart-tabs" role="tablist">
          {configs.map((c, i) => (
            <button
              key={`${c.chartType}-${i}`}
              type="button"
              role="tab"
              className="tmr-chart-tab"
              data-active={i === safeIndex ? 'true' : 'false'}
              aria-selected={i === safeIndex}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setActive(i);
              }}
            >
              {tabLabel(c.chartType, c.title, i, labels.tabLabel)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="tmr-chart-canvas-host" style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </NodeViewWrapper>
  );
}
