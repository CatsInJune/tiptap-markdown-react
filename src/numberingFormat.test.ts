// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import {
  NUMBERING_FORMAT_CSS,
  applyNumberingFormat,
  readCurrentNumberingFormat,
} from './numberingFormat';
import { renderReportHtml } from './renderReportHtml';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'styles/content.module.css'),
  'utf8',
);

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function formatsIn(editor: Editor): string[] {
  const found: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'orderedList') return;
    const format = node.attrs.numberingFormat;
    if (format) found.push(String(format));
  });
  return found;
}

describe('编号格式', () => {
  it('普通有序列表仍是原生 markdown，不带格式外壳', () => {
    const editor = build('1. 甲\n2. 乙');
    expect(formatsIn(editor)).toEqual([]);
    expect(editor.getMarkdown()).toBe('1. 甲\n2. 乙');
    expect(editor.getHTML()).not.toContain('data-numbering-format');
    editor.destroy();
  });

  it('从段落套上格式后，markdown 与 HTML 都记住 id，重解析不丢', () => {
    const editor = build('正文');
    editor.commands.setTextSelection(2);
    expect(applyNumberingFormat(editor, 'upper-alpha')).toBe(true);
    expect(readCurrentNumberingFormat(editor)).toBe('upper-alpha');

    const md = editor.getMarkdown();
    expect(md).toContain('<ol data-numbering-format="upper-alpha">');
    expect(md).toContain('正文');
    editor.destroy();

    const again = build(md);
    expect(formatsIn(again)).toEqual(['upper-alpha']);
    expect(again.getHTML()).toContain('data-numbering-format="upper-alpha"');
    expect(again.getMarkdown()).toBe(md);
    again.destroy();
  });

  it('已经在列表里时改的是最外层，嵌套层不单独带格式', () => {
    const editor = build('1. 甲\n   1. 乙\n2. 丙');
    let nested = 1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === '乙') {
        nested = pos + 1;
        return false;
      }
      return true;
    });
    editor.commands.setTextSelection(nested);
    expect(applyNumberingFormat(editor, 'decimal-nested')).toBe(true);
    expect(readCurrentNumberingFormat(editor)).toBe('decimal-nested');
    expect(formatsIn(editor)).toEqual(['decimal-nested']);
    expect(editor.getHTML().match(/data-numbering-format/g)).toHaveLength(1);
    editor.destroy();
  });

  it('列表项里的加粗穿过 HTML 外壳还在', () => {
    const editor = build('1. 甲');
    editor.commands.setTextSelection(4);
    applyNumberingFormat(editor, 'decimal');
    editor.commands.setTextSelection({ from: 3, to: 4 });
    editor.chain().focus().toggleBold().run();
    const md = editor.getMarkdown();
    expect(md).toContain('**甲**');
    editor.destroy();

    const again = build(md);
    expect(formatsIn(again)).toEqual(['decimal']);
    expect(again.getMarkdown()).toContain('**甲**');
    again.destroy();
  });

  it('SSR 渲染保留 data-numbering-format，阅读页能套上同一套计数器', () => {
    const editor = build('1. 甲');
    editor.commands.setTextSelection(3);
    applyNumberingFormat(editor, 'lower-roman');
    const { html, ok } = renderReportHtml(editor.getMarkdown());
    editor.destroy();
    expect(ok).toBe(true);
    expect(html).toContain('data-numbering-format="lower-roman"');
  });

  it('正文样式与生成器一致（改层级后两边一起变）', () => {
    const start = css.indexOf('/* numbering-format:start */');
    const end = css.indexOf('/* numbering-format:end */');
    expect(start).toBeGreaterThan(-1);
    const embedded = css.slice(start, end);
    expect(embedded).toContain(NUMBERING_FORMAT_CSS);
    expect(embedded).toContain('counter(tmr-decimal-1, lower-alpha) "."');
    expect(embedded).toContain(
      'counter(tmr-decimal-nested-0) "." counter(tmr-decimal-nested-1) "." counter(tmr-decimal-nested-2) "."',
    );
  });
});
