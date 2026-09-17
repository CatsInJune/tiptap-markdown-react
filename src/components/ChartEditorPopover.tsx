'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  normalizeChartPayload,
  parseGfmTable,
  serializeChartPayload,
  unwrapChartConfigs,
} from '../chart/parse';
import type { ChartPayload } from '../chart/types';
import '../styles/chart.css';

export interface ChartEditorPopoverProps {
  payload: ChartPayload;
  anchor: HTMLElement | null;
  doneLabel?: string;
  cancelLabel?: string;
  configLabel?: string;
  tableLabel?: string;
  onConfirm: (payload: ChartPayload) => void;
  onCancel: () => void;
}

function buildEditors(payload: ChartPayload): { configText: string; tableText: string } {
  const flat =
    payload.config.length === 1 ? payload.config[0] : payload.config;
  const full = serializeChartPayload(payload);
  const lines = full.split('\n');
  // first line is comment; skip blank; rest is table
  const tableText = lines.slice(2).join('\n');
  return {
    configText: JSON.stringify(flat, null, 2),
    tableText,
  };
}

export function ChartEditorPopover({
  payload,
  anchor,
  doneLabel = 'Done',
  cancelLabel = 'Cancel',
  configLabel = 'Chart config (JSON)',
  tableLabel = 'Data table (Markdown)',
  onConfirm,
  onCancel,
}: ChartEditorPopoverProps) {
  const titleId = useId();
  const initial = buildEditors(payload);
  const [configText, setConfigText] = useState(initial.configText);
  const [tableText, setTableText] = useState(initial.tableText);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchor?.contains(t as Node)) return;
      onCancel();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [anchor, onCancel]);

  const style = (() => {
    if (!anchor) return { top: 80, left: 80 } as const;
    const r = anchor.getBoundingClientRect();
    const top = Math.min(r.bottom + 8, window.innerHeight - 40);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - 340);
    return { top, left };
  })();

  const submit = () => {
    try {
      const parsed = JSON.parse(configText) as unknown;
      const configs = unwrapChartConfigs(parsed);
      if (!configs?.length) {
        setError('Invalid chart config JSON');
        return;
      }
      const table = parseGfmTable(
        tableText.endsWith('\n') ? tableText : `${tableText}\n`,
      );
      if (!table) {
        setError('Invalid Markdown table');
        return;
      }
      const next = normalizeChartPayload(
        configs,
        table.columns,
        table.dataSource,
      );
      if (!next) {
        setError('No supported chartType / axes in config');
        return;
      }
      onConfirm(next);
    } catch (e) {
      setError((e as Error).message || 'Parse error');
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      className="tmr-chart-popover"
      style={{ top: style.top, left: style.left }}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div id={titleId} className="tmr-chart-title">
        Edit chart
      </div>
      <label>
        {configLabel}
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          spellCheck={false}
        />
      </label>
      <label>
        {tableLabel}
        <textarea
          value={tableText}
          onChange={(e) => setTableText(e.target.value)}
          spellCheck={false}
        />
      </label>
      {error ? <div className="tmr-chart-popover-error">{error}</div> : null}
      <div className="tmr-chart-popover-actions">
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" data-primary="true" onClick={submit}>
          {doneLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
