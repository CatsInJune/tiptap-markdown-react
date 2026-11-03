/** @vitest-environment happy-dom */
import type { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorProps,
} from '../components/MarkdownWysiwygEditor';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

const LEAD_ID = 'b_lead000001';
const SAMPLE = `<!--b:${LEAD_ID}-->\n\n## 标题\n\n正文`;

describe('MarkdownWysiwygEditor blockIds', () => {
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
          initialMarkdown={SAMPLE}
          onEditorReady={(e) => {
            editor = e;
          }}
          {...props}
        />,
      );
    });
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
  });

  it('默认 off：不生成块 ID，旧内容里的 ID 注释被剥掉', async () => {
    await mount();
    expect(editor?.getMarkdown()).not.toContain('<!--b:');
    expect(host.querySelector('[data-blockId]')).toBeNull();
    expect(host.textContent).toContain('标题');
    expect(host.textContent).toContain('正文');
  });

  it("blockIds='markdown'：ID 写进 markdown，DOM 带 data-blockId", async () => {
    await mount({ blockIds: 'markdown' });
    expect(editor?.getMarkdown()).toContain(`<!--b:${LEAD_ID}-->`);
    expect(
      host.querySelector(`[data-blockId="${LEAD_ID}"]`),
    ).not.toBeNull();
  });

  it("blockIds='memory'：DOM 有 ID，但 markdown 不写 ID", async () => {
    await mount({ blockIds: 'memory' });
    expect(editor?.getMarkdown()).not.toContain('<!--b:');
    expect(host.querySelector('[data-blockId]')).not.toBeNull();
  });
});
