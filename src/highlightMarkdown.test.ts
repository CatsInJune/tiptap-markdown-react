/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { renderReportHtml } from './renderReportHtml';

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function marksOn(editor: Editor, text: string) {
  const found: { name: string; attrs: Record<string, unknown> }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.isText && node.text === text) {
      node.marks.forEach((m) =>
        found.push({ name: m.type.name, attrs: { ...m.attrs } }),
      );
    }
  });
  return found;
}

describe('彩色高亮与文字颜色一起往返', () => {
  it('红底黄字加粗斜体导出后，预览和服务端都保留两种颜色', () => {
    const text = 'gffgf';
    const editor = build(text);
    editor
      .chain()
      .selectAll()
      .setFontSize('24px')
      .setColor('#ffeb00')
      .toggleBold()
      .toggleItalic()
      .setHighlight({ color: '#ff0000' })
      .run();
    const md = editor.getMarkdown();
    expect(md).toContain('data-color="#ff0000"');
    expect(md).toContain('background-color:#ff0000');
    expect(md).toContain('color:#ffeb00');
    expect(md).not.toMatch(/==[^=]*gffgf/);
    editor.destroy();

    const again = build(md);
    const marks = marksOn(again, text);
    expect(marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'highlight',
          attrs: expect.objectContaining({ color: '#ff0000' }),
        }),
        expect.objectContaining({
          name: 'textStyle',
          attrs: expect.objectContaining({
            color: '#ffeb00',
            fontSize: '24px',
          }),
        }),
        expect.objectContaining({ name: 'bold' }),
        expect.objectContaining({ name: 'italic' }),
      ]),
    );
    again.destroy();

    const { html, ok } = renderReportHtml(md, { includeToc: false });
    expect(ok).toBe(true);
    expect(html).toContain('background-color: #ff0000');
    expect(html).toContain('color: #ffeb00');
    expect(html).toContain('font-size: 24px');
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain(text);
    expect(html).not.toContain('==');
  });

  it('没指定颜色的 ==高亮== 仍然是高亮', () => {
    const editor = build('==高亮==');
    const marks = marksOn(editor, '高亮');
    expect(marks.some((m) => m.name === 'highlight')).toBe(true);
    expect(editor.getMarkdown()).toContain('==高亮==');
    editor.destroy();
  });
});
