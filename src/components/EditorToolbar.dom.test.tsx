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

  it('locale=zh 使用内置中文', async () => {
    await mount({ onSearch: () => {}, locale: 'zh' });
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

describe('样式按钮显示当前块级', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  async function mount(markdown: string, locale?: 'zh' | 'en') {
    editor = new Editor({
      extensions: [...baseExtensions, Markdown],
      content: markdown,
      contentType: 'markdown',
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<EditorToolbar editor={editor} locale={locale} />);
    });
  }

  function styleButton() {
    return host.querySelector<HTMLButtonElement>('button[aria-label="Style"], button[aria-label="样式"]');
  }

  it('正文显示「正文」，光标在标题上显示 H 级', async () => {
    await mount('正文', 'zh');
    const value = () =>
      styleButton()?.querySelector('[class*="styleTriggerValue"]')?.textContent;
    expect(value()).toBe('正文');
    expect(styleButton()?.title).toBe('正文');

    editor.chain().focus().toggleHeading({ level: 2 }).run();
    await act(async () => {});
    expect(value()).toBe('H2');
    expect(styleButton()?.title).toBe('标题 2');
  });

  it('字号在「字号」和具体像素之间切换，占位宽度包含全部档位', async () => {
    await mount('正文', 'zh');
    const fontButton = () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="字号"]');
    const value = () =>
      fontButton()?.querySelector('[class*="styleTriggerValue"]')?.textContent;
    const sizer = fontButton()?.querySelector('[class*="styleTriggerSizer"]');
    expect(value()).toBe('字号');
    expect(sizer?.textContent).toContain('字号');
    expect(sizer?.textContent).toContain('24px');
    expect(sizer?.textContent).toContain('30px');

    editor.chain().focus().selectAll().setFontSize('24px').run();
    await act(async () => {});
    expect(value()).toBe('24px');
  });
});

describe('焦点在文档标题时', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  async function mount() {
    editor = new Editor({
      extensions: [...baseExtensions, Markdown],
      content: '正文',
      contentType: 'markdown',
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <div>
          <textarea data-document-title="" defaultValue="年度报告" />
          <EditorToolbar editor={editor} locale="zh" />
        </div>,
      );
    });
  }

  function title() {
    return host.querySelector<HTMLTextAreaElement>('[data-document-title]')!;
  }

  async function focusTitle() {
    await act(async () => {
      title().focus();
    });
  }

  it('在大标题里选 H，不会改到下面的正文', async () => {
    await mount();
    editor.chain().focus().toggleHeading({ level: 1 }).run();
    await focusTitle();
    const style = host.querySelector<HTMLButtonElement>('button[aria-label="样式"]');
    expect(style?.querySelector('[class*="styleTriggerValue"]')?.textContent).toBe('正文');
    await act(async () => {
      style?.click();
    });
    const heading = [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('标题 2'),
    );
    await act(async () => {
      heading?.click();
    });
    expect(editor.isActive('heading', { level: 1 })).toBe(true);
    expect(editor.isActive('heading', { level: 2 })).toBe(false);
    expect(title().value).toBe('年度报告');
    expect(document.activeElement).toBe(title());
  });

  it('加粗不会改到正文', async () => {
    await mount();
    await focusTitle();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="加粗"]')?.click();
    });
    expect(editor.isActive('bold')).toBe(false);
    expect(editor.getText()).toBe('正文');
    expect(document.activeElement).toBe(title());
  });
});

