import { mergeAttributes, Node } from '@tiptap/core';
import {
  normalizeChartMarkdown,
  parseChartFenceBody,
  serializeChartPayload,
} from './parse';
import type { ChartColumn, ChartConfig, ChartPayload } from './types';

export const CHART_NODE_NAME = 'chart';

export interface ChartNodeAttrs {
  config: ChartConfig[];
  columns: ChartColumn[];
  dataSource: Record<string, unknown>[];
}

function attrsToPayload(attrs: ChartNodeAttrs): ChartPayload {
  return {
    config: attrs.config ?? [],
    columns: attrs.columns ?? [],
    dataSource: attrs.dataSource ?? [],
  };
}

function encodePayload(payload: ChartPayload): string {
  return JSON.stringify(payload);
}

function decodePayloadAttr(raw: string | null): ChartPayload | null {
  if (!raw) return null;
  try {
    return parseChartFenceBody(raw) ?? (JSON.parse(raw) as ChartPayload);
  } catch {
    return null;
  }
}

export interface ReportChartOptions {
  HTMLAttributes: Record<string, unknown>;
}

/**
 * Pure chart block node — safe for server / SSR.
 * Does not import chart.js or React. renderHTML emits a hydrate placeholder.
 */
export const reportChart = Node.create<ReportChartOptions>({
  name: CHART_NODE_NAME,

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  // Above default codeBlock so ```tmr-chart / ```chart bind here
  priority: 1000,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      config: {
        default: [],
        parseHTML: (element) => {
          const payload = decodePayloadAttr(element.getAttribute('data-chart'));
          return payload?.config ?? [];
        },
      },
      columns: {
        default: [],
        parseHTML: (element) => {
          const payload = decodePayloadAttr(element.getAttribute('data-chart'));
          return payload?.columns ?? [];
        },
      },
      dataSource: {
        default: [],
        parseHTML: (element) => {
          const payload = decodePayloadAttr(element.getAttribute('data-chart'));
          return payload?.dataSource ?? [];
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const payload = attrsToPayload(node.attrs as ChartNodeAttrs);
    const title = payload.config[0]?.title;
    const height = payload.config[0]?.height ?? 320;
    const dataTime = payload.config[0]?.dataTime;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'chart',
        'data-chart': encodePayload(payload),
        class: 'tmr-chart',
        style: `min-height:${height}px`,
      }),
      title
        ? ['div', { class: 'tmr-chart-title' }, String(title)]
        : ['div', { class: 'tmr-chart-title tmr-chart-title--empty' }, ''],
      dataTime
        ? ['div', { class: 'tmr-chart-time' }, String(dataTime)]
        : ['div', { class: 'tmr-chart-time tmr-chart-time--empty' }, ''],
      [
        'div',
        {
          class: 'tmr-chart-canvas-host tmr-chart-skeleton',
          'aria-hidden': 'true',
        },
      ],
    ];
  },

  renderMarkdown(node) {
    const payload = attrsToPayload(node.attrs as ChartNodeAttrs);
    if (!payload.config.length) return '';
    return serializeChartPayload(payload);
  },

  parseMarkdown: (token, helpers) => {
    const body = String(token.content ?? token.text ?? token.raw ?? '');
    // Tokenizer may put JSON in `text` or leave fence body in content
    const json =
      typeof token.payload === 'string'
        ? token.payload
        : body.replace(/^```(?:tmr-chart|chart|json-chart)\s*\n?/i, '').replace(/\n?```$/, '');
    const payload =
      parseChartFenceBody(typeof token.payload === 'string' ? token.payload : json) ??
      (token.payload && typeof token.payload === 'object'
        ? (token.payload as ChartPayload)
        : null);
    if (!payload) {
      return helpers.createNode('paragraph');
    }
    return helpers.createNode(CHART_NODE_NAME, {
      config: payload.config,
      columns: payload.columns,
      dataSource: payload.dataSource,
    });
  },

  markdownTokenizer: {
    name: CHART_NODE_NAME,
    level: 'block' as const,
    start(src: string) {
      const fence = src.match(/^```(?:tmr-chart|chart|json-chart)\b/m);
      if (fence && fence.index !== undefined) return fence.index;
      return -1;
    },
    tokenize(src: string) {
      const match =
        /^```(tmr-chart|chart|json-chart)[^\n]*\n([\s\S]*?)```(?:\r?\n|$)/.exec(
          src,
        );
      if (!match) return undefined;
      const payload = parseChartFenceBody(match[2]);
      if (!payload) return undefined;
      return {
        type: CHART_NODE_NAME,
        raw: match[0],
        payload: JSON.stringify({
          config: payload.config,
          columns: payload.columns,
          dataSource: payload.dataSource,
        }),
      };
    },
  },
});

/** Re-export preprocess for parse pipelines. */
export { normalizeChartMarkdown };

/** Pure chart extension alias for server / preview injection. */
export const pureChart = reportChart;
