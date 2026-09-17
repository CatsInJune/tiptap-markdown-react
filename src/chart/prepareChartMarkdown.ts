import { normalizeChartMarkdown } from './parse';

/**
 * Prepare markdown before TipTap / MarkdownManager parse:
 * collapse `<!-- chart -->` + GFM table pairs into ```tmr-chart fences.
 */
export function prepareChartMarkdown(markdown: string): string {
  return normalizeChartMarkdown(markdown ?? '');
}
