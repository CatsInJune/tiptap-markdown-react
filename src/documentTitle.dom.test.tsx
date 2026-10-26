/** @vitest-environment happy-dom */
import type { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorHandle,
  type MarkdownWysiwygEditorProps,
} from './components/MarkdownWysiwygEditor';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('正文文档标题', () => {
  let host: HTMLDivElement;
  let root: Root | undefined;
  let editor: Editor | null;
  let handle: MarkdownWysiwygEditorHandle | null;

  function mount(props: Partial<MarkdownWysiwygEditorProps> = {}) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    editor = null;
    handle = null;
    return act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown="正文"
          onEditorReady={(next) => {
            editor = next;
          }}
          ref={(next) => {
            handle = next;
          }}
          {...props}
        />,
      );
    });
  }

  function titleField() {
    return host.querySelector<HTMLTextAreaElement>('[data-document-title]');
  }

  async function typeTitle(value: string) {
    const el = titleField();
    if (!el) throw new Error('title field missing');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setter?.call(el, value);
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
  });

  it('默认在正文顶部显示可留空的标题，占位为 Title', async () => {
    await mount();
    const el = titleField();
    expect(el).not.toBeNull();
    expect(el?.placeholder).toBe('Title');
    expect(el?.value).toBe('');
    expect(el?.maxLength).toBe(200);
    expect(handle?.getDocumentTitle()).toBe('');
  });

  it('中文占位为「标题」', async () => {
    await mount({ locale: 'zh' });
    expect(titleField()?.placeholder).toBe('标题');
  });

  it('documentTitle={false} 不占位', async () => {
    await mount({ documentTitle: false });
    expect(titleField()).toBeNull();
    expect(handle?.getDocumentTitle()).toBe('');
  });

  it('标题不写进 markdown', async () => {
    await mount({ defaultDocumentTitle: '年度报告' });
    expect(titleField()?.value).toBe('年度报告');
    expect(handle?.getDocumentTitle()).toBe('年度报告');
    expect(editor?.getMarkdown()).not.toContain('年度报告');
    expect(editor?.getMarkdown()).toContain('正文');
  });

  it('输入后可通过 ref 读到，正文不变', async () => {
    await mount();
    const before = editor?.getMarkdown();
    await typeTitle('一季报');
    expect(handle?.getDocumentTitle()).toBe('一季报');
    expect(editor?.getMarkdown()).toBe(before);
  });

  it('受控标题跟随 props，并上报变化', async () => {
    const seen: string[] = [];
    await mount({
      documentTitle: '初稿',
      onDocumentTitleChange: (next) => seen.push(next),
    });
    expect(titleField()?.value).toBe('初稿');
    await typeTitle('定稿');
    expect(seen).toEqual(['定稿']);
    expect(titleField()?.value).toBe('初稿');

    await act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown="正文"
          documentTitle="定稿"
          onDocumentTitleChange={(next) => seen.push(next)}
          onEditorReady={(next) => {
            editor = next;
          }}
          ref={(next) => {
            handle = next;
          }}
        />,
      );
    });
    expect(titleField()?.value).toBe('定稿');
    expect(handle?.getDocumentTitle()).toBe('定稿');
  });

  it('Enter 把光标送进正文，不在标题里换行', async () => {
    await mount({ defaultDocumentTitle: '标题' });
    const el = titleField()!;
    await act(async () => {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    });
    expect(el.value).toBe('标题');
    expect(editor?.isFocused).toBe(true);
  });

  it('正文开头按上方向键回到标题', async () => {
    await mount({ defaultDocumentTitle: '标题' });
    expect(editor).not.toBeNull();
    // 不用 commands.focus：它会排一帧再把焦点抢回编辑器。
    editor?.commands.setTextSelection(1);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    let handled = false;
    await act(async () => {
      editor?.view.someProp('handleKeyDown', (fn) => {
        if (fn(editor!.view, event)) handled = true;
      });
    });
    expect(handled).toBe(true);
    expect(document.activeElement).toBe(titleField());
  });

  it('只读且没有标题时不显示空占位', async () => {
    await mount({ editable: false });
    expect(titleField()).toBeNull();
  });

  it('只读且已有标题时展示，不能改', async () => {
    await mount({ editable: false, defaultDocumentTitle: '已发布' });
    const el = titleField();
    expect(el?.value).toBe('已发布');
    expect(el?.readOnly).toBe(true);
  });
});
