import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
} from '@tiptap/core';
import { CHART_NODE_NAME } from './ChartExtension';
import { parseChartFenceBody } from './parse';

/** Fence languages that belong to chart nodes, not code blocks. */
export const CHART_FENCE_LANGS = new Set([
  'tmr-chart',
  'chart',
  'json-chart',
]);

/**
 * TipTap's built-in `code` tokenizer often wins over custom chart fences.
 * When that happens, intercept CodeBlock.parseMarkdown and upgrade
 * ```tmr-chart / ```chart / ```json-chart into a chart node.
 */
export function parseCodeTokenAsChartOrCodeBlock(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
  codeBlockName = 'codeBlock',
): JSONContent | JSONContent[] {
  const lang = String(token.lang ?? '')
    .trim()
    .toLowerCase();
  if (CHART_FENCE_LANGS.has(lang)) {
    const payload = parseChartFenceBody(String(token.text ?? ''));
    if (payload) {
      return helpers.createNode(CHART_NODE_NAME, {
        config: payload.config,
        columns: payload.columns,
        dataSource: payload.dataSource,
      });
    }
  }

  if (
    token.raw?.startsWith('```') === false &&
    token.raw?.startsWith('~~~') === false &&
    token.codeBlockStyle !== 'indented'
  ) {
    return [];
  }

  return helpers.createNode(
    codeBlockName,
    { language: token.lang || null },
    token.text ? [helpers.createTextNode(token.text)] : [],
  );
}
