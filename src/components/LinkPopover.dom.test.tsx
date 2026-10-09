// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { LinkPopover, type LinkPopoverProps } from './LinkPopover';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function buildEditor(markdown: string, editable = true): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content: markdown,
    contentType: 'markdown',
    editable,
  });
}

/** 受控 input 的老规矩：走原生 setter 再派发 input，React 的 onChange 才会触发。 */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 把光标放进第一段匹配文本里 */
function caretIn(editor: Editor, text: string): void {
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (pos === -1 && node.isText && node.text?.includes(text)) {
      pos = nodePos + Math.max(1, Math.round(text.length / 2));
    }
    return true;
  });
  if (pos === -1) throw new Error(`正文里找不到「${text}」`);
  editor.commands.setTextSelection(pos);
}

describe('LinkPopover', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  /** 浮层 portal 到 body，所以查询一律从 document 起 */
  const panel = () => document.querySelector('[data-link-popover]');
  const field = () =>
    document.querySelector<HTMLInputElement>('[data-link-field]');
  const action = (name: 'apply' | 'open' | 'remove') =>
    document.querySelector<HTMLButtonElement>(`[data-link-action="${name}"]`);

  const mount = async (props: Partial<LinkPopoverProps> & { editor: Editor }) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <LinkPopover
          trigger={<button type="button" data-test-trigger="" aria-label="Link" />}
          {...props}
        />,
      );
    });
    return host;
  };

  const click = async (el: Element | null) => {
    expect(el).not.toBeNull();
    await act(async () => {
      el!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  it('点触发器打开浮层；光标在链接里时预填当前地址', async () => {
    editor = buildEditor('[链接](https://a.example) 末尾');
    caretIn(editor, '链接');
    await mount({ editor });

    expect(panel()).toBeNull();
    await click(host.querySelector('[data-test-trigger]'));

    expect(panel()).not.toBeNull();
    expect(panel()?.getAttribute('role')).toBe('dialog');
    expect(field()?.value).toBe('https://a.example');
  });

  it('改地址并应用：整条链接换地址、文字保留，浮层收起', async () => {
    editor = buildEditor('[链接](https://old.example)');
    caretIn(editor, '链接');
    await mount({ editor });
    await click(host.querySelector('[data-test-trigger]'));

    await act(async () => {
      typeInto(field()!, 'https://new.example');
    });
    await click(action('apply'));

    expect(editor.getMarkdown()).toBe('[链接](https://new.example)');
    expect(panel()).toBeNull();
  });

  it('移除：链接摘掉，浮层收起', async () => {
    editor = buildEditor('前面 [链接](https://a.example) 后面');
    caretIn(editor, '链接');
    await mount({ editor });
    await click(host.querySelector('[data-test-trigger]'));

    await click(action('remove'));
    expect(editor.getMarkdown()).toBe('前面 链接 后面');
    expect(panel()).toBeNull();
  });

  it('编辑器拒绝的地址：不关浮层、输入框标记非法、正文不动', async () => {
    editor = buildEditor('[链接](https://old.example)');
    caretIn(editor, '链接');
    await mount({ editor });
    await click(host.querySelector('[data-test-trigger]'));

    await act(async () => {
      typeInto(field()!, 'javascript:alert(1)');
    });
    await click(action('apply'));

    expect(panel()).not.toBeNull();
    expect(field()?.getAttribute('data-link-invalid')).toBe('');
    expect(field()?.getAttribute('aria-invalid')).toBe('true');
    expect(editor.getMarkdown()).toBe('[链接](https://old.example)');
  });

  it('输入法组合中的回车不应用（提交候选词），普通回车才应用', async () => {
    editor = buildEditor('前面 后面');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    await mount({ editor });
    await click(host.querySelector('[data-test-trigger]'));

    await act(async () => {
      typeInto(field()!, 'https://a.example');
    });
    await act(async () => {
      field()!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      );
    });
    expect(panel()).not.toBeNull();
    expect(editor.getMarkdown()).not.toContain('a.example');

    await act(async () => {
      field()!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    });
    expect(editor.getMarkdown()).toContain('[https://a.example](https://a.example)');
    expect(panel()).toBeNull();
  });

  it('没填地址时「应用」不可点；只读态下「应用 / 移除」都不可点', async () => {
    editor = buildEditor('x');
    await mount({ editor });
    await click(host.querySelector('[data-test-trigger]'));
    expect(action('apply')?.disabled).toBe(true);
    expect(action('open')?.disabled).toBe(true);

    await act(async () => {
      typeInto(field()!, 'https://a.example');
    });
    expect(action('apply')?.disabled).toBe(false);

    act(() => {
      root.unmount();
    });
    editor.destroy();

    editor = buildEditor('[链接](https://a.example)', false);
    caretIn(editor, '链接');
    root = createRoot(host);
    await act(async () => {
      root.render(
        <LinkPopover
          editor={editor}
          trigger={<button type="button" data-test-trigger="" aria-label="Link" />}
        />,
      );
    });
    await click(host.querySelector('[data-test-trigger]'));
    expect(action('apply')?.disabled).toBe(true);
    expect(action('remove')?.disabled).toBe(true);
  });

  it('文案可注入，并给宿主留下稳定选择器', async () => {
    editor = buildEditor('x');
    await mount({
      editor,
      labels: { field: '粘贴链接', apply: '应用', open: '新窗口打开', remove: '移除' },
    });
    await click(host.querySelector('[data-test-trigger]'));

    expect(field()?.getAttribute('placeholder')).toBe('粘贴链接');
    expect(panel()?.getAttribute('aria-label')).toBe('粘贴链接');
    expect(action('apply')?.getAttribute('aria-label')).toBe('应用');
    expect(action('open')?.getAttribute('aria-label')).toBe('新窗口打开');
    expect(action('remove')?.getAttribute('aria-label')).toBe('移除');
    expect(document.querySelector('[data-link-popover]')).not.toBeNull();
  });
});
