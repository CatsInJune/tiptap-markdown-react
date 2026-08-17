// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { insertMarkdown } from './insertMarkdown';
import {
  renderMathElementHtml,
  renderMathHtml,
  subscribeMathClick,
} from './math';
import { renderReportHtml } from './renderReportHtml';

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function findNodes(
  editor: Editor,
  name: string,
): { latex: string }[] {
  const found: { latex: string }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === name) {
      found.push({ latex: String(node.attrs.latex ?? '') });
    }
  });
  return found;
}

describe('math markdown', () => {
  it('parses single-line $$x^2$$ as inline math', () => {
    const editor = build('hello $$x^2$$ world');
    expect(findNodes(editor, 'inlineMath')).toEqual([{ latex: 'x^2' }]);
    expect(findNodes(editor, 'blockMath')).toEqual([]);
    expect(editor.getMarkdown()).toContain('$$x^2$$');
    editor.destroy();
  });

  it('parses newline-wrapped $$ as block math', () => {
    const editor = build('$$\n\\frac{a}{b}\n$$');
    expect(findNodes(editor, 'blockMath')).toEqual([{ latex: '\\frac{a}{b}' }]);
    expect(findNodes(editor, 'inlineMath')).toEqual([]);
    const md = editor.getMarkdown();
    expect(md).toMatch(/\$\$\n\\frac\{a\}\{b\}\n\$\$/);
    editor.destroy();
  });

  it('keeps a lone $$x$$ paragraph as inline, not block', () => {
    const editor = build('$$E=mc^2$$');
    expect(findNodes(editor, 'inlineMath')).toEqual([{ latex: 'E=mc^2' }]);
    expect(findNodes(editor, 'blockMath')).toEqual([]);
    editor.destroy();
  });

  it('parses two inline formulas in one paragraph', () => {
    const editor = build('$$a$$ and $$b$$');
    expect(findNodes(editor, 'inlineMath')).toEqual([
      { latex: 'a' },
      { latex: 'b' },
    ]);
    editor.destroy();
  });

  it('does not treat dollar amounts as math', () => {
    const samples = [
      '营收 $24.4B，同比上升',
      'US$1.2 billion',
      '$24.4B$',
      '$\\text{x}$',
      'from $12.4B$ to $18.0B[^3]',
    ];
    for (const sample of samples) {
      const editor = build(sample);
      expect(findNodes(editor, 'inlineMath')).toEqual([]);
      expect(findNodes(editor, 'blockMath')).toEqual([]);
      expect(editor.getMarkdown()).toContain('$');
      editor.destroy();
    }
  });

  it('keeps amounts as text next to a real inline formula', () => {
    const editor = build('营收 $24.4B，对应 $$R = P \\times Q$$');
    expect(findNodes(editor, 'inlineMath')).toEqual([
      { latex: 'R = P \\times Q' },
    ]);
    expect(editor.getMarkdown()).toContain('$24.4B');
    editor.destroy();
  });

  it('round-trips toolbar-inserted inline and block math', () => {
    const editor = build('before after');
    editor.commands.insertInlineMath({ latex: 'E=mc^2' });
    expect(findNodes(editor, 'inlineMath')).toEqual([{ latex: 'E=mc^2' }]);
    const inlineMd = editor.getMarkdown();
    expect(inlineMd).toContain('$$E=mc^2$$');
    editor.destroy();

    const reparsedInline = build(inlineMd);
    expect(findNodes(reparsedInline, 'inlineMath')).toEqual([
      { latex: 'E=mc^2' },
    ]);
    reparsedInline.destroy();

    const blockEditor = build('intro');
    blockEditor.commands.insertBlockMath({ latex: '\\sum x' });
    expect(findNodes(blockEditor, 'blockMath')).toEqual([{ latex: '\\sum x' }]);
    const blockMd = blockEditor.getMarkdown();
    expect(blockMd).toMatch(/\$\$\n\\sum x\n\$\$/);
    blockEditor.destroy();

    const reparsedBlock = build(blockMd);
    expect(findNodes(reparsedBlock, 'blockMath')).toEqual([
      { latex: '\\sum x' },
    ]);
    reparsedBlock.destroy();
  });

  it('insertMarkdown parses $$ as math', () => {
    const editor = build('start');
    insertMarkdown(editor, ' see $$a+b$$');
    expect(findNodes(editor, 'inlineMath')).toEqual([{ latex: 'a+b' }]);
    editor.destroy();
  });

  it('inserting $$ as plain text does not create a math node', () => {
    const editor = build('hello');
    editor
      .chain()
      .insertContent({
        type: 'paragraph',
        content: [{ type: 'text', text: '$$x^2$$' }],
      })
      .run();
    expect(findNodes(editor, 'inlineMath')).toEqual([]);
    expect(editor.getMarkdown()).toContain('$$x^2$$');
    editor.destroy();
  });
});

describe('math SSR', () => {
  it('renderReportHtml emits katex markup for inline and block math', () => {
    const inline = renderReportHtml('hello $$x^2$$ world');
    expect(inline.html).toContain('katex');
    expect(inline.html).toContain('data-type="inline-math"');

    const block = renderReportHtml('$$\n\\frac{a}{b}\n$$');
    expect(block.html).toContain('katex');
    expect(block.html).toContain('data-type="block-math"');
  });

  it('leaves dollar amounts as text in SSR', () => {
    const { html } = renderReportHtml('营收 $24.4B$ 与 US$1.2');
    expect(html).not.toContain('data-type="inline-math"');
    expect(html).not.toContain('data-type="block-math"');
    expect(html).toContain('$24.4B$');
  });

  it('escapes quotes in data-latex and does not throw on bad latex', () => {
    expect(renderMathElementHtml('a"b', false)).toContain('data-latex="a&quot;b"');
    expect(() => renderMathHtml('\\notacommand{', false)).not.toThrow();
    const { html } = renderReportHtml('$$\\notacommand{$$');
    expect(html).toContain('data-type="inline-math"');
  });
});

describe('subscribeMathClick', () => {
  it('delivers payload and unsubscribes', () => {
    const received: { kind: string; latex: string }[] = [];
    const unsub = subscribeMathClick((payload) => {
      received.push({ kind: payload.kind, latex: payload.latex });
    });
    unsub();
    expect(received).toEqual([]);
  });
});
