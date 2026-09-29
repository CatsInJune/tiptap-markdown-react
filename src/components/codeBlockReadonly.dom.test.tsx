// @vitest-environment happy-dom
import { Markdown } from '@tiptap/markdown';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { baseExtensions, pureCodeBlock } from '../extensions';
import { CodeBlockView } from './CodeBlockView';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

/**
 * 复刻 MarkdownPreview 的接线（纯版代码块 + 只读 NodeView），
 * 验证只读态的头部 / 行号槽 / 复制交互。
 */
function PreviewHost({ markdown }: { markdown: string }) {
  const codeBlock = pureCodeBlock.extend({
    addNodeView: () => ReactNodeViewRenderer(CodeBlockView),
  });
  const editor = useEditor({
    extensions: [...baseExtensions, codeBlock, Markdown],
    content: markdown,
    contentType: 'markdown',
    editable: false,
    immediatelyRender: false,
  });
  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

describe('只读代码块 NodeView（MarkdownPreview 形态）', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mount = async (markdown: string) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<PreviewHost markdown={markdown} />);
    });
    // immediatelyRender:false → editor 在 effect 里创建，再 flush 一次让 NodeView 挂载
    await act(async () => {});
    return host;
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('头部带语言标签、复制钮与折叠钮（常驻）', async () => {
    const host = await mount('```json\n{"a": 1}\n```\n正文');
    expect(host.querySelector('[class*="langBadge"]')?.textContent).toContain(
      'JSON',
    );
    expect(
      host.querySelector<HTMLButtonElement>('button[aria-label="Copy code"]'),
    ).toBeTruthy();
    expect(
      host.querySelector<HTMLButtonElement>(
        'button[aria-label="Collapse code"]',
      ),
    ).toBeTruthy();
  });

  it('点折叠 → pre 隐藏且 wrapper 带 folded 类；再点展开恢复', async () => {
    const host = await mount('```json\n{"a": 1, "b": 2}\n```\n正文');
    const fold = () =>
      host.querySelector<HTMLButtonElement>(
        'button[aria-label="Collapse code"]',
      )!;
    const unfold = () =>
      host.querySelector<HTMLButtonElement>(
        'button[aria-label="Expand code"]',
      )!;

    await act(async () => {
      fold().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // 折叠语义 = pre 隐藏（css .folded .pre display:none；happy-dom 不应用样式表，
    // 这里断言类与按钮状态，视觉效果真机验证）
    expect(host.querySelector('[class*="folded"]')).toBeTruthy();
    expect(unfold()).toBeTruthy();

    await act(async () => {
      unfold().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[class*="folded"]')).toBeNull();
    expect(fold()).toBeTruthy();
  });

  it('行号槽数量与代码逻辑行一致（含末尾换行）', async () => {
    const host = await mount(
      '```json\n{\n  "a": 1,\n  "b": 2\n}\n```\n正文',
    );
    const gutterLines = host.querySelectorAll('[class*="gutterLine"]');
    expect(gutterLines.length).toBe(4);
    expect(gutterLines[0].textContent).toBe('1');
    expect(gutterLines[3].textContent).toBe('4');
  });

  it('复制按钮可用且不抛错（happy-dom 无 clipboard API，走 execCommand 兜底）', async () => {
    const host = await mount('```json\n{"a": 1}\n```');
    const btn = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy code"]',
    )!;
    await act(async () => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(btn.isConnected).toBe(true);
  });
});
