/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it } from 'vitest';
import type { RenderCitation } from '../citationTypes';
import { MarkdownPreview } from './MarkdownPreview';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('MarkdownPreview 渲染稳定性', () => {
  it('renderCitation 换成新的内联函数时不重建编辑器', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = (fn: RenderCitation) => (
      <MarkdownPreview markdown={'正文[^1]'} renderCitation={fn} />
    );

    await act(async () => {
      root.render(render((ctx) => ctx.defaultDom));
    });
    const before = host.querySelector('.ProseMirror');
    expect(before).not.toBeNull();

    // 宿主每次渲染传新的函数引用：扩展数组必须保持稳定，否则 useEditor 会销毁重建。
    await act(async () => {
      root.render(render((ctx) => ctx.defaultDom));
    });
    expect(host.querySelector('.ProseMirror')).toBe(before);

    act(() => root.unmount());
    host.remove();
  });
});
