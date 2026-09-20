// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { createChart } from './chart/createChart';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { PENDING_ANCHOR_CLASS, pendingAnchorExtension, setPendingAnchors } from './pendingAnchor';

function build(content = ''): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      createChart({ editable: false }),
      pendingAnchorExtension,
      Markdown,
    ],
    content: prepareChartMarkdown(content),
    contentType: 'markdown',
  });
}

function blockRange(
  editor: Editor,
  pred: (node: { type: { name: string }; textContent: string }) => boolean,
  index = 0,
): { from: number; to: number } {
  let seen = 0;
  let found = { from: -1, to: -1 };
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
const typeIs = (name: string) => (node: { type: { name: string } }) => node.type.name === name;

const decorated = (editor: Editor) =>
  editor.view.dom.querySelectorAll(`.${PENDING_ANCHOR_CLASS}`);

describe('pendingAnchor（待改写高亮）', () => {
  it('整段高亮：DOM 里有装饰、带 data-pending-id，且 markdown 不变', () => {
    const editor = build(['第一段。', '', '第二段。'].join('\n'));
    const before = editor.getMarkdown();
    const range = blockRange(editor, paraWith('第二段'));

    setPendingAnchors(editor, [{ id: 'req-1', ranges: [range] }]);

    expect(decorated(editor).length).toBe(1);
    expect(editor.view.dom.querySelector('[data-pending-id="req-1"]')).not.toBeNull();
    // 关键：装饰不进 markdown
    expect(editor.getMarkdown()).toBe(before);
    editor.destroy();
  });

  it('整张表能被盖住（node 装饰；表格开了 renderWrapper，装饰落在 wrapper 上）', () => {
    const editor = build(
      ['前文。', '', '| 项目 | 金额 |', '| --- | --- |', '| 收入 | 100 |'].join('\n'),
    );
    const before = editor.getMarkdown();
    const table = blockRange(editor, typeIs('table'));

    setPendingAnchors(editor, [{ id: 'req-2', ranges: [table] }]);

    const el = editor.view.dom.querySelector('[data-pending-id="req-2"]');
    expect(el).not.toBeNull();
    expect(el!.querySelector('table')).not.toBeNull();
    expect(editor.getMarkdown()).toBe(before);
    editor.destroy();
  });

  it('图表这类原子节点也能被盖住，且不会顺带改动正文', () => {
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
    const before = editor.getMarkdown();
    const chart = blockRange(editor, typeIs('chart'));
    expect(chart.from).toBeGreaterThan(-1);

    setPendingAnchors(editor, [{ id: 'req-3', ranges: [chart] }]);

    expect(editor.view.dom.querySelector('[data-type="chart"].tmr-pending-anchor')).not.toBeNull();
    // 文末是图表时，TrailingNode 会在「第一个 transaction」补空段落；setPendingAnchors
    // 必须跳过它，否则一次纯 UI 操作就会往正文里塞一个结尾空段落。
    expect(editor.getMarkdown()).toBe(before);
    editor.destroy();
  });

  it('块内局部区间用行内高亮', () => {
    const editor = build('一整段比较长的文字内容。');
    // doc 位置 1 对应正文第一个字符，所以 [4, 8) 命中「比较长的」
    setPendingAnchors(editor, [{ id: 'req-4', ranges: [{ from: 4, to: 8 }] }]);
    const el = editor.view.dom.querySelector('[data-pending-id="req-4"]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('比较长的');
    editor.destroy();
  });

  it('传空数组即清空', () => {
    const editor = build(['第一段。', '', '第二段。'].join('\n'));
    const range = blockRange(editor, paraWith('第二段'));
    setPendingAnchors(editor, [{ id: 'req-5', ranges: [range] }]);
    expect(decorated(editor).length).toBe(1);

    setPendingAnchors(editor, []);
    expect(decorated(editor).length).toBe(0);
    editor.destroy();
  });

  it('文档被编辑时装饰跟着映射（在区间前插入，高亮仍在原来那段上）', () => {
    const editor = build(['第一段。', '', '第二段。'].join('\n'));
    const range = blockRange(editor, paraWith('第二段'));
    setPendingAnchors(editor, [{ id: 'req-6', ranges: [range] }]);

    editor.commands.insertContentAt(0, '插到最前面的新段落。\n\n', { contentType: 'markdown' });

    const el = editor.view.dom.querySelector('[data-pending-id="req-6"]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('第二段。');
    editor.destroy();
  });

  it('不进 undo 历史：应用装饰后撤销不会动文档，装饰也还在', () => {
    const editor = build(['第一段。', '', '第二段。'].join('\n'));
    const before = editor.getMarkdown();
    const range = blockRange(editor, paraWith('第二段'));
    setPendingAnchors(editor, [{ id: 'req-7', ranges: [range] }]);

    editor.commands.undo();

    expect(editor.getMarkdown()).toBe(before);
    expect(editor.view.dom.querySelector('[data-pending-id="req-7"]')).not.toBeNull();
    editor.destroy();
  });
});
