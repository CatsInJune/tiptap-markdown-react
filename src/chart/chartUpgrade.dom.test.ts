/** @vitest-environment happy-dom */
import { Markdown } from '@tiptap/markdown';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import { pureChart } from './ChartExtension';

/**
 * 图表围栏升级走 ProseMirror 的 appendTransaction，只有挂载 view 后才会执行：
 * 无 element 的 headless Editor 不带插件（Tiptap 在 createView 时才建带插件的 state）。
 * 这两个用例守住「插入 / 改 language」两类触发条件，防止性能快路径把升级漏掉。
 */
const payload = JSON.stringify({
  config: [{ chartType: 'column', x: 'a', y: 'b' }],
  columns: [
    { title: 'a', dataIndex: 'a' },
    { title: 'b', dataIndex: 'b' },
  ],
  dataSource: [{ a: 'x', b: 1 }],
});

function mount(): { editor: Editor; element: HTMLElement } {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [...baseExtensions, pureCodeBlock, pureImage, pureChart, Markdown],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  });
  return { editor, element };
}

describe('图表围栏升级（appendTransaction）', () => {
  it('插入 language=tmr-chart 的代码块后升级为 chart', () => {
    const { editor, element } = mount();
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'tmr-chart' },
          content: [{ type: 'text', text: payload }],
        },
      ],
    });
    expect(editor.state.doc.child(0).type.name).toBe('chart');
    editor.destroy();
    element.remove();
  });

  it('把已有代码块的 language 改成 tmr-chart 后同样升级', () => {
    const { editor, element } = mount();
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'text' },
          content: [{ type: 'text', text: payload }],
        },
      ],
    });
    expect(editor.state.doc.child(0).type.name).toBe('codeBlock');

    editor
      .chain()
      .setNodeSelection(0)
      .updateAttributes('codeBlock', { language: 'tmr-chart' })
      .run();
    expect(editor.state.doc.child(0).type.name).toBe('chart');
    editor.destroy();
    element.remove();
  });
});
