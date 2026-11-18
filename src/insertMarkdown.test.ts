// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { insertMarkdown, splitTopLevelBlocks } from './insertMarkdown';

function build(content = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

describe('insertMarkdown fallback', () => {
  it('keeps valid blocks when a nested-bold block cannot parse', () => {
    const editor = build();
    expect(() =>
      insertMarkdown(
        editor,
        ['hello', '**(**一**)** 现任董事', 'world'].join('\n\n'),
      ),
    ).not.toThrow();
    const text = editor.state.doc.textContent;
    expect(text).toContain('hello');
    expect(text).toContain('world');
    expect(text).toMatch(/一/);
    expect(text).toMatch(/现任/);
    editor.destroy();
  });

  it('a single invalid snippet still inserts as plain text', () => {
    const editor = build();
    expect(() => insertMarkdown(editor, '**(**一**)** 现任\n')).not.toThrow();
    expect(editor.state.doc.textContent).toMatch(/一/);
    editor.destroy();
  });
});

describe('splitTopLevelBlocks', () => {
  it('protects tilde fences and their blank lines', () => {
    const blocks = splitTopLevelBlocks(
      ['a', '', '~~~js', 'b', '', 'c', '~~~', '', 'd'].join('\n'),
    );
    expect(blocks).toEqual(['a', '~~~js\nb\n\nc\n~~~', 'd']);
  });

  it('protected fences of four backticks can contain ```', () => {
    const blocks = splitTopLevelBlocks(
      ['````md', '```', 'inner', '```', '````', '', 'tail'].join('\n'),
    );
    expect(blocks).toEqual(['````md\n```\ninner\n```\n````', 'tail']);
  });
});
