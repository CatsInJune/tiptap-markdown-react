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

/**
 * 空文档占位符：`placeholder` prop 走官方 Placeholder 扩展，把
 * data-placeholder 属性 + is-editor-empty 类以节点装饰打在空文本块上
 * （CSS 在节点上取 attr），而不是早先那样挂在根 div 上永远取不到。
 */
describe('空文档占位符', () => {
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
          initialMarkdown=""
          onEditorReady={(e) => {
            editor = e;
          }}
          {...props}
        />,
      );
    });
  }

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = undefined;
    host?.remove();
  });

  it('传 placeholder：属性与类落在空段落上，且文案一致', async () => {
    await mount({ placeholder: '写点什么…' });
    const el = host.querySelector('[data-placeholder]');
    expect(el?.tagName).toBe('P');
    expect(el?.getAttribute('data-placeholder')).toBe('写点什么…');
    expect(el?.className).toContain('is-editor-empty');
  });

  it('输入文字后占位符消失，清空后回来', async () => {
    await mount({ placeholder: '写点什么…' });
    expect(host.querySelector('.is-editor-empty')).not.toBeNull();

    await act(async () => {
      editor?.commands.insertContent('hi');
    });
    expect(host.querySelector('.is-editor-empty')).toBeNull();

    await act(async () => {
      editor?.commands.clearContent();
    });
    expect(host.querySelector('.is-editor-empty')).not.toBeNull();
  });

  it('不传 placeholder：无任何占位装饰', async () => {
    await mount();
    expect(host.querySelector('[data-placeholder]')).toBeNull();
    expect(host.querySelector('.is-editor-empty')).toBeNull();
  });

  it('只读态不显示占位符', async () => {
    await mount({ placeholder: '写点什么…', editable: false });
    expect(host.querySelector('.is-editor-empty')).toBeNull();
  });
});
