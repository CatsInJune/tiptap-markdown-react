import { Markdown } from '@tiptap/markdown';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { pureChart } from './ChartExtension';
import { prepareChartMarkdown } from './prepareChartMarkdown';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import { renderReportHtml } from '../renderReportHtml';

const sample = `<!-- {"chartType": "line", "x": "date", "y": "close", "title": "历史价格走势"} -->
| date | close |
|------|------|
| 2024-01-01 | 100 |
| 2024-01-02 | 110 |
`;

describe('chart markdown round-trip', () => {
  it('parses comment+table via prepare + tokenizer and serializes flat', () => {
    const editor = new Editor({
      extensions: [
        ...baseExtensions,
        pureCodeBlock,
        pureImage,
        pureChart,
        Markdown,
      ],
      content: prepareChartMarkdown(sample),
      contentType: 'markdown',
    });

    const json = editor.getJSON();
    const chart = json.content?.find((n) => n.type === 'chart');
    expect(chart).toBeTruthy();
    expect(chart?.attrs?.config?.[0]?.chartType).toBe('line');
    expect(chart?.attrs?.dataSource).toHaveLength(2);

    const md = editor.getMarkdown();
    expect(md).toContain('<!-- {"chartType":"line"');
    expect(md).not.toContain('```tmr-chart');
    expect(md).toContain('| date | close |');
    editor.destroy();
  });

  it('renderReportHtml emits chart placeholder', () => {
    const { html, ok } = renderReportHtml(sample);
    expect(ok).toBe(true);
    expect(html).toContain('data-type="chart"');
    expect(html).toContain('data-chart=');
    expect(html).toContain('tmr-chart');
    expect(html).toContain('历史价格走势');
  });

  it('multi config array becomes one chart node', () => {
    const md = `<!-- [{"chartType":"bar","x":"业务","y":"销量"},{"chartType":"pie","x":"业务","y":"销量"}] -->
| 业务 | 销量 |
| ---- | ---- |
| 收入 | 10 |
`;
    const editor = new Editor({
      extensions: [
        ...baseExtensions,
        pureCodeBlock,
        pureImage,
        pureChart,
        Markdown,
      ],
      content: prepareChartMarkdown(md),
      contentType: 'markdown',
    });
    const chart = editor.getJSON().content?.find((n) => n.type === 'chart');
    expect(chart?.attrs?.config).toHaveLength(2);
    const out = editor.getMarkdown();
    expect(out.startsWith('<!-- [')).toBe(true);
    editor.destroy();
  });
});
