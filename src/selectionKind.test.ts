// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { CellSelection } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { createChart } from './chart/createChart';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { selectionKind } from './selectionKind';

function build(content = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, createChart({ editable: false }), Markdown],
    content: prepareChartMarkdown(content),
    contentType: 'markdown',
  });
}

function firstNodePos(editor: Editor, typeName: string): number {
  let pos = -1;
  editor.state.doc.descendants((node, offset) => {
    if (pos < 0 && node.type.name === typeName) pos = offset;
    return true;
  });
  return pos;
}

describe('selectionKind', () => {
  it('普通文字选区（含塌缩）是 text', () => {
    const editor = build('一段文字。');
    editor.commands.setTextSelection(3);
    expect(selectionKind(editor.state.selection)).toBe('text');
    expect(editor.state.selection.empty).toBe(true);

    editor.commands.setTextSelection({ from: 1, to: 3 });
    expect(selectionKind(editor.state.selection)).toBe('text');
    expect(editor.state.selection.empty).toBe(false);
    editor.destroy();
  });

  it('表格里的单元格选区是 cell', () => {
    const editor = build(
      ['| 项目 | 金额 |', '| --- | --- |', '| 收入 | 100 |'].join('\n'),
    );
    const cellPos = firstNodePos(editor, 'tableCell');
    expect(cellPos).toBeGreaterThan(-1);
    editor.view.dispatch(
      editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos, cellPos)),
    );
    expect(selectionKind(editor.state.selection)).toBe('cell');
    editor.destroy();
  });

  it('图表整节点选区是 node（原子节点只能这样被选中）', () => {
    const editor = build(
      [
        '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
        '',
        '| 项目 | 金额 |',
        '| --- | --- |',
        '| 收入 | 100 |',
      ].join('\n'),
    );
    const chartPos = firstNodePos(editor, 'chart');
    expect(chartPos).toBeGreaterThan(-1);
    editor.commands.setNodeSelection(chartPos);
    expect(selectionKind(editor.state.selection)).toBe('node');
    editor.destroy();
  });

  it("'selectionUpdate' 在库的编辑器配置上会触发（组件就是监听它上报的）", () => {
    const editor = build('一段文字。另一段。');
    const seen: Array<{ from: number; to: number; empty: boolean }> = [];
    const handler = () => {
      const { from, to, empty } = editor.state.selection;
      seen.push({ from, to, empty });
    };
    editor.on('selectionUpdate', handler);

    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.setTextSelection(2);

    editor.off('selectionUpdate', handler);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0]).toEqual({ from: 1, to: 4, empty: false });
    expect(seen[1]).toEqual({ from: 2, to: 2, empty: true });
    editor.destroy();
  });
});
