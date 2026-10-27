import { Markdown } from '@tiptap/markdown';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import { prepareChartMarkdown } from './prepareChartMarkdown';
import { pureChart } from './ChartExtension';
import { chartToTable, setChartType } from './chartCommands';

const sample = `<!-- {"chartType":"column","x":"分部","y":"收入","colorLegend":"财年","title":"分部收入"} -->

| 分部 | 财年 | 收入 |
| --- | --- | --- |
| 安踏 | FY2024 | 335.2 |
`;

function mount() {
  return new Editor({
    extensions: [...baseExtensions, pureCodeBlock, pureImage, pureChart, Markdown],
    content: prepareChartMarkdown(sample),
    contentType: 'markdown',
  });
}

function chartPos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.descendants((node, at) => {
    if (node.type.name === 'chart') {
      pos = at;
      return false;
    }
    return true;
  });
  return pos;
}

describe('图表换型与还原', () => {
  it('换图型只改 chartType，数据还在，并保持选中', () => {
    const editor = mount();
    const pos = chartPos(editor);
    expect(setChartType(editor, pos, 'line')).toBe(true);
    const node = editor.state.doc.nodeAt(pos);
    expect(node?.attrs.config[0]).toMatchObject({
      chartType: 'line',
      x: '分部',
      y: '收入',
      colorLegend: '财年',
    });
    expect(node?.attrs.dataSource).toHaveLength(1);
    expect(editor.state.selection.from).toBe(pos);
    editor.destroy();
  });

  it('还原成表格，不再带图表注释', () => {
    const editor = mount();
    const pos = chartPos(editor);
    expect(chartToTable(editor, pos)).toBe(true);
    expect(editor.state.doc.child(0).type.name).toBe('table');
    const md = editor.getMarkdown();
    expect(md).toContain('分部');
    expect(md).toContain('FY2024');
    expect(md).not.toContain('chartType');
    editor.destroy();
  });
});