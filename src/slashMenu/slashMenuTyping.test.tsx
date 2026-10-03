/** @vitest-environment happy-dom */
import { Markdown } from '@tiptap/markdown';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { CitationRef } from '../CitationRef';
import { baseExtensions, pureChart, pureCodeBlock, pureImage } from '../extensions';
import { createDefaultSlashMenuItems } from './items';
import { insertSlashMarkdown } from './insertSlashMarkdown';
import type { SlashMenuItem } from './types';

/**
 * 复刻浏览器里的真实时序：逐字符键入（每个字符一条独立事务，对应
 * 真实键入/输入法路径），然后走 item.apply（删触发词 + 插入同链）。
 *
 * 语义钉子：触发词是用户刚键入的，命令的「删触发词 + 插入」与键入历史
 * 自然合并为**一个**历史事件（prosemirror-history 相邻变更合并）——
 * 一次 undo 回到「打 / 之前」的干净状态，而不是「插入物消失但 /表格
 * 文字复活」的两步尴尬。与飞书 / Notion 一致。
 */
function typeChar(editor: Editor, text: string): void {
  editor.commands.insertContentAt(editor.state.selection.from, text);
}

function setup() {
  const editor = new Editor({
    extensions: [
      ...baseExtensions,
      pureCodeBlock,
      pureImage,
      pureChart,
      CitationRef,
      Markdown,
    ],
    content: '<p></p>',
  });
  for (const ch of '/表格') typeChar(editor, ch);
  return editor;
}

/** 触发词「/表格」在文末：位置 docSize-3 .. docSize。 */
function triggerRange(editor: Editor) {
  const docSize = editor.state.doc.content.size;
  return { from: docSize - 3, to: docSize };
}

describe('逐字符键入后点击插入：撤销单步还原', () => {
  it('表格项（命令路径）', () => {
    const editor = setup();
    const items = createDefaultSlashMenuItems();
    const table = items.find((i) => i.id === 'table')!;
    table.apply(editor, triggerRange(editor));

    const md = editor.getMarkdown();
    expect(md).toContain('|');
    expect(md).not.toContain('/表格');

    editor.commands.undo();
    expect(editor.getMarkdown()).toBe('');
    // 历史合并成了一个事件：没有「二次撤销还剩 /表格」的残留
    expect(editor.can().undo()).toBe(false);
    editor.destroy();
  });

  it('宿主自定义 markdown 项（insertSlashMarkdown 路径）', () => {
    const editor = setup();
    const custom: SlashMenuItem = {
      id: 'host-item',
      title: 'Host item',
      aliases: ['zidingyi', '自定义'],
      apply: (e, range) => insertSlashMarkdown(e, range, '- 甲\n- 乙'),
    };
    custom.apply(editor, triggerRange(editor));

    const md = editor.getMarkdown();
    expect(md).toContain('- 甲');
    expect(md).not.toContain('/表格');

    editor.commands.undo();
    expect(editor.getMarkdown()).toBe('');
    expect(editor.can().undo()).toBe(false);
    editor.destroy();
  });
});
