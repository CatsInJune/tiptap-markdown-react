'use client';

import type { Chart as ChartJs } from 'chart.js';
import { useEffect, useRef, type RefObject } from 'react';
import { parseChartFenceBody } from '../chart/parse';
import { destroyChart, renderOrUpdateChart } from '../chart/renderChart';
import type { ChartTheme } from '../chart/types';
import '../styles/chart.css';

export interface ChartMountProps {
  containerRef: RefObject<HTMLElement | null>;
  chartTheme?: ChartTheme | null;
  /** Re-scan when this changes (e.g. html string). */
  html?: string;
}

function hydrateOne(
  el: HTMLElement,
  theme: ChartTheme | null | undefined,
  registry: Map<HTMLElement, ChartJs>,
) {
  const raw = el.getAttribute('data-chart');
  const payload = parseChartFenceBody(raw ?? '');
  if (!payload?.config.length) return;

  let host = el.querySelector('.tmr-chart-canvas-host') as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.className = 'tmr-chart-canvas-host';
    el.appendChild(host);
  }
  host.classList.remove('tmr-chart-skeleton');

  let canvas = host.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    host.innerHTML = '';
    host.appendChild(canvas);
  }

  const config = payload.config[0];
  const height = config.height ?? 320;
  host.style.height = `${height}px`;

  if (payload.config.length > 1 && !el.querySelector('.tmr-chart-tabs')) {
    const tabs = document.createElement('div');
    tabs.className = 'tmr-chart-tabs';
    tabs.setAttribute('role', 'tablist');
    payload.config.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tmr-chart-tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.active = i === 0 ? 'true' : 'false';
      btn.textContent = c.title?.trim() || `${c.chartType} ${i + 1}`;
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.tmr-chart-tab').forEach((b, j) => {
          (b as HTMLElement).dataset.active = j === i ? 'true' : 'false';
        });
        const existing = registry.get(el);
        destroyChart(existing);
        const next = renderOrUpdateChart({
          canvas: canvas!,
          config: payload.config[i],
          payload,
          theme,
          chart: null,
        });
        if (next) registry.set(el, next);
        const titleEl = el.querySelector('.tmr-chart-title');
        if (titleEl && payload.config[i].title) {
          titleEl.textContent = String(payload.config[i].title);
          titleEl.classList.remove('tmr-chart-title--empty');
        }
      });
      tabs.appendChild(btn);
    });
    el.insertBefore(tabs, host);
  }

  const existing = registry.get(el);
  const chart = renderOrUpdateChart({
    canvas,
    config,
    payload,
    theme,
    chart: existing ?? null,
  });
  if (chart) registry.set(el, chart);
}

/**
 * Hydrate SSR chart placeholders inside a container (reading page).
 */
export function ChartMount({
  containerRef,
  chartTheme,
  html,
}: ChartMountProps) {
  const registryRef = useRef(new Map<HTMLElement, ChartJs>());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const registry = registryRef.current;
    registry.forEach((chart) => destroyChart(chart));
    registry.clear();

    container
      .querySelectorAll<HTMLElement>('div[data-type="chart"]')
      .forEach((el) => hydrateOne(el, chartTheme, registry));

    return () => {
      registry.forEach((chart) => destroyChart(chart));
      registry.clear();
    };
  }, [containerRef, chartTheme, html]);

  return null;
}

/** Imperative helper for hosts that prefer not to use the component. */
export function mountChartsInContainer(
  container: HTMLElement,
  chartTheme?: ChartTheme | null,
): () => void {
  const registry = new Map<HTMLElement, ChartJs>();
  container
    .querySelectorAll<HTMLElement>('div[data-type="chart"]')
    .forEach((el) => hydrateOne(el, chartTheme, registry));
  return () => {
    registry.forEach((c) => destroyChart(c));
    registry.clear();
  };
}
