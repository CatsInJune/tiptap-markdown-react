// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { insertMarkdown } from './insertMarkdown';

function build(content = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

describe('inline code marks coexist with bold', () => {
  it('parses **text (`code`) more** without RangeError', () => {
    const md =
      '**In this document all currency symbols are escaped (`\\$`), which renders correctly.**';
    const editor = build();
    expect(() => insertMarkdown(editor, md)).not.toThrow();

    let foundBoldCode = false;
    editor.state.doc.descendants((node) => {
      if (!node.isText) return;
      const names = node.marks.map((m) => m.type.name);
      if (names.includes('bold') && names.includes('code')) {
        foundBoldCode = true;
      }
    });
    expect(foundBoldCode).toBe(true);
    editor.destroy();
  });
});
