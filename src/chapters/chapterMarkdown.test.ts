import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { describe, expect, it, vi } from 'vitest';
import { serializeChapterMarkdown } from './chapterMarkdown';

function block(json: Record<string, unknown>): PMNode {
  return { toJSON: () => json } as unknown as PMNode;
}

describe('serializeChapterMarkdown', () => {
  it('把一章顶层块交给编辑器的 markdown manager 序列化', () => {
    const serialize = vi.fn().mockReturnValue('<!--b:b_a-->\n## 甲');
    const editor = { markdown: { serialize } } as unknown as Editor;

    expect(
      serializeChapterMarkdown(editor, [block({ type: 'heading', content: [] })]),
    ).toBe('<!--b:b_a-->\n## 甲');
    expect(serialize).toHaveBeenCalledWith({
      type: 'doc',
      content: [{ type: 'heading', content: [] }],
    });
  });

  it('空章返回空串，不调用序列化', () => {
    const serialize = vi.fn();
    const editor = { markdown: { serialize } } as unknown as Editor;
    expect(serializeChapterMarkdown(editor, [])).toBe('');
    expect(serialize).not.toHaveBeenCalled();
  });

  it('编辑器未挂 markdown manager 时返回空串', () => {
    expect(
      serializeChapterMarkdown({} as Editor, [block({ type: 'paragraph' })]),
    ).toBe('');
  });
});
