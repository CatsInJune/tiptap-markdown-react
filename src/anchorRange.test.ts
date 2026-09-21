// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { findRangeByAnchor } from './anchorRange';

function build(content = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

const paraWith = (text: string) => (node: { type: { name: string }; textContent: string }) =>
  node.type.name === 'paragraph' && node.textContent.includes(text);

function paraRange(editor: Editor, text: string, index = 0): { from: number; to: number } {
  let seen = 0;
  let found = { from: -1, to: -1 };
  editor.state.doc.forEach((node, offset) => {
    if (found.from >= 0) return;
    if (paraWith(text)(node)) {
      if (seen === index) {
        found = { from: offset, to: offset + node.nodeSize };
        return;
      }
      seen += 1;
    }
  });
  return found;
}

describe('findRangeByAnchor', () => {
  it('按 exact 命中并在返回里带上当前文本与 status', () => {
    const editor = build(['第一段。', '', '第二段有内容。', '', '第三段。'].join('\n'));
    const result = findRangeByAnchor(editor, { exact: '第二段有内容。' });
    expect(result).not.toBeNull();
    expect(result!.text).toBe('第二段有内容。');
    expect(result!.status).toBe('matched');
    const expected = paraRange(editor, '第二段');
    expect(result!.from).toBe(expected.from + 1);
    editor.destroy();
  });

  it('相同文本出现两处时用前后文消歧', () => {
    const editor = build(
      ['甲：同一句话。', '', '乙：同一句话。'].join('\n'),
    );
    const result = findRangeByAnchor(editor, {
      prefix: '乙：',
      exact: '同一句话。',
      suffix: '',
    });
    expect(result).not.toBeNull();
    expect(result!.text).toBe('同一句话。');
    const second = paraRange(editor, '乙：');
    // 落在第二段里（而不是第一段）
    expect(result!.from).toBeGreaterThan(second.from);
    editor.destroy();
  });

  it('多块区间（表格）用「无分隔符」的文本能命中，返回的 text 也是同一口径', () => {
    const editor = build(['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n'));
    let tableFrom = -1;
    let tableTo = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'table') {
        tableFrom = offset;
        tableTo = offset + node.nodeSize;
      }
    });
    expect(tableFrom).toBeGreaterThan(-1);

    const exact = editor.state.doc.textBetween(tableFrom, tableTo);
    const result = findRangeByAnchor(editor, { exact });
    expect(result).not.toBeNull();
    expect(result!.text).toBe(exact);
    editor.destroy();
  });

  it('用 \\n\\n 拼出来的多块文本命中不了（调用方必须与匹配器同一口径）', () => {
    const editor = build(['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n'));
    let tableFrom = -1;
    let tableTo = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'table') {
        tableFrom = offset;
        tableTo = offset + node.nodeSize;
      }
    });
    const withSeparator = editor.state.doc.textBetween(tableFrom, tableTo, '\n\n');
    // 匹配器把 text 节点直接拼、块间没有分隔符 —— 带分隔符就永远对不上
    expect(findRangeByAnchor(editor, { exact: withSeparator })).toBeNull();
    editor.destroy();
  });

  it('正文里没有这段时不返回区间（宿主据此判冲突）', () => {
    const editor = build('第一段。');
    expect(findRangeByAnchor(editor, { exact: '根本不存在的句子。' })).toBeNull();
    editor.destroy();
  });

  it('前面插入内容后仍能找到（内容锚定的意义：位置会漂、内容不会）', () => {
    const editor = build(['第一段。', '', '第二段有内容。', '', '第三段。'].join('\n'));
    const before = findRangeByAnchor(editor, { exact: '第二段有内容。' });
    expect(before).not.toBeNull();

    // 在文档最前面插一大段，把原来的位置整体推后
    editor.commands.insertContentAt(0, '插入的新段落，挺长的，会把后面都往后退。\n\n', {
      contentType: 'markdown',
    });

    const after = findRangeByAnchor(editor, { exact: '第二段有内容。' });
    expect(after).not.toBeNull();
    expect(after!.text).toBe(before!.text);
    expect(after!.from).toBeGreaterThan(before!.from);
    editor.destroy();
  });

  it('锚点为空 / 只有空白 exact 时返回 null', () => {
    const editor = build('有内容。');
    expect(findRangeByAnchor(editor, null)).toBeNull();
    expect(findRangeByAnchor(editor, { exact: '' })).toBeNull();
    editor.destroy();
  });
});
