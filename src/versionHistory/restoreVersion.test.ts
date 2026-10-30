// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from '../extensions';
import { isSameVersionMarkdown, restoreVersionMarkdown } from './restoreVersion';

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

describe('restoreVersionMarkdown', () => {
  it('写回所选版本，撤销一次回到打过字的正文', () => {
    const editor = build('hello');
    editor.commands.insertContent('!');
    const typed = editor.getMarkdown();
    expect(typed).not.toContain('restored');

    restoreVersionMarkdown(editor, 'restored');
    expect(editor.getMarkdown()).toContain('restored');
    expect(editor.getMarkdown()).not.toContain('hello!');

    editor.commands.undo();
    expect(editor.getMarkdown()).toBe(typed);
    editor.destroy();
  });

  it('编辑器多吐出的尾部空行仍视为同一版', () => {
    const stored = '# 季度纪要\n\n营收保持增长。\n\n- 渠道\n- 产品\n';
    const live = '# 季度纪要\n\n营收保持增长。\n\n- 渠道\n- 产品\n\n';
    expect(isSameVersionMarkdown(live, stored)).toBe(true);
    expect(isSameVersionMarkdown(live, '# 季度纪要\n\n营收下降。\n')).toBe(false);
  });
});
