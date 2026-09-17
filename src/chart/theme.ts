import type { ChartTheme } from './types';

const DEFAULT_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

function readCssVar(
  el: HTMLElement | null,
  name: string,
  fallback: string,
): string {
  if (!el || typeof getComputedStyle === 'undefined') return fallback;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Resolve theme from --tmr-* CSS variables + optional host override. */
export function resolveChartTheme(
  host: HTMLElement | null,
  override?: ChartTheme | null,
): Required<
  Pick<
    ChartTheme,
    | 'backgroundColor'
    | 'textColor'
    | 'gridColor'
    | 'borderColor'
    | 'fontFamily'
    | 'palette'
  >
> {
  const base = {
    backgroundColor: readCssVar(host, '--tmr-bg', '#ffffff'),
    textColor: readCssVar(host, '--tmr-fg', '#1f2937'),
    gridColor: readCssVar(host, '--tmr-border', '#e5e7eb'),
    borderColor: readCssVar(host, '--tmr-border', '#e5e7eb'),
    fontFamily: readCssVar(
      host,
      '--tmr-font',
      'ui-sans-serif, system-ui, sans-serif',
    ),
    palette: DEFAULT_PALETTE,
  };
  if (!override) return base;
  return {
    backgroundColor: override.backgroundColor ?? base.backgroundColor,
    textColor: override.textColor ?? base.textColor,
    gridColor: override.gridColor ?? base.gridColor,
    borderColor: override.borderColor ?? base.borderColor,
    fontFamily: override.fontFamily ?? base.fontFamily,
    palette:
      override.palette && override.palette.length > 0
        ? override.palette
        : base.palette,
  };
}
