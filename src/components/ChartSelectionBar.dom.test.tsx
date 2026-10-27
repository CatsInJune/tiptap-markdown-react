/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MarkdownWysiwygEditor } from './MarkdownWysiwygEditor';
import type { Editor } from '@tiptap/core';

const sample = `<!-- {"chartType":"column","x":"分部","y":"收入","colorLegend":"财年","title":"分部收入"} -->

| 分部 | 财年 | 收入 |
| --- | --- | --- |
| 安踏 | FY2024 | 335.2 |
`;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
  ) {
    const canvas = this;
    return new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'canvas') return canvas;
          if (prop === 'measureText') return () => ({ width: 10 });
          return () => undefined;
        },
        set: () => true,
      },
    );
  } as HTMLCanvasElement['getContext'];
});

describe('选中图表的操作条', () => {
  let host: HTMLDivElement;
  let root: Root | undefined;
  const box: { editor: Editor | null } = { editor: null };

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
  });

  it('选中后能换图型，饼图在有系列时不可用，并能还原成表', async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    box.editor = null;
    await act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown={sample}
          locale="zh"
          documentTitle={false}
          onEditorReady={(next) => {
            box.editor = next;
          }}
        />,
      );
    });
    const editor = box.editor;
    if (!editor) throw new Error('editor not ready');
    let pos = -1;
    editor.state.doc.descendants((node, at) => {
      if (node.type.name === 'chart') {
        pos = at;
        return false;
      }
      return true;
    });
    await act(async () => {
      editor.commands.setNodeSelection(pos);
    });

    const bar = host.querySelector('[data-chart-toolbar]');
    expect(bar?.textContent).toContain('柱状图');
    expect(bar?.textContent).toContain('还原成表格');

    const trigger = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '柱状图',
    );
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const pie = host.querySelector('[role="menuitem"][aria-disabled="true"]');
    expect(pie?.textContent).toBe('饼图');
    const line = [...host.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === '折线图',
    );
    await act(async () => {
      line?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(editor.state.doc.nodeAt(pos)?.attrs.config[0].chartType).toBe('line');

    const toTable = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '还原成表格',
    );
    await act(async () => {
      toTable?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(editor.state.doc.child(0).type.name).toBe('table');
  });
});
