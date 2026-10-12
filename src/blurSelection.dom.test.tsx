/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Selection } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { CellSelection } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';

function build(content: string): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      Selection.configure({ className: 'tmr-blur-selection' }),
      Markdown,
    ],
    content,
    contentType: 'markdown',
  });
}

function flushFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

describe('失焦选区', () => {
  it('非空文本选区失焦后留下装饰，重新聚焦后拿掉', async () => {
    const editor = build('hello world');
    document.body.appendChild(editor.view.dom);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(editor.view.dom.querySelector('.tmr-blur-selection')?.textContent).toBe(
      'hello',
    );

    editor.commands.focus();
    await flushFrames();
    expect(editor.isFocused).toBe(true);
    expect(editor.view.dom.querySelector('.tmr-blur-selection')).toBeNull();

    editor.commands.blur();
    await flushFrames();
    expect(editor.isFocused).toBe(false);
    expect(editor.view.dom.querySelector('.tmr-blur-selection')?.textContent).toBe(
      'hello',
    );
    editor.destroy();
  });

  it('空选区失焦不加装饰', () => {
    const editor = build('hello world');
    editor.commands.focus();
    editor.commands.blur();
    expect(editor.view.dom.querySelector('.tmr-blur-selection')).toBeNull();
    editor.destroy();
  });

  it('单元格选区失焦不抛错', () => {
    const editor = build('| a | b |\n| --- | --- |\n| c | d |');
    editor.commands.focus();
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableHeader' || node.type.name === 'tableCell') {
        cells.push(pos);
      }
    });
    expect(cells.length).toBeGreaterThan(1);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        CellSelection.create(editor.state.doc, cells[0], cells[1]),
      ),
    );
    expect(() => editor.commands.blur()).not.toThrow();
    editor.destroy();
  });
});
