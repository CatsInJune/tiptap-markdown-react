/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { renderReportHtml } from './renderReportHtml';

describe('下划线删除线的服务端嵌套', () => {
  it('和编辑器 DOM 的标记顺序一致', () => {
    const editor = new Editor({
      extensions: [...baseExtensions, Markdown],
      content: 'mmmmmm',
    });
    editor
      .chain()
      .selectAll()
      .setColor('#ff0000')
      .setHighlight({ color: '#ffeb00' })
      .toggleItalic()
      .toggleUnderline()
      .toggleStrike()
      .run();
    const md = editor.getMarkdown();
    const view = editor.getHTML();
    editor.destroy();
    const { html } = renderReportHtml(md, { includeToc: false });
    const inner = (value: string) =>
      value.replace(/\s+/g, '').replace(/;"/g, '"');
    expect(inner(html)).toContain(inner(view).replace(/^<p>/, '').replace(/<\/p>$/, ''));
  });

  it('上标加粗的嵌套和编辑器一致', () => {
    const editor = new Editor({
      extensions: [...baseExtensions, Markdown],
      content: 'x<sup>**2**</sup>',
      contentType: 'markdown',
    });
    const view = editor.getHTML();
    editor.destroy();
    const { html } = renderReportHtml('x<sup>**2**</sup>', { includeToc: false });
    const norm = (value: string) => value.replace(/\s+/g, '');
    expect(norm(html)).toBe(norm(view));
  });
});
