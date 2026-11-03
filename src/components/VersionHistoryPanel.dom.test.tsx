// @vitest-environment happy-dom
import { Editor, Extension } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { VersionHistoryPanel, type DocumentVersion } from './VersionHistoryPanel';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** 测试用块 ID 属性（正式块 ID 序列化层在 commit 3 落地）。 */
const BlockIdAttr = Extension.create({
  name: 'blockIdAttrTest',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-id'),
            renderHTML: (attributes) =>
              attributes.blockId ? { 'data-block-id': attributes.blockId as string } : {},
          },
        },
      },
    ];
  },
});

function buildEditor(markdown: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content: markdown,
    contentType: 'markdown',
  });
}

function buildChapterEditor(): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown, BlockIdAttr],
    content: `
      <h2 data-block-id="b_ch1">第一章</h2>
      <p>原来的第一章正文</p>
      <h2 data-block-id="b_ch2">第二章</h2>
      <p>第二章正文</p>
    `,
  });
}

const versions: DocumentVersion[] = [
  { id: 'b', title: '乙', markdown: '版本乙', detail: 'Bao' },
  { id: 'a', title: '甲', markdown: '版本甲' },
  { id: 'empty', title: '空', markdown: '   ' },
];

describe('VersionHistoryPanel', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const mount = async (props?: {
    versions?: DocumentVersion[];
    onClose?: () => void;
    onRestore?: (version: DocumentVersion) => void;
    onLoadVersionContent?: (id: string) => Promise<string>;
    buttonOffset?: { top?: number; left?: number };
    buttonContainer?: HTMLElement;
  }) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <VersionHistoryPanel
          editor={editor}
          versions={props?.versions ?? versions}
          onClose={props?.onClose}
          onRestore={props?.onRestore}
          onLoadVersionContent={props?.onLoadVersionContent}
          buttonOffset={props?.buttonOffset}
          buttonContainer={props?.buttonContainer}
        />,
      );
    });
    await act(async () => {});
  };

  const click = async (el: Element) => {
    await act(async () => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const openDialog = async () => {
    await click(document.querySelector('[data-version-action="open"]')!);
    await act(async () => {});
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  it('悬浮按钮默认钉在右下角，宿主可以用偏移改位置', async () => {
    editor = buildEditor('当前正文');
    await mount({ buttonOffset: { top: 12, left: 16 } });
    const button = document.querySelector<HTMLButtonElement>('[data-version-action="open"]')!;
    expect(button.style.top).toBe('12px');
    expect(button.style.left).toBe('16px');
    expect(button.style.right).toBe('');
    expect(button.style.bottom).toBe('');
  });

  it('没指定偏移时叠在快捷键悬浮钮上方，右缘对齐', async () => {
    editor = buildEditor('当前正文');
    const slot = document.createElement('div');
    const shortcut = document.createElement('button');
    shortcut.setAttribute('data-shortcut-fab', '');
    shortcut.getBoundingClientRect = () =>
      ({
        top: 200,
        right: 400,
        bottom: 244,
        left: 356,
        width: 44,
        height: 44,
        x: 356,
        y: 200,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    slot.appendChild(shortcut);
    document.body.appendChild(slot);
    await mount({ buttonContainer: slot });
    const button = slot.querySelector<HTMLButtonElement>('[data-version-action="open"]')!;
    expect(button.style.right).toBe(`${Math.round(window.innerWidth - 400)}px`);
    expect(button.style.bottom).toBe(`${Math.round(window.innerHeight - 200 + 12)}px`);
    expect(button.querySelector('svg')?.getAttribute('width')).toBe('18');
    slot.remove();
  });

  it('快捷键钮在编辑器外面时，仍然叠在它上方', async () => {
    editor = buildEditor('当前正文');
    const shortcut = document.createElement('button');
    shortcut.setAttribute('data-shortcut-fab', '');
    shortcut.getBoundingClientRect = () =>
      ({
        top: 200,
        right: 400,
        bottom: 244,
        left: 356,
        width: 44,
        height: 44,
        x: 356,
        y: 200,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    document.body.appendChild(shortcut);
    await mount();
    const button = document.querySelector<HTMLButtonElement>('[data-version-action="open"]')!;
    expect(button.style.right).toBe(`${Math.round(window.innerWidth - 400)}px`);
    expect(button.style.bottom).toBe(`${Math.round(window.innerHeight - 200 + 12)}px`);
    shortcut.remove();
  });

  it('按钮可以挂进宿主容器', async () => {
    editor = buildEditor('当前正文');
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    await mount({ buttonContainer: slot });
    expect(slot.querySelector('[data-version-action="open"]')).not.toBeNull();
    expect(host.querySelector('[data-version-action="open"]')).toBeNull();
    slot.remove();
  });

  it('按宿主顺序排列，切换条目换预览，对比出高亮，恢复写回编辑器', async () => {
    editor = buildEditor('版本乙');
    const onRestore = vi.fn();
    let markdownWhenClosed = '';
    const onClose = vi.fn(() => {
      markdownWhenClosed = editor.getMarkdown();
    });
    await mount({ onRestore, onClose });
    await openDialog();

    const dialog = document.querySelector('[data-version-history]')!;
    const ids = [...dialog.querySelectorAll('[data-version-id]')].map((el) => el.getAttribute('data-version-id'));
    expect(ids).toEqual(['b', 'a', 'empty']);
    // 不再有「当前稿对齐」标记；默认选中第一条（最新一版）。
    expect(dialog.querySelector('[data-version-current]')).toBeNull();
    expect(dialog.querySelector('[data-version-id="b"]')?.getAttribute('aria-current')).toBe('true');
    expect(dialog.querySelector('[data-version-id="b"]')?.textContent).not.toContain('版本乙');
    expect([...dialog.querySelectorAll('[data-diff="insert"]')].map((el) => el.textContent).join('')).toContain('乙');
    expect(dialog.querySelector('button[data-version-action="compare"]')).toBeNull();
    // 多于一条记录才有对比状态栏。
    expect(dialog.querySelector('[data-version-stage]')).not.toBeNull();
    expect(dialog.textContent).toContain('Compare');
    expect(dialog.textContent).not.toContain('Choose a record');
    expect(dialog.textContent).not.toContain('Current document');

    await click(dialog.querySelector('[data-version-id="a"]')!);
    await act(async () => {});
    await click(dialog.querySelector('[data-version-target]')!);
    await act(async () => {});
    await click(document.querySelector('[data-version-target-id="empty"]')!);
    await act(async () => {});
    const inserted = [...dialog.querySelectorAll('[data-diff="insert"]')].map((el) => el.textContent).join('');
    const removed = [...dialog.querySelectorAll('[data-diff="delete"]')].map((el) => el.textContent).join('');
    expect(inserted).toContain('版本甲');
    expect(removed).not.toContain('版本甲');
    expect(dialog.querySelector('[data-diff="format"]')).toBeNull();

    const actions = [...dialog.querySelectorAll('[data-version-action]')].map((el) => el.getAttribute('data-version-action'));
    expect(actions.at(-1)).toBe('close');

    await click(dialog.querySelector('[data-version-action="restore"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(markdownWhenClosed).toContain('版本乙');
    expect(document.querySelector('[data-version-history]')).toBeNull();
    expect(editor.getMarkdown()).toContain('版本甲');
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', markdown: '版本甲' }));
  });

  it('默认选中最新一版，不做当前稿全文比对', async () => {
    editor = buildEditor('版本甲');
    await mount();
    await openDialog();
    // 第一条是 b（版本乙），与当前正文不同也仍默认选它。
    expect(document.querySelector('[data-version-id="b"]')?.getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('[data-version-id="a"]')?.getAttribute('aria-current')).toBeNull();
    expect(document.querySelector('[data-version-current]')).toBeNull();
    expect([...document.querySelectorAll('[data-diff="insert"]')].map((el) => el.textContent).join('')).toContain('乙');
  });

  it('列表只带元数据时按需取全文，加载期间显示加载态', async () => {
    editor = buildEditor('当前正文');
    let resolveLoad!: (markdown: string) => void;
    const onLoadVersionContent = vi.fn(
      (id: string) =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
          expect(id).toBe('meta');
        }),
    );
    await mount({
      versions: [{ id: 'meta', title: '元数据行' }],
      onLoadVersionContent,
    });
    await openDialog();
    expect(onLoadVersionContent).toHaveBeenCalledWith('meta');
    expect(document.querySelector('[data-version-loading]')?.textContent).toContain(
      'Loading this version',
    );

    await act(async () => {
      resolveLoad('异步取回的正文');
    });
    expect(document.querySelector('[data-version-preview]')?.textContent).toContain('异步取回的正文');

    await click(document.querySelector('[data-version-action="restore"]')!);
    expect(editor.getMarkdown()).toContain('异步取回的正文');
  });

  it('恢复：章还在文档中时只替换该章范围', async () => {
    editor = buildChapterEditor();
    const onRestore = vi.fn();
    await mount({
      versions: [
        {
          id: 'ch1',
          title: '第一章',
          markdown: '## 第一章\n\n修订后的第一章正文',
          leadBlockId: 'b_ch1',
        },
      ],
      onRestore,
    });
    await openDialog();
    await click(document.querySelector('[data-version-action="restore"]')!);

    const markdown = editor.getMarkdown();
    expect(markdown).toContain('修订后的第一章正文');
    expect(markdown).not.toContain('原来的第一章正文');
    // 其他章原样保留。
    expect(markdown).toContain('第二章');
    expect(markdown).toContain('第二章正文');
    expect(document.querySelector('[data-version-notice]')).toBeNull();
    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ch1', markdown: '## 第一章\n\n修订后的第一章正文' }),
    );
  });

  it('恢复：章已不在文档中时把内容插入光标处并提示', async () => {
    editor = buildChapterEditor();
    const onRestore = vi.fn();
    const end = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection(end);
    await mount({
      versions: [
        {
          id: 'gone',
          title: '已删章节',
          markdown: '## 已删章节\n\n旧章内容',
          leadBlockId: 'b_gone',
        },
      ],
      onRestore,
    });
    await openDialog();
    await click(document.querySelector('[data-version-action="restore"]')!);

    const markdown = editor.getMarkdown();
    expect(markdown).toContain('已删章节');
    expect(markdown).toContain('旧章内容');
    // 原文档不被替换。
    expect(markdown).toContain('第一章');
    expect(markdown).toContain('第二章');
    const notice = document.querySelector('[data-version-notice]');
    expect(notice?.textContent).toContain('no longer in the document');
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'gone' }));
  });

  it('没有可对比的记录时，空版本显示空状态', async () => {
    editor = buildEditor('当前正文');
    await mount({ versions: [{ id: 'empty', title: '空', markdown: '   ' }] });
    await openDialog();
    // 只有一条记录：没有对比对象，顶部状态栏整条不展示。
    expect(document.querySelector('[data-version-stage]')).toBeNull();
    expect(document.querySelector('[data-version-preview]')?.textContent).toContain('This version is empty');
    expect(document.querySelector<HTMLButtonElement>('[data-version-action="restore"]')?.disabled).toBe(true);
  });

  it('没有版本时只显示空状态', async () => {
    editor = buildEditor('当前正文');
    await mount({ versions: [] });
    await openDialog();
    expect(document.querySelector('[data-version-id]')).toBeNull();
    expect(document.querySelector('[data-version-stage]')).toBeNull();
    expect(document.querySelector('[data-version-history]')?.textContent).toContain('No versions yet');
  });
});
