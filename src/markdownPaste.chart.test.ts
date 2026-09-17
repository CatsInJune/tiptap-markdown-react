import { Markdown } from '@tiptap/markdown';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { pureChart } from './chart/ChartExtension';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { baseExtensions, pureCodeBlock, pureImage } from './extensions';
import { looksLikeMarkdown } from './markdownPaste';

const sample = `## PDD 营收柱状图

<!-- {"chartType":"column","x":"财年","y":"营收","colorLegend":"业务","title":"PDD Holdings 年度总营收 (亿元人民币)"} -->

| 财年 | 业务 | 营收 |
|------|------|------|
| FY2021 | 在线营销服务 | 462.1 |
| FY2021 | 交易服务 | 132.0 |
| FY2022 | 在线营销服务 | 730.0 |
| FY2022 | 交易服务 | 220.0 |
`;

function makeEditor(content: string) {
  return new Editor({
    extensions: [
      ...baseExtensions,
      pureCodeBlock,
      pureImage,
      pureChart,
      Markdown,
    ],
    content,
    contentType: 'markdown',
  });
}

describe('markdown paste chart prepare', () => {
  it('looksLikeMarkdown recognizes chart comment', () => {
    expect(
      looksLikeMarkdown(
        '<!-- {"chartType":"column","x":"a","y":"b"} -->\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
      ),
    ).toBe(true);
  });

  it('raw parse without prepare loses chart (table only)', () => {
    const editor = makeEditor(sample);
    const chart = editor.getJSON().content?.find((n) => n.type === 'chart');
    // TipTap 丢 HTML 注释 → 无 chart 节点（回归：证明必须 prepare）
    expect(chart).toBeFalsy();
    editor.destroy();
  });

  it('parse after prepareChartMarkdown yields chart node', () => {
    const editor = makeEditor(prepareChartMarkdown(sample));
    const chart = editor.getJSON().content?.find((n) => n.type === 'chart');
    expect(chart).toBeTruthy();
    expect(chart?.attrs?.config?.[0]?.chartType).toBe('column');
    expect(chart?.attrs?.config?.[0]?.colorLegend).toBe('业务');
    expect(chart?.attrs?.dataSource?.length).toBeGreaterThanOrEqual(4);
    editor.destroy();
  });
});
