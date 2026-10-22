/** @vitest-environment happy-dom */
import { Editor, type AnyExtension } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import type { Node as PMNode } from '@tiptap/pm/model';
import { afterEach, describe, expect, it } from 'vitest';
import { CommentMark } from './commentAnchor/CommentMark';
import { baseExtensions, pureCodeBlock } from './extensions';
import {
  applyCapturedFormat,
  captureFormat,
  clearFormatting,
} from './formatBrush';

function build(markdown: string, extra: AnyExtension[] = []): Editor {
  return new Editor({
    extensions: [...baseExtensions, ...extra, Markdown],
    content: markdown,
    contentType: 'markdown',
  });
}

function findText(editor: Editor, text: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;
    const index = node.text.indexOf(text);
    if (index >= 0) {
      found = { from: pos + index, to: pos + index + text.length };
    }
  });
  if (!found) throw new Error(`missing text: ${text}`);
  return found;
}

function selectText(editor: Editor, text: string): void {
  const range = findText(editor, text);
  editor.commands.setTextSelection(range);
}

function placeCaret(editor: Editor, text: string): void {
  const range = findText(editor, text);
  editor.commands.setTextSelection(range.from + 1);
}

function marksOn(editor: Editor, text: string): string[] {
  const range = findText(editor, text);
  const node = editor.state.doc.nodeAt(range.from);
  return node?.isText ? node.marks.map((mark) => mark.type.name) : [];
}

function textblock(editor: Editor, text: string): PMNode {
  const range = findText(editor, text);
  return editor.state.doc.resolve(range.from).parent;
}

describe('清除格式', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('卸掉选区里的行内排版，留下链接', () => {
    editor = build('[**a**](https://example.com) *b*');
    selectText(editor, 'a');
    expect(clearFormatting(editor)).toBe(true);
    expect(marksOn(editor, 'a')).not.toContain('bold');
    expect(marksOn(editor, 'a')).toContain('link');
    selectText(editor, 'b');
    expect(marksOn(editor, 'b')).toContain('italic');
  });

  it('半段选区不把标题降成正文', () => {
    editor = build('# **Hello** world');
    selectText(editor, 'Hello');
    clearFormatting(editor);
    expect(textblock(editor, 'Hello').type.name).toBe('heading');
    expect(marksOn(editor, 'Hello')).not.toContain('bold');
    expect(editor.getMarkdown()).toContain('# ');
  });

  it('光标在标题里时，整段降成正文并清掉对齐、缩进、行高', () => {
    editor = build('# Hello');
    placeCaret(editor, 'Hello');
    editor.chain().setTextAlign('center').setIndent(1).setLineHeight(2).run();
    expect(clearFormatting(editor)).toBe(true);
    const block = textblock(editor, 'Hello');
    expect(block.type.name).toBe('paragraph');
    expect(block.attrs.textAlign).toBeNull();
    expect(block.attrs.indent).toBeNull();
    expect(block.attrs.lineHeight).toBeNull();
    expect(editor.getMarkdown()).not.toContain('# ');
    expect(editor.getMarkdown()).not.toContain('text-align');
  });

  it('不拆列表、引用和代码块', () => {
    editor = build('- **item**\n\n> **quote**\n\n```\nconst a = 1\n```', [
      pureCodeBlock,
    ]);
    const topLevel = () => {
      const names: string[] = [];
      editor!.state.doc.forEach((node) => names.push(node.type.name));
      return names;
    };
    const before = topLevel();
    placeCaret(editor, 'item');
    clearFormatting(editor);
    selectText(editor, 'quote');
    clearFormatting(editor);
    editor.commands.selectAll();
    clearFormatting(editor);

    // 文档以代码块结尾时，官方 TrailingNode 会在这次编辑后补一个空段落。
    // 列表 / 引用 / 代码块本身还在。
    expect(topLevel().filter((name) => name !== 'paragraph')).toEqual(
      before.filter((name) => name !== 'paragraph'),
    );
    expect(marksOn(editor, 'item')).not.toContain('bold');
    expect(marksOn(editor, 'quote')).not.toContain('bold');
    expect(editor.getMarkdown()).toContain('const a = 1');
  });

  it('官方 unsetAllMarks 保留评论锚点，清除格式也不卸它', () => {
    editor = build('**hello**', [CommentMark]);
    const hello = findText(editor, 'hello');
    editor
      .chain()
      .applyCommentAnchors([{ from: hello.from, to: hello.to, commentIds: ['c1'] }])
      .run();
    selectText(editor, 'hello');
    editor.commands.unsetAllMarks();
    expect(marksOn(editor, 'hello')).toContain('commentAnchor');
    expect(marksOn(editor, 'hello')).not.toContain('bold');

    editor.chain().focus().toggleBold().run();
    expect(marksOn(editor, 'hello')).toContain('bold');
    clearFormatting(editor);
    expect(marksOn(editor, 'hello')).toContain('commentAnchor');
    expect(marksOn(editor, 'hello')).not.toContain('bold');
  });
});