describe('格式刷和清除格式', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const mount = async (markdown: string) => {
    editor = new Editor({
      extensions: [...baseExtensions, Markdown],
      content: markdown,
      contentType: 'markdown',
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<EditorToolbar editor={editor} />);
    });
  };

  const button = (label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  const select = (text: string) => {
    let from = -1;
    editor.state.doc.descendants((node, pos) => {
      if (from >= 0 || !node.isText || !node.text) return;
      const index = node.text.indexOf(text);
      if (index >= 0) from = pos + index;
    });
    editor.commands.setTextSelection({ from, to: from + text.length });
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  it('清除格式按钮卸掉加粗，并且排在重做右边', async () => {
    await mount('**bold**');
    const labels = [...host.querySelectorAll('button')].map((button) =>
      button.getAttribute('aria-label'),
    );
    const redoAt = labels.indexOf('Redo');
    const painterAt = labels.indexOf(
      'Format painter. Double-click to keep using it, Esc to cancel',
    );
    const clearAt = labels.indexOf('Clear formatting');
    expect(painterAt).toBe(redoAt + 1);
    expect(clearAt).toBe(redoAt + 2);

    editor.commands.selectAll();
    await act(async () => {
      button('Clear formatting')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
    expect(editor.getMarkdown()).not.toContain('**');
    expect(editor.getMarkdown()).toContain('bold');
  });

  it('单击格式刷套用一次，Esc 取消，双击后可以连续套', async () => {
    await mount('**src**\n\none\n\ntwo');
    const painter = () =>
      button('Format painter. Double-click to keep using it, Esc to cancel');

    select('src');
    await act(async () => {
      painter()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(painter()?.getAttribute('aria-pressed')).toBe('true');
    expect(editor.view.dom.classList.contains('tmr-format-painter')).toBe(true);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(painter()?.getAttribute('aria-pressed')).toBe('false');

    select('src');
    await act(async () => {
      painter()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      painter()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(painter()?.getAttribute('aria-pressed')).toBe('true');

    const paint = async (text: string) => {
      select(text);
      await act(async () => {
        editor.view.dom.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true }),
        );
      });
    };
    await paint('one');
    expect(painter()?.getAttribute('aria-pressed')).toBe('true');
    await paint('two');
    expect(editor.getMarkdown()).toContain('**one**');
    expect(editor.getMarkdown()).toContain('**two**');
  });

  it('locale=zh 使用格式刷和清除格式', async () => {
    await mount('x');
    await act(async () => {
      root.render(<EditorToolbar editor={editor} locale="zh" />);
    });
    expect(button('格式刷。双击可连续使用，Esc 取消')).not.toBeNull();
    expect(button('清除格式')).not.toBeNull();
  });
});

describe('EditorToolbar 的全屏', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;
  const extras: HTMLElement[] = [];

  const buildEditor = () =>
    new Editor({
      extensions: [...baseExtensions, Markdown],
      content: 'hello',
      contentType: 'markdown',
    });

  const mount = async (
    props: Partial<EditorToolbarProps> = {},
    parent: HTMLElement = document.body,
  ) => {
    editor = buildEditor();
    host = document.createElement('div');
    parent.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<EditorToolbar editor={editor} {...props} />);
    });
  };

  const button = (label: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  const openMore = async (label = 'More') => {
    await act(async () => {
      host
        .querySelector<HTMLButtonElement>(`button[title="${label}"]`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const click = async (label: string) => {
    await act(async () => {
      button(label)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const pressEscape = async () => {
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
  };

  afterEach(() => {
    act(() => {
      try {
        root?.unmount();
      } catch {
        // 用例里已经卸过
      }
    });
    host?.remove();
    for (const node of extras.splice(0)) node.remove();
    editor?.destroy();
    document.documentElement.removeAttribute('data-tmr-fullscreen-root');
    document.body.style.overflow = '';
  });

  it('全屏在更多菜单里，点一下铺满，再打开菜单退出', async () => {
    document.body.style.overflow = 'scroll';
    await mount();

    expect(button('Full screen')).toBeNull();
    await openMore();
    expect(button('Full screen')?.getAttribute('aria-pressed')).toBeNull();
    await click('Full screen');

    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(true);
    expect(document.documentElement.hasAttribute('data-tmr-fullscreen-root')).toBe(
      true,
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(button('Full screen')).toBeNull();

    await openMore();
    expect(button('Exit full screen')?.getAttribute('aria-pressed')).toBe('true');
    await click('Exit full screen');
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
    expect(document.documentElement.hasAttribute('data-tmr-fullscreen-root')).toBe(
      false,
    );
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('Esc 退出；浮层还在时第一次 Esc 不退出', async () => {
    await mount();
    await openMore();
    await click('Full screen');

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    extras.push(dialog);

    await pressEscape();
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(true);

    dialog.remove();
    await pressEscape();
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
  });

  it('页面上常驻的导航菜单不拦住 Esc 退出全屏', async () => {
    const sider = document.createElement('aside');
    sider.className = 'ant-layout-sider';
    const menu = document.createElement('ul');
    menu.className = 'ant-menu ant-menu-root';
    menu.setAttribute('role', 'menu');
    sider.appendChild(menu);
    document.body.appendChild(sider);
    extras.push(sider);

    await mount();
    await openMore();
    await click('Full screen');
    await pressEscape();
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
  });

  it('弹出的菜单仍然先吃掉第一次 Esc', async () => {
    const popup = document.createElement('div');
    popup.className = 'ant-dropdown';
    const menu = document.createElement('ul');
    menu.setAttribute('role', 'menu');
    popup.appendChild(menu);
    document.body.appendChild(popup);
    extras.push(popup);

    await mount();
    await openMore();
    await click('Full screen');
    await pressEscape();
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(true);

    popup.style.display = 'none';
    await pressEscape();
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
  });

  it('locale=zh 使用全屏 / 退出全屏', async () => {
    await mount({ locale: 'zh' });
    await openMore('更多');
    expect(button('全屏')).not.toBeNull();
    await click('全屏');
    await openMore('更多');
    expect(button('退出全屏')).not.toBeNull();
  });

  it('showFullscreen={false} 不渲染全屏项', async () => {
    await mount({ showFullscreen: false });
    await openMore();
    expect(button('Full screen')).toBeNull();
  });

  it('fullscreenTarget 优先于默认父级', async () => {
    const frame = document.createElement('section');
    document.body.appendChild(frame);
    extras.push(frame);
    await mount({ fullscreenTarget: () => frame });

    await openMore();
    await click('Full screen');
    expect(frame.hasAttribute('data-tmr-fullscreen')).toBe(true);
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
  });

  it('工具栏多包一层时，铺满同时包住编辑器的祖先', async () => {
    const frame = document.createElement('div');
    const slot = document.createElement('div');
    const surface = document.createElement('div');
    surface.className = 'ProseMirror';
    frame.append(slot, surface);
    document.body.appendChild(frame);
    extras.push(frame);

    await mount({}, slot);
    await openMore();
    await click('Full screen');
    expect(frame.hasAttribute('data-tmr-fullscreen')).toBe(true);
    expect(slot.hasAttribute('data-tmr-fullscreen')).toBe(false);
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
  });

  it('onFullscreenChange 在打开、Esc 和卸载时回调', async () => {
    const onFullscreenChange = vi.fn();
    await mount({ onFullscreenChange });

    await openMore();
    await click('Full screen');
    expect(onFullscreenChange).toHaveBeenLastCalledWith(true);

    await pressEscape();
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);

    await openMore();
    await click('Full screen');
    await act(async () => {
      root.unmount();
    });
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
    expect(host.hasAttribute('data-tmr-fullscreen')).toBe(false);
  });
});
