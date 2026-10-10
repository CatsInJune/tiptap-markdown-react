/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { ImageUploadNode } from '../imageUpload';
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

/**
 * 图片按钮的两条路径：编辑器注册了 imageUpload 扩展 → 插上传占位块（官方交互，
 * 配置在 `<MarkdownWysiwygEditor imageUpload>`）；没注册但传了 onImageUpload →
 * 旧的直传路径（点按钮直接开文件框）。两者都没有就不渲染按钮。
 */
describe('EditorToolbar 的图片按钮', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const mount = async ({
    withExtension,
    props = {},
  }: {
    withExtension: boolean;
    props?: Partial<EditorToolbarProps>;
  }) => {
    editor = new Editor({
      extensions: [
        ...baseExtensions,
        ...(withExtension
          ? [
              ImageUploadNode.configure({
                upload: async () => 'https://cdn/x.png',
              }),
            ]
          : []),
        Markdown,
      ],
      content: '',
      contentType: 'markdown',
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<EditorToolbar editor={editor} {...props} />);
    });
    return host;
  };

  const imageButton = () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="Image"]');

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  it('注册了扩展：不传 onImageUpload 也出现按钮，点击插入占位块', async () => {
    await mount({ withExtension: true });

    const button = imageButton();
    expect(button).not.toBeNull();
    // 工具栏自己不再渲染图片用的隐藏 file input（文件框改由占位块内部开）；
    // 注意带 accept 过滤——常驻的「导入」input 也是 type=file。
    expect(
      host.querySelector('input[type="file"][accept="image/*"]'),
    ).toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const names: string[] = [];
    editor.state.doc.descendants((n) => {
      names.push(n.type.name);
    });
    expect(names).toContain('imageUpload');
  });

  it('没注册扩展但传了 onImageUpload：走旧的直传路径', async () => {
    const onImageUpload = vi.fn(async () => 'https://cdn/x.png');
    await mount({ withExtension: false, props: { onImageUpload } });

    expect(imageButton()).not.toBeNull();
    const input = host.querySelector<HTMLInputElement>(
      'input[type="file"][accept="image/*"]',
    );
    expect(input).not.toBeNull();

    const click = vi.spyOn(input as HTMLInputElement, 'click');
    await act(async () => {
      imageButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('两者都没有：按钮不出现', async () => {
    await mount({ withExtension: false });
    expect(imageButton()).toBeNull();
  });
});
