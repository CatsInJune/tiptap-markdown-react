// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { VersionHistoryPanel, type DocumentVersion } from './VersionHistoryPanel';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function buildEditor(markdown: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content: markdown,
    contentType: 'markdown',
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
    expect(dialog.querySelector('[data-version-id="b"][data-version-current]')).not.toBeNull();
    expect(dialog.querySelector('[data-version-id="b"]')?.getAttribute('aria-current')).toBe('true');
    expect(dialog.querySelector('[data-version-id="b"]')?.textContent).not.toContain('版本乙');
    expect([...dialog.querySelectorAll('[data-diff="insert"]')].map((el) => el.textContent).join('')).toContain('乙');
    expect(dialog.querySelector('button[data-version-action="compare"]')).toBeNull();
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

  it('正文相同的多条里，当前标记只打在时间最新的一条', async () => {
    editor = buildEditor('版本甲');
    await mount({
      versions: [
        { id: 'new', title: '新', markdown: '版本甲', createdAt: '2026-03-04T00:00:00.000Z', badge: '草稿' },
        { id: 'old', title: '旧', markdown: '版本甲', createdAt: '2026-03-01T00:00:00.000Z', badge: '已发布' },
      ],
    });
    await openDialog();
    expect(document.querySelector('[data-version-id="new"][data-version-current]')).not.toBeNull();
    expect(document.querySelector('[data-version-id="old"][data-version-current]')).toBeNull();
    expect(document.querySelector('[data-version-id="new"]')?.textContent).toContain('草稿');
  });

  it('默认打开和当前正文一致的那一版，而不是列表第一条', async () => {
    editor = buildEditor('版本甲');
    await mount();
    await openDialog();
    expect(document.querySelector('[data-version-id="a"]')?.getAttribute('aria-current')).toBe('true');
    expect([...document.querySelectorAll('[data-diff="insert"]')].map((el) => el.textContent).join('')).toContain('甲');
  });

  it('没有可对比的记录时，空版本显示空状态', async () => {
    editor = buildEditor('当前正文');
    await mount({ versions: [{ id: 'empty', title: '空', markdown: '   ' }] });
    await openDialog();
    expect(document.querySelector('[data-version-preview]')?.textContent).toContain('This version is empty');
    expect(document.querySelector<HTMLButtonElement>('[data-version-action="restore"]')?.disabled).toBe(true);
  });

  it('没有版本时只显示空状态', async () => {
    editor = buildEditor('当前正文');
    await mount({ versions: [] });
    await openDialog();
    expect(document.querySelector('[data-version-id]')).toBeNull();
    expect(document.querySelector('[data-version-history]')?.textContent).toContain('No versions yet');
  });
});
