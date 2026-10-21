/** @vitest-environment happy-dom */
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

function fontSizeOf(editor: Editor): string | null {
  let size: string | null = null;
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    const mark = node.marks.find((item) => item.type.name === 'textStyle');
    if (mark?.attrs.fontSize) size = String(mark.attrs.fontSize);
  });
  return size;
}

describe('字号后再设标题', () => {
  it('整段 24px 后设成标题，字号让位，标题级别生效', () => {
    const editor = build('启示一');
    editor.chain().selectAll().setFontSize('24px').run();
    const ok = editor.chain().focus().toggleHeading({ level: 2 }).run();
    expect(ok).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2);
    expect(fontSizeOf(editor)).toBeNull();
    expect(editor.getMarkdown().trim()).toBe('## 启示一');
    editor.destroy();
  });

  it('光标停在 24px 正文里点标题，整段字号都会清掉', () => {
    const editor = build('启示一');
    editor.chain().selectAll().setFontSize('24px').run();
    editor.commands.setTextSelection(2);
    editor.chain().focus().setHeading({ level: 1 }).run();
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.state.doc.firstChild?.attrs.level).toBe(1);
    expect(fontSizeOf(editor)).toBeNull();
    editor.destroy();
  });

  it('先前加粗再设标题，加粗让位，标题字重生效', () => {
    const editor = build('启示一');
    editor.chain().selectAll().toggleBold().run();
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2);
    let bold = false;
    editor.state.doc.descendants((node) => {
      if (node.isText && node.marks.some((item) => item.type.name === 'bold')) {
        bold = true;
      }
    });
    expect(bold).toBe(false);
    expect(editor.getMarkdown().trim()).toBe('## 启示一');
    editor.destroy();
  });

  it('24px 加粗一起设成标题，两样都清掉', () => {
    const editor = build('启示一');
    editor.chain().selectAll().setFontSize('24px').toggleBold().run();
    editor.commands.setTextSelection(2);
    editor.chain().focus().setHeading({ level: 1 }).run();
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(fontSizeOf(editor)).toBeNull();
    expect(editor.getMarkdown().trim()).toBe('# 启示一');
    editor.destroy();
  });

  it('设标题时保留文字颜色', () => {
    const editor = build('启示一');
    editor.chain().selectAll().setFontSize('24px').setColor('#ff0000').run();
    editor.chain().focus().toggleHeading({ level: 3 }).run();
    let color: string | null = null;
    editor.state.doc.descendants((node) => {
      if (!node.isText) return;
      const mark = node.marks.find((item) => item.type.name === 'textStyle');
      if (mark?.attrs.color) color = String(mark.attrs.color);
    });
    expect(color).toBe('#ff0000');
    expect(fontSizeOf(editor)).toBeNull();
    editor.destroy();
  });
});
