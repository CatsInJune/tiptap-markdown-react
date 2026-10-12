/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { afterEach, describe, expect, it } from 'vitest';
import {
  blockMarkdown,
  deleteBlock,
  duplicateBlock,
  resetBlockFormatting,
  turnBlockInto,
} from './actions';
import { baseExtensions, pureCodeBlock } from '../extensions';

function build(markdown: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, pureCodeBlock, Markdown],
    content: markdown,
    contentType: 'markdown',
  });
}

function findPos(editor: Editor, name: string, index = 0): number {
  let found = -1;
  let seen = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== name) return;
    if (seen === index) found = pos;
    seen += 1;
    return false;
  });
  return found;
}

describe('块拖拽菜单命令', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('段落转成标题，标题转回段落', () => {
    editor = build('Hello');
    expect(turnBlockInto(editor, 0, 'heading-2')).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2);
    expect(editor.getMarkdown()).toContain('## Hello');

    expect(turnBlockInto(editor, 0, 'paragraph')).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.getMarkdown().trim()).toBe('Hello');
  });

  it('段落转成无序列表，列表项再转回段落', () => {
    editor = build('Hello');
    expect(turnBlockInto(editor, 0, 'bulletList')).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('bulletList');

    const item = findPos(editor, 'listItem');
    expect(item).toBeGreaterThanOrEqual(0);
    expect(turnBlockInto(editor, item, 'paragraph')).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.getMarkdown().trim()).toBe('Hello');
  });

  it('代码块转成段落时保留文字', () => {
    editor = build('```\nconst n = 1\n```');
    const pos = findPos(editor, 'codeBlock');
    expect(turnBlockInto(editor, pos, 'paragraph')).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.state.doc.textContent).toContain('const n = 1');
  });

  it('复制一块插到它后面，撤销能收回', () => {
    editor = build('Alpha\n\nBeta');
    expect(duplicateBlock(editor, 0)).toBe(true);
    expect(editor.getMarkdown()).toBe('Alpha\n\nAlpha\n\nBeta');
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getMarkdown()).toBe('Alpha\n\nBeta');
  });

  it('删除中间块，只剩一块时换成空段落', () => {
    editor = build('Alpha\n\nBeta');
    const beta = findPos(editor, 'paragraph', 1);
    expect(deleteBlock(editor, beta)).toBe(true);
    expect(editor.getMarkdown().trim()).toBe('Alpha');

    expect(deleteBlock(editor, 0)).toBe(true);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.state.doc.textContent).toBe('');
  });

  it('列表只剩一项时连列表一起删', () => {
    editor = build('- only\n\nAfter');
    const item = findPos(editor, 'listItem');
    expect(deleteBlock(editor, item)).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).not.toBe('bulletList');
    expect(editor.getMarkdown()).toContain('After');
    expect(editor.getMarkdown()).not.toContain('only');
  });

  it('重置格式去掉加粗和对齐', () => {
    editor = build('Hello');
    editor
      .chain()
      .setTextSelection({ from: 1, to: 6 })
      .setBold()
      .setTextAlign('center')
      .run();
    expect(editor.getMarkdown()).toContain('**Hello**');
    expect(resetBlockFormatting(editor, 0)).toBe(true);
    expect(editor.getMarkdown()).not.toContain('**');
    expect(editor.state.doc.firstChild?.attrs.textAlign ?? null).toBeNull();
  });

  it('块 markdown 能单独序列化', () => {
    editor = build('Hello\n\nWorld');
    expect(blockMarkdown(editor, 0)?.trim()).toBe('Hello');
  });
});
