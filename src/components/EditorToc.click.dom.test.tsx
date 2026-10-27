/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EditorToc } from './EditorToc';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

const items = [
  { id: 'a', text: '甲', level: 1 },
  { id: 'b', text: '乙', level: 2 },
  { id: 'c', text: '丙', level: 2 },
  { id: 'd', text: '丁', level: 1 },
];

function rect(top: number): DOMRect {
  return {
    top,
    bottom: top + 28,
    left: 0,
    right: 0,
    width: 0,
    height: 28,
    x: 0,
    y: top,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

describe('点击目录项', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('平滑滚动中途的 scrollend 不会让高亮逐节经过', async () => {
    host = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    scroller.style.maxHeight = '200px';
    Object.defineProperty(scroller, 'clientHeight', { get: () => 200 });
    Object.defineProperty(scroller, 'scrollHeight', { get: () => 2000 });
    scroller.getBoundingClientRect = () => rect(0);
    const editor = document.createElement('div');
    editor.innerHTML = items
      .map((item) => `<h${item.level} data-toc-id="${item.id}">${item.text}</h${item.level}>`)
      .join('');
    const tops: Record<string, number> = { a: -200, b: -10, c: 400, d: 800 };
    for (const heading of editor.querySelectorAll<HTMLElement>('[data-toc-id]')) {
      const id = heading.getAttribute('data-toc-id') ?? '';
      heading.getBoundingClientRect = () => rect(tops[id] ?? 0);
    }
    scroller.append(editor);
    const mountPoint = document.createElement('div');
    host.append(scroller, mountPoint);
    document.body.append(host);
    root = createRoot(mountPoint);
    await act(async () => {
      root.render(<EditorToc items={items} editorDom={editor} />);
    });

    const button = [...host.querySelectorAll<HTMLButtonElement>('[data-toc-item]')].find(
      (node) => node.getAttribute('data-toc-item') === 'd',
    );
    await act(async () => {
      button?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }),
      );
      button?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }),
      );
    });

    const current = () =>
      host
        .querySelector<HTMLButtonElement>('[data-toc-item][aria-current="true"]')
        ?.getAttribute('data-toc-item');
    expect(current()).toBe('d');

    await act(async () => {
      scroller.scrollTop = 40;
      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scrollend'));
      scroller.scrollTop = 180;
      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scrollend'));
    });
    expect(current()).toBe('d');
  });
});
