/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { EditorToolbar, type EditorToolbarProps } from './EditorToolbar';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

/**
 * 工具栏的搜索入口：只开一道门，不搬条子。
 *
 * 浮动条（FindReplaceBar）归 `<MarkdownWysiwygEditor>`，工具栏只把这个入口画出来、把点击
 * 转给宿主。所以这里钉的是四件事：不传 `onSearch` 就不出现、点击冒泡到宿主、
 * `searchActive` 驱动 `aria-pressed`、文案可注入。
 */
describe('EditorToolbar 的搜索入口', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const buildEditor = () =>
    new Editor({
      extensions: [
        ...baseExtensions,
        FindAndReplace.configure({ injectCSS: false, searchDebounceMs: 0 }),
        Markdown,
      ],
      content: 'one two one',
      contentType: 'markdown',
    });

  const mount = async (props: Partial<EditorToolbarProps> = {}) => {
    editor = buildEditor();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<EditorToolbar editor={editor} {...props} />);
    });
    return host;
  };

  const searchButton = (label = 'Find & replace') =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  it('不传 onSearch 就不渲染（入口归宿主，没接就不出现）', async () => {
    await mount();
    expect(searchButton()).toBeNull();
  });

  it('传了 onSearch：按钮出现，点击转给宿主', async () => {
    const onSearch = vi.fn();
    await mount({ onSearch });

    const button = searchButton();
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('searchActive 驱动 aria-pressed（条子开着时高亮）', async () => {
    await mount({ onSearch: () => {}, searchActive: true });
    expect(searchButton()?.getAttribute('aria-pressed')).toBe('true');
  });

  it('文案可注入', async () => {
    await mount({ onSearch: () => {}, labels: { search: '查找替换' } });
    expect(searchButton('查找替换')).not.toBeNull();
  });
});
