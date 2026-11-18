/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';
import type { RenderCitation } from '../citationTypes';
import { MarkdownWysiwygEditor } from './MarkdownWysiwygEditor';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('MarkdownWysiwygEditor 渲染稳定性', () => {
  it('宿主重渲染（新的内联 renderCitation）不触发 editor.setOptions', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let editor: Editor | null = null;
    const render = (fn: RenderCitation) => (
      <MarkdownWysiwygEditor
        initialMarkdown={'正文[^1]'}
        documentTitle={false}
        renderCitation={fn}
        // 内联对象 / 数组每次都是新引用；初始化型配置不应因此重建扩展。
        imageResize={{ maxWidth: 500 }}
        extraExtensions={[]}
        onEditorReady={(next) => {
          if (next) editor = next;
        }}
      />
    );

    await act(async () => {
      root.render(render((ctx) => ctx.defaultDom));
    });
    expect(editor).not.toBeNull();

    const spy = vi.spyOn(editor!, 'setOptions');
    await act(async () => {
      root.render(render((ctx) => ctx.defaultDom));
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    act(() => root.unmount());
    host.remove();
  });
});
