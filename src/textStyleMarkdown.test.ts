// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

describe('颜色/字号 markdown 往返', () => {
  it('setColor 后 getMarkdown 保留为行内 HTML，重解析后颜色 mark 恢复', () => {
    const editor = build('abcdef');
    editor.chain().selectAll().setColor('#ff0000').run();
    const md = editor.getMarkdown();
    expect(md).toContain('style="color:#ff0000"');
    editor.destroy();

    const reparsed = build(md);
    expect(reparsed.getMarkdown()).toContain('style="color:#ff0000"');
    let hasColor = false;
    reparsed.state.doc.descendants((node) => {
      if (
        node.isText &&
        node.marks.some(
          (m) => m.type.name === 'textStyle' && m.attrs.color === '#ff0000',
        )
      ) {
        hasColor = true;
        return false;
      }
      return true;
    });
    expect(hasColor).toBe(true);
    reparsed.destroy();
  });

  it('setFontSize 后 getMarkdown 保留字号，重解析后恢复', () => {
    const editor = build('字号测试');
    editor.chain().selectAll().setFontSize('18px').run();
    const md = editor.getMarkdown();
    expect(md).toContain('style="font-size:18px"');
    editor.destroy();

    const reparsed = build(md);
    expect(reparsed.getMarkdown()).toContain('style="font-size:18px"');
    let hasSize = false;
    reparsed.state.doc.descendants((node) => {
      if (
        node.isText &&
        node.marks.some(
          (m) => m.type.name === 'textStyle' && m.attrs.fontSize === '18px',
        )
      ) {
        hasSize = true;
        return false;
      }
      return true;
    });
    expect(hasSize).toBe(true);
    reparsed.destroy();
  });
});
