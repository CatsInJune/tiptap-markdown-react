/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { renderReportHtml } from '../renderReportHtml';
import { baseExtensions, pureCodeBlock } from '../extensions';
import { filterEmojiItems } from './filterEmoji';
import { itemsInCategory } from './emojiCategories';

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function emojiNames(editor: Editor): string[] {
  const names: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'emoji') names.push(String(node.attrs.name));
    return true;
  });
  return names;
}

describe('Emoji markdown 往返', () => {
  it(':smile: 读入再导出仍是短码', () => {
    const editor = build(':smile:');
    expect(emojiNames(editor)).toEqual(['smile']);
    expect(editor.getMarkdown()).toBe(':smile:');
    editor.destroy();
  });

  it('未知短码保持原文', () => {
    const editor = build(':not_a_real_emoji_xyz:');
    expect(emojiNames(editor)).toEqual([]);
    expect(editor.getText()).toBe(':not_a_real_emoji_xyz:');
    editor.destroy();
  });

  it('正文里的 Unicode 表情收成节点并序列化成短码', () => {
    const editor = build('😀');
    expect(emojiNames(editor)).toEqual(['grinning']);
    expect(editor.getMarkdown()).toBe(':grinning:');
    editor.destroy();
  });

  it('行内代码和代码块里的表情保持原文', () => {
    const inline = build('`😀`');
    expect(emojiNames(inline)).toEqual([]);
    expect(inline.getMarkdown()).toBe('`😀`');
    inline.destroy();

    const block = new Editor({
      extensions: [...baseExtensions, pureCodeBlock, Markdown],
      content: '```\n😀\n```',
      contentType: 'markdown',
    });
    expect(emojiNames(block)).toEqual([]);
    expect(block.getMarkdown()).toContain('😀');
    expect(block.getMarkdown()).not.toContain(':grinning:');
    block.destroy();
  });

  it('服务端 HTML 把短码渲成表情字符', () => {
    const { html, ok } = renderReportHtml(':smile:', { includeToc: false });
    expect(ok).toBe(true);
    expect(html).toContain('data-name="smile"');
    expect(html).toContain('data-type="emoji"');
    expect(html).not.toContain(':smile:');
  });
});

describe('表情建议过滤', () => {
  it('空查询列出全部可用表情，短码前缀优先', () => {
    const editor = build('');
    const all = editor.storage.emoji.emojis;
    const usable = all.filter(
      (item: { emoji?: string; name: string; group?: string }) =>
        !!item.emoji &&
        !item.name.startsWith('regional_indicator_') &&
        item.group !== 'components',
    );
    const empty = filterEmojiItems(all, '');
    expect(empty).toHaveLength(usable.length);
    expect(empty.length).toBeGreaterThan(40);
    expect(itemsInCategory(empty, 'smileys')[0]?.name).toBe('grinning');
    expect(itemsInCategory(empty, 'food').some((item) => item.name === 'pizza')).toBe(
      true,
    );
    expect(itemsInCategory(empty, 'travel').some((item) => item.name === 'rocket')).toBe(
      true,
    );
    expect(itemsInCategory(empty, 'flags').length).toBeGreaterThan(0);
    expect(empty.some((item) => item.name.startsWith('regional_indicator_'))).toBe(
      false,
    );
    expect(empty.some((item) => item.name === 'tone1')).toBe(false);
    expect(filterEmojiItems(all, 'smi').some((item) => item.name === 'smile')).toBe(
      true,
    );
    expect(
      filterEmojiItems(all, 'r').some((item) =>
        item.name.startsWith('regional_indicator_'),
      ),
    ).toBe(false);
    expect(filterEmojiItems(all, 'not_a_real_emoji_xyz')).toEqual([]);
    editor.destroy();
  });
});
