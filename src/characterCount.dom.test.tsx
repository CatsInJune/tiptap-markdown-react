/** @vitest-environment happy-dom */
import type { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorProps,
} from './components/MarkdownWysiwygEditor';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('全文统计', () => {
  let host: HTMLDivElement;
  let root: Root | undefined;
  let editor: Editor | null;

  function mount(props: Partial<MarkdownWysiwygEditorProps> = {}) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    editor = null;
    return act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown="hello world"
          onEditorReady={(e) => {
            editor = e;
          }}
          {...props}
        />,
      );
    });
  }

  function bar() {
    return host.querySelector<HTMLElement>('[data-characters]');
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
  });

  it('默认不显示统计条', async () => {
    await mount();
    expect(bar()).toBeNull();
  });

  it('characterCount 开启后显示全文字符数与词数', async () => {
    await mount({ characterCount: true });
    expect(bar()?.getAttribute('data-characters')).toBe('11');
    expect(bar()?.getAttribute('data-words')).toBe('2');
    expect(bar()?.textContent).toContain('11 characters');
    expect(bar()?.textContent).toContain('2 words');
  });

  it('编辑后实时更新，汉字按字计词', async () => {
    await mount({ characterCount: true, initialMarkdown: '你好' });
    expect(bar()?.getAttribute('data-characters')).toBe('2');
    expect(bar()?.getAttribute('data-words')).toBe('2');

    await act(async () => {
      editor?.chain().focus('end').insertContent(' world').run();
    });
    expect(bar()?.getAttribute('data-characters')).toBe('8');
    expect(bar()?.getAttribute('data-words')).toBe('3');
  });

  it('只读态同样显示', async () => {
    await mount({ characterCount: true, editable: false });
    expect(bar()?.getAttribute('data-words')).toBe('2');
  });
});
