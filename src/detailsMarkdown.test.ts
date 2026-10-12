// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { renderReportHtml } from './renderReportHtml';

const OPEN = `<details open>
<summary>Title</summary>

Body with **bold**

</details>`;

const CLOSED = `<details>
<summary>Title</summary>

Body

</details>`;

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function nodeNames(editor: Editor): string[] {
  const names: string[] = [];
  editor.state.doc.descendants((node) => {
    names.push(node.type.name);
  });
  return names;
}

describe('折叠块 markdown 往返', () => {
  it('展开的 details 导入后可折叠，导出保持 HTML', () => {
    const editor = build(OPEN);
    expect(nodeNames(editor)).toEqual(
      expect.arrayContaining(['details', 'detailsSummary', 'detailsContent']),
    );
    const details = editor.state.doc.firstChild;
    expect(details?.type.name).toBe('details');
    expect(details?.attrs.open).toBe(true);
    expect(details?.textContent).toContain('Title');
    expect(details?.textContent).toContain('Body with bold');
    expect(editor.getMarkdown()).toBe(OPEN);
    editor.destroy();
  });

  it('没有 open 的 details 保持折叠', () => {
    const editor = build(CLOSED);
    expect(editor.state.doc.firstChild?.attrs.open).toBe(false);
    expect(editor.getMarkdown()).toBe(CLOSED);
    editor.destroy();
  });

  it('setDetails 包住当前块，默认展开，一步撤销还原', () => {
    const editor = build('Hello');
    editor.commands.setTextSelection(2);
    expect(editor.chain().focus().setDetails().run()).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('details');
    expect(editor.state.doc.firstChild?.attrs.open).toBe(true);
    expect(editor.getMarkdown()).toContain('<summary>');
    expect(editor.getMarkdown()).toContain('Hello');
    editor.commands.undo();
    expect(editor.getMarkdown()).toBe('Hello');
    editor.destroy();
  });

  it('光标在折叠块里时 unsetDetails 拆回普通段落', () => {
    const editor = build(OPEN);
    editor.commands.setTextSelection(3);
    expect(editor.chain().focus().unsetDetails().run()).toBe(true);
    expect(nodeNames(editor)).not.toContain('details');
    expect(editor.getMarkdown()).toContain('Title');
    expect(editor.getMarkdown()).toContain('Body with **bold**');
    editor.destroy();
  });

  it('阅读页静态 HTML 用原生 details，展开状态跟着 open', () => {
    const open = renderReportHtml(OPEN).html;
    expect(open).toContain('<details');
    expect(open).toContain('open');
    expect(open).toContain('<summary>Title</summary>');
    expect(open).toContain('data-type="detailsContent"');
    expect(open).toContain('<strong>bold</strong>');

    const closed = renderReportHtml(CLOSED).html;
    expect(closed).toContain('<details>');
    expect(closed).not.toMatch(/<details[^>]*\bopen\b/);
  });
});
