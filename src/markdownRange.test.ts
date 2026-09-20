// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { createChart } from './chart/createChart';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { getMarkdownForRange } from './markdownRange';

function build(content = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, createChart({ editable: false }), Markdown],
    // 与 MarkdownWysiwygEditor 一致：先预处理（注释 + 表 → 围栏）再交给编辑器
    content: prepareChartMarkdown(content),
    contentType: 'markdown',
  });
}

type BlockRange = { from: number; to: number };

/** 第 index 个满足条件的顶层块（doc 坐标）。 */
function blockRangeWhere(
  editor: Editor,
  pred: (node: { type: { name: string }; textContent: string }) => boolean,
  index = 0,
): BlockRange {
  let seen = 0;
  let found: BlockRange = { from: -1, to: -1 };
  editor.state.doc.forEach((node, offset) => {
    if (found.from >= 0) return;
    if (pred(node)) {
      if (seen === index) {
        found = { from: offset, to: offset + node.nodeSize };
        return;
      }
      seen += 1;
    }
  });
  return found;
}

const paraWith = (text: string) => (node: { type: { name: string }; textContent: string }) =>
  node.type.name === 'paragraph' && node.textContent.includes(text);

const typeIs = (name: string) => (node: { type: { name: string } }) =>
  node.type.name === name;