describe('格式刷', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('半段取样只复制行内 mark，不改目标的块类型', () => {
    editor = build('# **src** word\n\nhello world');
    selectText(editor, 'src');
    editor.chain().setColor('#ff0000').setFontSize('18px').run();
    const sample = captureFormat(editor);
    expect(sample?.block).toBeNull();
    expect(sample?.marks.map((mark) => mark.type).sort()).toEqual([
      'bold',
      'textStyle',
    ]);

    selectText(editor, 'hello');
    expect(applyCapturedFormat(editor, sample!)).toBe(true);
    expect(textblock(editor, 'hello').type.name).toBe('paragraph');
    expect(marksOn(editor, 'hello')).toEqual(
      expect.arrayContaining(['bold', 'textStyle']),
    );
    expect(marksOn(editor, 'world')).not.toContain('bold');
    const style = editor.state.doc
      .nodeAt(findText(editor, 'hello').from)
      ?.marks.find((mark) => mark.type.name === 'textStyle');
    expect(style?.attrs.color).toBe('#ff0000');
    expect(style?.attrs.fontSize).toBe('18px');
  });

  it('整段取样会把目标整段刷成同样的标题，并替换掉原来的斜体', () => {
    editor = build('# **src**\n\n*dst*');
    selectText(editor, 'src');
    const sample = captureFormat(editor);
    expect(sample?.block).toMatchObject({ type: 'heading', level: 1 });

    selectText(editor, 'dst');
    applyCapturedFormat(editor, sample!);
    expect(textblock(editor, 'dst').type.name).toBe('heading');
    expect(marksOn(editor, 'dst')).toContain('bold');
    expect(marksOn(editor, 'dst')).not.toContain('italic');
  });

  it('不复制链接；刷到列表项时不把列表拆掉', () => {
    editor = build('[**src**](https://example.com)\n\n- dst');
    selectText(editor, 'src');
    const sample = captureFormat(editor);
    expect(sample?.marks.map((mark) => mark.type)).not.toContain('link');

    selectText(editor, 'dst');
    applyCapturedFormat(editor, sample!);
    expect(marksOn(editor, 'dst')).toContain('bold');
    expect(marksOn(editor, 'dst')).not.toContain('link');
    expect(marksOn(editor, 'src')).toContain('link');
    expect(editor.state.doc.child(1).type.name).toBe('bulletList');
  });

  it('光标落点只改块级，正文里已有的字保持原样，接着打的字带上取样', () => {
    editor = build('# **src**\n\nplain');
    selectText(editor, 'src');
    const sample = captureFormat(editor);
    placeCaret(editor, 'plain');
    applyCapturedFormat(editor, sample!);
    expect(textblock(editor, 'plain').type.name).toBe('heading');
    expect(marksOn(editor, 'plain')).not.toContain('bold');
    editor.commands.insertContent('X');
    expect(marksOn(editor, 'X')).toContain('bold');
  });

  it('代码块里取不到样', () => {
    editor = build('```\nconst a = 1\n```', [pureCodeBlock]);
    editor.commands.setTextSelection(2);
    expect(captureFormat(editor)).toBeNull();
    expect(clearFormatting(editor)).toBe(false);
  });
});
