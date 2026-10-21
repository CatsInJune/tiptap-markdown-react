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

  it('字号 + 加粗一起导出后，重解析恢复两种 mark，正文不留下星号', () => {
    const text = '启示一：IP的价值不在产品，而在意义';
    const editor = build(text);
    editor.chain().selectAll().setFontSize('24px').toggleBold().run();
    const md = editor.getMarkdown();
    expect(md).toContain('style="font-size:24px"');
    expect(md).toContain(`**${text}**`);
    editor.destroy();

    const reparsed = build(md);
    expect(reparsed.getText()).toBe(text);
    let marks: string[] = [];
    let fontSize: string | null = null;
    reparsed.state.doc.descendants((node) => {
      if (node.isText && node.text === text) {
        marks = node.marks.map((m) => m.type.name);
        const style = node.marks.find((m) => m.type.name === 'textStyle');
        fontSize = (style?.attrs.fontSize as string) ?? null;
      }
      return true;
    });
    expect(marks).toContain('bold');
    expect(marks).toContain('textStyle');
    expect(fontSize).toBe('24px');
    // 客户端编辑器 / 预览走同一套解析，DOM 里应是 strong，不能留下星号。
    expect(reparsed.getHTML()).toContain(
      `<span style="font-size: 24px;"><strong>${text}</strong></span>`,
    );
    expect(reparsed.getHTML()).not.toContain('**');
    expect(reparsed.getMarkdown()).toContain(`**${text}**`);
    reparsed.destroy();
  });
});
