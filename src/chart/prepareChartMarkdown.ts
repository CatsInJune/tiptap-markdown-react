import { normalizeChartMarkdown } from './parse';

/**
 * Unwrap agentic-ui `<div data-card="true">…</div>` so comment↔table
 * adjacency survives for normalizeChartMarkdown.
 */
function unwrapDataCardDivs(markdown: string): string {
  return markdown.replace(
    /<div\s+data-card=(["']?)true\1\s*>\s*([\s\S]*?)\s*<\/div>/gi,
    '\n$2\n',
  );
}

/**
 * Prepare markdown before TipTap / MarkdownManager parse:
 * unwrap data-card wrappers, then collapse `<!-- chart -->` + GFM table
 * pairs into ```tmr-chart fences.
 */
export function prepareChartMarkdown(markdown: string): string {
  return normalizeChartMarkdown(unwrapDataCardDivs(markdown ?? ''));
}
