/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import Typography from '@tiptap/extension-typography';
import { describe, expect, it } from 'vitest';
import { baseExtensions, pureCodeBlock } from './extensions';

/**
 * 输入规则只在 handleTextInput 上触发，insertContent 不会走。
 * 与 ProseMirror 一样：某个插件返回 true 就不再插入这个字符。
 */
function type(editor: Editor, text: string): void {
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (fn) =>
      fn(editor.view, from, to, char, () => editor.state.tr),
    );
    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  }
}

function build(): Editor {
  return new Editor({
    extensions: [...baseExtensions, pureCodeBlock, Typography, Markdown],
    content: '',
  });
}

function textOf(editor: Editor, typeName: string): string {
  const chunks: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === typeName && node.isTextblock) {
      chunks.push(node.textContent);
    }
    return true;
  });
  return chunks.join('\n');
}

describe('官方 Typography 智能标点', () => {
  it('直引号、省略号、双连字符在键入时替换', () => {
    const editor = build();
    type(editor, '"hi"');
    expect(editor.getMarkdown()).toBe('“hi”');
    editor.commands.setContent('');
    type(editor, '...');
    expect(editor.getMarkdown()).toBe('…');
    editor.commands.setContent('');
    type(editor, '--');
    expect(editor.getMarkdown()).toBe('—');
    editor.destroy();
  });

  it('代码块里的 -- 保持原样', () => {
    const editor = build();
    editor.commands.setContent('```\nx\n```', { contentType: 'markdown' });
    let pos = 1;
    editor.state.doc.descendants((node, nodePos) => {
      if (node.type.name === 'codeBlock') {
        pos = nodePos + node.nodeSize - 1;
        return false;
      }
      return true;
    });
    editor.commands.setTextSelection(pos);
    type(editor, '--');
    expect(textOf(editor, 'codeBlock')).toBe('x--');
    expect(editor.getMarkdown()).not.toContain('—');
    editor.destroy();
  });

  it('--- 仍然变成分隔线', () => {
    const editor = build();
    type(editor, '---');
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'horizontalRule') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
    expect(editor.getMarkdown()).toContain('---');
    editor.destroy();
  });
});
