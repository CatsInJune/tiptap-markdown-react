// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';

/**
 * 上标 / 下标没有 markdown 原生语法，导出为行内 HTML `<sup>` / `<sub>`。
 * 之前这两个 mark 没有 renderMarkdown，getMarkdown() 会把格式静默丢掉
 * （保存后 x² / x₂ 变回 x2）。
 */
function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

/** 文档里是否存在带指定 mark 的文本节点。 */
function hasMark(editor: Editor, name: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === name)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

/** 指定文本上挂着的 mark 名（重复出现取并集）。 */
function marksOn(editor: Editor, text: string): string[] {
  const names = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.isText && node.text === text) {
      node.marks.forEach((m) => names.add(m.type.name));
    }
    return true;
  });
  return [...names];
}

describe('上标/下标 markdown 往返', () => {
  it('toggleSuperscript 后导出 <sup>，重解析恢复 mark', () => {
    const editor = build('x2');
    editor
      .chain()
      .setTextSelection({ from: 2, to: 3 })
      .toggleSuperscript()
      .run();
    const md = editor.getMarkdown();
    expect(md).toBe('x<sup>2</sup>');
    editor.destroy();

    const reparsed = build(md);
    expect(hasMark(reparsed, 'superscript')).toBe(true);
    expect(reparsed.getMarkdown()).toBe('x<sup>2</sup>');
    reparsed.destroy();
  });

  it('toggleSubscript 后导出 <sub>，重解析恢复 mark', () => {
    const editor = build('x2');
    editor
      .chain()
      .setTextSelection({ from: 2, to: 3 })
      .toggleSubscript()
      .run();
    const md = editor.getMarkdown();
    expect(md).toBe('x<sub>2</sub>');
    editor.destroy();

    const reparsed = build(md);
    expect(hasMark(reparsed, 'subscript')).toBe(true);
    expect(reparsed.getMarkdown()).toBe('x<sub>2</sub>');
    reparsed.destroy();
  });

  it('markdown 里的 <sup>/<sub> 导入即成 mark，导出原样保留', () => {
    const editor = build('H<sub>2</sub>O 与 x<sup>2</sup>');
    expect(hasMark(editor, 'subscript')).toBe(true);
    expect(hasMark(editor, 'superscript')).toBe(true);
    expect(editor.getMarkdown()).toBe('H<sub>2</sub>O 与 x<sup>2</sup>');
    editor.destroy();
  });

  it('与加粗共存时两种 mark 都不丢', () => {
    const editor = build('**x<sup>2</sup>**');
    expect(marksOn(editor, '2')).toEqual(
      expect.arrayContaining(['bold', 'superscript']),
    );

    const md = editor.getMarkdown();
    expect(md).toContain('<sup>2</sup>');
    editor.destroy();

    const reparsed = build(md);
    expect(marksOn(reparsed, '2')).toEqual(
      expect.arrayContaining(['bold', 'superscript']),
    );
    reparsed.destroy();
  });
});
