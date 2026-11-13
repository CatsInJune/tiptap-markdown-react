// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { baseExtensions } from '../extensions';
import { MathEditingLayer } from './MathEditingLayer';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function buildEditor(content: string, editable = true): Editor {
  const editor = new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
    editable,
  });
  document.body.appendChild(editor.view.dom);
  return editor;
}

const BLOCK_MATH_MD = '$$\nE=mc^2\n$$';

function mathElement(editor: Editor): HTMLElement {
  return editor.view.dom.querySelector(
    '[data-type="block-math"], [data-type="inline-math"]',
  ) as HTMLElement;
}

function dialog(): HTMLElement | null {
  return document.querySelector('[role="dialog"]');
}

function latexOf(editor: Editor, name = 'blockMath'): string {
  let latex = '';
  editor.state.doc.descendants((node) => {
    if (node.type.name === name) latex = String(node.attrs.latex ?? '');
  });
  return latex;
}

describe('MathEditingLayer', () => {
  const roots: Root[] = [];
  const editors: Editor[] = [];

  const mount = async (editor: Editor) => {
    editors.push(editor);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => {
      root.render(<MathEditingLayer editor={editor} />);
    });
  };

  const clickMath = async (editor: Editor) => {
    await act(async () => {
      mathElement(editor).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
  };

  afterEach(() => {
    act(() => {
      for (const root of roots) root.unmount();
    });
    roots.length = 0;
    for (const editor of editors) editor.destroy();
    editors.length = 0;
  });

  it('点击公式打开编辑层，改完 LaTeX 写回节点', async () => {
    const editor = buildEditor(BLOCK_MATH_MD);
    await mount(editor);
    await clickMath(editor);

    const panel = dialog();
    expect(panel).not.toBeNull();
    const textarea = panel!.querySelector('textarea')!;
    expect(textarea.value).toBe('E=mc^2');

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!;
      setValue.call(textarea, 'a^2+b^2');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const done = Array.from(panel!.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Done'),
    )!;
    expect(done).toBeTruthy();
    await act(async () => {
      done.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(latexOf(editor)).toBe('a^2+b^2');
    expect(dialog()).toBeNull();
  });

  it('行内公式也能点开，输入框预填当前 LaTeX', async () => {
    const editor = buildEditor('before $$x^2$$ after');
    await mount(editor);
    await clickMath(editor);

    const panel = dialog();
    expect(panel).not.toBeNull();
    expect(panel!.querySelector('input')!.value).toBe('x^2');
  });

  it('只读态点击公式不打开编辑层', async () => {
    const editor = buildEditor(BLOCK_MATH_MD, false);
    await mount(editor);
    await clickMath(editor);
    expect(dialog()).toBeNull();
  });

  it('多个编辑器各自监听自己的公式，互不串台', async () => {
    const first = buildEditor('$$\nfirst\n$$');
    const second = buildEditor('$$\nsecond\n$$');
    await mount(first);
    await mount(second);

    await clickMath(first);

    // 只有第一个编辑器弹层；内容也是 first，说明第二个实例没有响应同一次点击
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(dialog()!.querySelector('textarea')!.value).toBe('first');
  });
});
