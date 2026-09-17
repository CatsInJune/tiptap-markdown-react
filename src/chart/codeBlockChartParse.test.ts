import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import {
  parseCodeTokenAsChartOrCodeBlock,
  CHART_FENCE_LANGS,
} from './codeBlockChartParse';
import { pureChart } from './ChartExtension';
import { prepareChartMarkdown } from './prepareChartMarkdown';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';

const fence = `\`\`\`tmr-chart
{
  "config": [{"chartType":"column","x":"财年","y":"营收","colorLegend":"业务","title":"PDD"}],
  "columns": [
    {"title":"财年","dataIndex":"财年"},
    {"title":"业务","dataIndex":"业务"},
    {"title":"营收","dataIndex":"营收"}
  ],
  "dataSource": [
    {"财年":"FY2021","业务":"Online Marketing Services","营收":462.1},
    {"财年":"FY2021","业务":"Transaction Services","营收":56.9}
  ]
}
\`\`\`
`;

describe('codeBlockChartParse', () => {
  it('recognizes chart fence langs', () => {
    expect(CHART_FENCE_LANGS.has('tmr-chart')).toBe(true);
    expect(CHART_FENCE_LANGS.has('json-chart')).toBe(true);
  });

  it('upgrades code token with tmr-chart lang to chart node shape', () => {
    const body = fence
      .replace(/^```tmr-chart\n/, '')
      .replace(/\n```\n?$/, '');
    const created: { type: string; attrs?: Record<string, unknown> }[] = [];
    parseCodeTokenAsChartOrCodeBlock(
      { lang: 'tmr-chart', text: body, raw: fence },
      {
        createNode: (type, attrs) => {
          created.push({ type, attrs: attrs ?? undefined });
          return { type, attrs };
        },
        createTextNode: (text) => ({ type: 'text', text }),
        parseInline: () => [],
        parseChildren: () => [],
        applyMark: (_mark, content) => content,
      } as never,
    );
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('chart');
    expect(created[0].attrs?.config).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chartType: 'column', x: '财年', y: '营收' }),
      ]),
    );
  });

  it('CodeBlock parseMarkdown intercept yields chart when chart tokenizer is disabled', () => {
    // Simulate built-in `code` winning: chart has no tokenizer, CodeBlock upgrades.
    const ChartNoFence = pureChart.extend({
      markdownTokenizer: undefined as unknown as never,
    });

    const editor = new Editor({
      extensions: [
        ...baseExtensions,
        pureCodeBlock,
        pureImage,
        ChartNoFence,
        Markdown,
      ],
      content: fence,
      contentType: 'markdown',
    });

    const chart = editor.getJSON().content?.find((n) => n.type === 'chart');
    expect(chart).toBeTruthy();
    expect(chart?.attrs?.config?.[0]?.chartType).toBe('column');
    expect(
      editor.getJSON().content?.some((n) => n.type === 'codeBlock'),
    ).toBe(false);
    editor.destroy();
  });

  it('prepareChartMarkdown unwraps data-card before normalize', () => {
    const dirty = `<div data-card="true">
<!-- {"chartType":"column","x":"财年","y":"营收"} -->
| 财年 | 营收 |
| --- | ---: |
| FY2021 | 1 |
</div>`;
    const prepared = prepareChartMarkdown(dirty);
    expect(prepared).toContain('```tmr-chart');
    expect(prepared).not.toContain('data-card');

    const editor = new Editor({
      extensions: [
        ...baseExtensions,
        pureCodeBlock,
        pureImage,
        pureChart,
        Markdown,
      ],
      content: prepared,
      contentType: 'markdown',
    });
    const chart = editor.getJSON().content?.find((n) => n.type === 'chart');
    expect(chart).toBeTruthy();
    editor.destroy();
  });
});
