/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { NodeRangeSelection } from '@tiptap/extension-node-range';
import { dropPoint } from '@tiptap/pm/transform';
import { afterEach, describe, expect, it } from 'vitest';
import { baseExtensions, pureCodeBlock } from '../extensions';
import { isPosInsideList, listEscapePos, moveDraggedSlice } from './listDrop';

function build(markdown: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, pureCodeBlock, Markdown],
    content: markdown,
    contentType: 'markdown',
  });
}

function textPos(editor: Editor, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText || node.text !== text) return;
    found = pos;
    return false;
  });
  return found;
}

function topLevel(editor: Editor): string[] {
  const names: string[] = [];
  editor.state.doc.forEach((node) => {
    names.push(`${node.type.name}:${node.textContent}`);
  });
  return names;
}

describe('块拖拽不掉进列表', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('列表内部的位置抬到最外层列表的前后，列表外的位置不动', () => {
    editor = build('Hello\n\n- One\n- Two\n\nTail');
    const inside = textPos(editor, 'One');
    expect(inside).toBeGreaterThan(0);
    expect(isPosInsideList(editor.state.doc, inside)).toBe(true);

    const list = editor.state.doc.child(1);
    expect(list.type.name).toBe('bulletList');
    const listStart = editor.state.doc.child(0).nodeSize;
    expect(listEscapePos(editor.state.doc, inside, false)).toBe(listStart);
    expect(listEscapePos(editor.state.doc, inside, true)).toBe(
      listStart + list.nodeSize,
    );

    const hello = textPos(editor, 'Hello');
    expect(isPosInsideList(editor.state.doc, hello)).toBe(false);
    expect(listEscapePos(editor.state.doc, hello, true)).toBeNull();
  });

  it('单行段落的默认落点在列表里，改放到整份列表后面后仍是同级段落', () => {
    editor = build('Hello\n\n- One\n- Two\n\nTail');
    const paragraph = editor.state.doc.child(0);
    const selection = NodeRangeSelection.create(
      editor.state.doc,
      0,
      paragraph.nodeSize,
    );
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    const slice = editor.state.selection.content();
    const inside = textPos(editor, 'Two');
    const natural = dropPoint(editor.state.doc, inside, slice);
    expect(natural).not.toBeNull();
    expect(isPosInsideList(editor.state.doc, natural ?? inside)).toBe(true);

    const edge = listEscapePos(editor.state.doc, inside, true);
    expect(edge).not.toBeNull();
    expect(moveDraggedSlice(editor.view, slice, edge ?? 0)).toBe(true);
    expect(topLevel(editor)).toEqual([
      'bulletList:OneTwo',
      'paragraph:Hello',
      'paragraph:Tail',
    ]);
    expect(editor.state.doc.child(0).childCount).toBe(2);
  });

  it('标题落到列表上半段时停在列表前面，不会变成条目', () => {
    editor = build('- One\n- Two\n\n# Title');
    const heading = editor.state.doc.child(1);
    expect(heading.type.name).toBe('heading');
    const headingPos = editor.state.doc.child(0).nodeSize;
    const selection = NodeRangeSelection.create(
      editor.state.doc,
      headingPos,
      headingPos + heading.nodeSize,
    );
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    const slice = editor.state.selection.content();
    const inside = textPos(editor, 'One');
    const edge = listEscapePos(editor.state.doc, inside, false);
    expect(edge).toBe(0);
    expect(moveDraggedSlice(editor.view, slice, edge ?? 0)).toBe(true);
    const kinds = topLevel(editor).filter((block) => block !== 'paragraph:');
    expect(kinds).toEqual(['heading:Title', 'bulletList:OneTwo']);
    editor.state.doc.forEach((node) => {
      if (node.type.name !== 'bulletList') return;
      expect(node.textContent).toBe('OneTwo');
    });
  });
});
