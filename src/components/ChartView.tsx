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
import { ChartEditorPopover } from './ChartEditorPopover';

function tabLabel(
  chartType: string,
  title: string | undefined,
  index: number,
  fallback: (type: string, i: number) => string,
): string {
  if (title?.trim()) return title;
  return fallback(chartType, index);
}

export function ChartView({
  node,
  updateAttributes,
  editor,
  extension,
  selected,
}: NodeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJs | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);

  const payload: ChartPayload = useMemo(
    () => ({
      config: (node.attrs.config ?? []) as ChartPayload['config'],
      columns: (node.attrs.columns ?? []) as ChartPayload['columns'],
      dataSource: (node.attrs.dataSource ??
        []) as ChartPayload['dataSource'],
    }),
    [node.attrs.config, node.attrs.columns, node.attrs.dataSource],
  );

  const editable =
    Boolean(editor?.isEditable) &&
    extension.options.chartEditable !== false;
  const theme = (extension.options.chartTheme ?? null) as ChartTheme | null;
  const configs = payload.config;
  const safeIndex = Math.min(active, Math.max(0, configs.length - 1));
  const config = configs[safeIndex];
  const height = config?.height ?? 320;

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
    return () => {
      // keep instance across data updates; destroy only on unmount
    };
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
    ...(extension.options.chartLabels as Partial<typeof defaultChartLabels> | undefined),
  };

  const onOpenEdit = () => {
    if (!editable) return;
    setEditing(true);
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`tmr-chart${editable ? ' tmr-chart--interactive' : ''}`}
      data-type="chart"
      data-selected={selected ? 'true' : undefined}
      ref={rootRef}
      onClick={(e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onOpenEdit();
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
      {editing ? (
        <ChartEditorPopover
          payload={payload}
          anchor={rootRef.current}
          doneLabel={labels.done}
          cancelLabel={labels.cancel}
          configLabel={labels.configLabel}
          tableLabel={labels.tableLabel}
          onCancel={() => setEditing(false)}
          onConfirm={(next) => {
            updateAttributes({
              config: next.config,
              columns: next.columns,
              dataSource: next.dataSource,
            });
            setEditing(false);
            setActive(0);
          }}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
