// @vitest-environment happy-dom
import { Editor, Extension } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import {
  baseExtensions,
  blockIdBackfill,
  blockIdExtension,
  pureChart,
  pureCodeBlock,
  pureImage,
} from '../extensions';
import { BlockIdMarkdown } from '../blockId/BlockIdMarkdown';
import {
  isSameVersionMarkdown,
  readLeadBlockId,
  restoreVersionMarkdown,
} from './restoreVersion';

const BlockIdAttr = Extension.create({
  name: 'blockIdAttrTest',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-id'),
            renderHTML: (attributes) =>
              attributes.blockId ? { 'data-block-id': attributes.blockId as string } : {},
          },
        },
      },
    ];
  },
});

function build(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function buildChapters(): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown, BlockIdAttr],
    content: `
      <h2 data-block-id="b_ch1">第一章</h2>
      <p>原来的第一章正文</p>
      <h2 data-block-id="b_ch2">第二章</h2>
      <p>第二章正文</p>
    `,
  });
}

function buildWithBlockIds(markdown: string): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      blockIdExtension,
      blockIdBackfill,
      pureCodeBlock,
      pureImage,
      pureChart,
      BlockIdMarkdown,
    ],
    content: markdown,
    contentType: 'markdown',
  });
}

describe('restoreVersionMarkdown', () => {
  it('写回所选版本，撤销一次回到打过字的正文', () => {
    const editor = build('hello');
    editor.commands.insertContent('!');
    const typed = editor.getMarkdown();
    expect(typed).not.toContain('restored');

    const result = restoreVersionMarkdown(editor, 'restored');
    expect(result.mode).toBe('replace-document');
    expect(editor.getMarkdown()).toContain('restored');
    expect(editor.getMarkdown()).not.toContain('hello!');

    editor.commands.undo();
    expect(editor.getMarkdown()).toBe(typed);
    editor.destroy();
  });

  it('章首块 ID 还能定位时只替换该章范围', () => {
    const editor = buildChapters();
    const result = restoreVersionMarkdown(
      editor,
      '## 第一章\n\n修订后的正文',
      { leadBlockId: 'b_ch1' },
    );
    expect(result).toEqual({ mode: 'replace-chapter', leadBlockId: 'b_ch1' });
    const markdown = editor.getMarkdown();
    expect(markdown).toContain('修订后的正文');
    expect(markdown).not.toContain('原来的第一章正文');
    expect(markdown).toContain('第二章正文');
    editor.destroy();
  });

  it('章首块 ID 找不到时把内容插到光标处并返回 insert-at-cursor', () => {
    const editor = buildChapters();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const result = restoreVersionMarkdown(editor, '## 已删章节\n\n旧章内容', {
      leadBlockId: 'b_gone',
    });
    expect(result).toEqual({ mode: 'insert-at-cursor', leadBlockId: 'b_gone' });
    const markdown = editor.getMarkdown();
    expect(markdown).toContain('旧章内容');
    expect(markdown).toContain('第一章');
    expect(markdown).toContain('第二章');
    editor.destroy();
  });

  it('没给 leadBlockId 时只认版本内容首行的块 ID 注释', () => {
    expect(readLeadBlockId('<!--b:b_abc123-->\n\n## 第一章')).toBe('b_abc123');
    // 首块没有 ID 注释时不能拿章中间块的 ID 当章首。
    expect(readLeadBlockId('## 第一章\n\n<!--b:b_later-->')).toBeNull();
    // fence 里的伪注释同样不算。
    expect(readLeadBlockId('```\n<!--b:b_in_fence-->\n```')).toBeNull();
    // 前置空行不影响；首行缩进空格仍可识别。
    expect(readLeadBlockId('\n  <!--b:b_lead-->  \n\n正文')).toBe('b_lead');
    expect(readLeadBlockId('## 没有块 ID')).toBeNull();
  });

  it('scope=document 整篇替换且保留 markdown 里的块 ID', () => {
    const editor = buildWithBlockIds(
      '<!--b:b_oldchap001-->\n\n## 旧章\n\n旧正文',
    );
    const result = restoreVersionMarkdown(
      editor,
      '<!--b:b_newchap001-->\n\n## 新章\n\n新正文',
      { scope: 'document' },
    );
    expect(result.mode).toBe('replace-document');
    const markdown = editor.getMarkdown();
    // 块 ID 随内容一起恢复：保存时对齐层才能认出「还是原来那几章」。
    expect(markdown).toContain('<!--b:b_newchap001-->');
    expect(markdown).toContain('新正文');
    expect(markdown).not.toContain('旧正文');
    expect(markdown).not.toContain('b_oldchap001');
    editor.destroy();
  });

  it('编辑器多吐出的尾部空行仍视为同一版', () => {
    const stored = '# 季度纪要\n\n营收保持增长。\n\n- 渠道\n- 产品\n';
    const live = '# 季度纪要\n\n营收保持增长。\n\n- 渠道\n- 产品\n\n';
    expect(isSameVersionMarkdown(live, stored)).toBe(true);
    expect(isSameVersionMarkdown(live, '# 季度纪要\n\n营收下降。\n')).toBe(false);
  });
});
