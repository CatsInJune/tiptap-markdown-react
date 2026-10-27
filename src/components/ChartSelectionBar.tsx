'use client';

import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { chartToTable, setChartType } from '../chart/chartCommands';
import type { ChartConfig } from '../chart/types';
import { isMvpChartType, MVP_CHART_TYPES, type MvpChartType } from '../chart/types';
import { useEditorBundle } from '../i18n/store';
import '../styles/chart.css';

interface ChartSelectionBarProps {
  editor: Editor;
  getPos: () => number | undefined;
  config: ChartConfig;
  /** 一份数据上叠了多张图：只换第一张不直观，不给换。 */
  multiple: boolean;
}

/**
 * 选中图表后贴在图右上角：换图型、还原成表格。
 * 表或选区转成图仍由宿主调用接口；这里只改文档里已经有的图表节点。
 * `[data-chart-toolbar-extra]` 留给宿主再塞一枚按钮（例如删掉刚转出来的原表）。
 */
export function ChartSelectionBar({
  editor,
  getPos,
  config,
  multiple,
}: ChartSelectionBarProps) {
  const labels = useEditorBundle(editor).chart;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasSeries = Boolean(config.colorLegend);
  const current = isMvpChartType(config.chartType)
    ? labels.typeLabels[config.chartType]
    : labels.changeType;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const keepSelection = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const applyType = (chartType: MvpChartType) => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    setChartType(editor, pos, chartType);
    setOpen(false);
  };

  const toTable = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    chartToTable(editor, pos);
  };

  return (
    <div
      ref={rootRef}
      className="tmr-chart-toolbar"
      data-chart-toolbar=""
      onMouseDown={keepSelection}
    >
      {multiple ? null : (
        <>
          <button
            type="button"
            className="tmr-chart-toolbar-button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {current}
          </button>
          {open ? (
            <div className="tmr-chart-type-menu" role="menu">
              {MVP_CHART_TYPES.map((type) => {
                const blocked =
                  hasSeries && (type === 'pie' || type === 'donut');
                return (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    className="tmr-chart-type-item"
                    aria-disabled={blocked ? 'true' : undefined}
                    onClick={() => {
                      if (blocked) return;
                      applyType(type);
                    }}
                  >
                    {labels.typeLabels[type]}
                  </button>
                );
              })}
            </div>
          ) : null}
          <span className="tmr-chart-toolbar-divider" aria-hidden="true" />
        </>
      )}
      <button type="button" className="tmr-chart-toolbar-button" onClick={toTable}>
        {labels.toTable}
      </button>
      <div className="tmr-chart-toolbar-extra" data-chart-toolbar-extra="" />
    </div>
  );
}