describe('getMarkdownForRange', () => {
  it('覆盖整篇时等于 getMarkdown()，且偏移从 0 起（块级拼接不变量）', () => {
    const editor = build(
      ['## 标题', '', '正文一段**加粗**。', '', '| 列 | 值 |', '| --- | --- |', '| a | 1 |'].join(
        '\n',
      ),
    );
    const result = getMarkdownForRange(editor, 0, editor.state.doc.content.size);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(0);
    expect(result!.markdown).toBe(editor.getMarkdown());
    expect(result!.to - result!.from).toBe(result!.markdown.length);
    editor.destroy();
  });

  it('段中选区扩到整段，偏移能在整篇里切出同一段', () => {
    const editor = build(['第一段。', '', '第二段有内容。', '', '第三段。'].join('\n'));
    const second = blockRangeWhere(editor, paraWith('第二段'));
    const result = getMarkdownForRange(editor, second.from + 3, second.from + 5);
    expect(result).not.toBeNull();
    expect(result!.markdown).toBe('第二段有内容。');
    const full = editor.getMarkdown();
    expect(full.slice(result!.from, result!.to)).toBe(result!.markdown);
    editor.destroy();
  });

  it('跨两段时取到两段（含块间分隔）', () => {
    const editor = build(['甲。', '', '乙。', '', '丙。'].join('\n'));
    const first = blockRangeWhere(editor, paraWith('甲'));
    const second = blockRangeWhere(editor, paraWith('乙'));
    const result = getMarkdownForRange(editor, first.from + 1, second.from + 1);
    expect(result).not.toBeNull();
    expect(result!.markdown).toBe('甲。\n\n乙。');
    expect(editor.getMarkdown().slice(result!.from, result!.to)).toBe(result!.markdown);
    editor.destroy();
  });

  it('表格内的选区扩到整张表', () => {
    const editor = build(
      ['前文。', '', '| 项目 | 金额 |', '| --- | --- |', '| 收入 | 100 |', '', '后文。'].join(
        '\n',
      ),
    );
    const table = blockRangeWhere(editor, typeIs('table'));
    expect(table.from).toBeGreaterThan(-1);
    const result = getMarkdownForRange(editor, table.from + 3, table.from + 6);
    expect(result).not.toBeNull();
    expect(result!.markdown).toContain('| 项目');
    expect(result!.markdown).toContain('| 收入');
    expect(result!.markdown).not.toContain('前文');
    expect(editor.getMarkdown().slice(result!.from, result!.to)).toBe(result!.markdown);
    editor.destroy();
  });

  it('图表节点（整节点区间）取到「注释 + 表」', () => {
    const editor = build(
      [
        '前文。',
        '',
        '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
        '',
        '| 项目 | 金额 |',
        '| --- | --- |',
        '| 收入 | 100 |',
      ].join('\n'),
    );
    const chart = blockRangeWhere(editor, typeIs('chart'));
    expect(chart.from).toBeGreaterThan(-1);
    const result = getMarkdownForRange(editor, chart.from, chart.to);
    expect(result).not.toBeNull();
    expect(result!.markdown).toContain('<!-- {');
    expect(result!.markdown).toContain('| 项目 |');
    expect(editor.getMarkdown().slice(result!.from, result!.to)).toBe(result!.markdown);
    editor.destroy();
  });

  it('列表项内的选区扩到整个列表（doc 范围与 markdown 描述同一段）', () => {
    const editor = build(['前言。', '', '- 一', '- 二', '', '结语。'].join('\n'));
    const list = blockRangeWhere(editor, typeIs('bulletList'));
    const result = getMarkdownForRange(editor, list.from + 3, list.from + 5);
    expect(result).not.toBeNull();
    expect(result!.markdown).toContain('- 一');
    expect(result!.markdown).toContain('- 二');
    expect(editor.getMarkdown().slice(result!.from, result!.to)).toBe(result!.markdown);
    // doc 范围 = 扩块后的整块；把它切出来序列化，必须逐字等于返回的 markdown
    expect(result!.docFrom).toBe(list.from);
    expect(result!.docTo).toBe(list.to);
    const fromDoc = editor.markdown!.serialize(
      editor.state.doc.cut(result!.docFrom, result!.docTo).toJSON(),
    );
    expect(fromDoc).toBe(result!.markdown);
    editor.destroy();
  });

  it('出现两次的相同段落，扩块后偏移依然精确（不靠内容定位）', () => {
    const editor = build(['同一段。', '', '同一段。'].join('\n'));
    const first = blockRangeWhere(editor, paraWith('同一段'), 0);
    const result = getMarkdownForRange(editor, first.from + 1, first.from + 3);
    expect(result).not.toBeNull();
    expect(result!.markdown).toBe('同一段。');
    expect(result!.from).toBe(0);
    expect(result!.to).toBe(4);
    editor.destroy();
  });

  it('expandToBlocks: false 时按原区间取，偏移仍能在整篇里切出同一段', () => {
    const editor = build(['第一段。', '', '第二段有内容。', '', '第三段。'].join('\n'));
    const second = blockRangeWhere(editor, paraWith('第二段'));
    const result = getMarkdownForRange(editor, second.from + 1, second.from + 4, {
      expandToBlocks: false,
    });
    expect(result).not.toBeNull();
    expect(result!.markdown).toBe('第二段');
    expect(editor.getMarkdown().slice(result!.from, result!.to)).toBe(result!.markdown);
    editor.destroy();
  });

  it('expandToBlocks: false 且片段在整篇里出现多处时返回 null（偏移不可信）', () => {
    const editor = build(['同一段。', '', '同一段。'].join('\n'));
    const first = blockRangeWhere(editor, paraWith('同一段'), 0);
    expect(
      getMarkdownForRange(editor, first.from + 1, first.from + 3, { expandToBlocks: false }),
    ).toBeNull();
    editor.destroy();
  });

  it('塌缩区间 / 空文档返回 null', () => {
    const editor = build('有内容。');
    expect(getMarkdownForRange(editor, 2, 2)).toBeNull();
    editor.destroy();

    const empty = build('');
    expect(getMarkdownForRange(empty, 0, 1)).toBeNull();
    empty.destroy();
  });

  it('越界坐标被夹紧到文档范围内', () => {
    const editor = build(['甲。', '', '乙。'].join('\n'));
    const result = getMarkdownForRange(editor, -50, 9999);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(0);
    expect(result!.markdown).toBe(editor.getMarkdown());
    editor.destroy();
  });
});
