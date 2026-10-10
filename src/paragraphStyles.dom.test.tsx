// @vitest-environment happy-dom
import type { JSONContent } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { renderReportHtml } from './renderReportHtml';

function build(content = '') {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

function firstNode(json: JSONContent): JSONContent | undefined {
  return (json.content ?? [])[0];
}

/**
 * 段落级样式（文字对齐 / 缩进 / 行高）的 markdown 往返：
 * 带样式 → `<p style="…">` / `<hN style="…">`，无样式 → 原生 markdown；
 * 三者共存时 style 按固定顺序拼接（保幂等）。
 */
describe('段落样式的 markdown 往返', () => {
  it('对齐：带样式走 `<p style>`，无样式保持原生形式', () => {
    const editor = build('hello');
    expect(editor.getMarkdown().trim()).toBe('hello');

    editor.commands.setTextAlign('center');
    expect(editor.getMarkdown().trim()).toBe(
      '<p style="text-align: center">hello</p>',
    );
    editor.destroy();
  });

  it('缩进与行高：命令生效且渲染成 style 片段', () => {
    const editor = build('hello');
    editor.commands.increaseIndent();
    expect(editor.getMarkdown().trim()).toBe(
      '<p style="margin-left: 2em">hello</p>',
    );

    editor.commands.increaseIndent();
    editor.commands.setLineHeight(1.5);
    expect(editor.getMarkdown().trim()).toBe(
      '<p style="margin-left: 4em; line-height: 1.5">hello</p>',
    );

    // 减少到 0 即清除
    editor.commands.decreaseIndent();
    editor.commands.decreaseIndent();
    expect(editor.getMarkdown().trim()).toBe('<p style="line-height: 1.5">hello</p>');
    editor.destroy();
  });

  it('三者共存：style 顺序固定、往返幂等', () => {
    const md =
      '<p style="text-align: center; margin-left: 2em; line-height: 1.5">hello</p>';
    const editor = build(md);
    const json = editor.getJSON();
    expect(firstNode(json)?.attrs).toMatchObject({
      textAlign: 'center',
      indent: 1,
      lineHeight: 1.5,
    });
    expect(editor.getMarkdown().trim()).toBe(md);
    editor.destroy();
  });

  it('标题：带样式走 `<hN style>`，无样式保持 `## 前缀`', () => {
    const plain = build('## title');
    expect(plain.getMarkdown().trim()).toBe('## title');
    plain.destroy();

    const editor = build(
      '<h2 style="text-align: right">title</h2>',
    );
    const json = editor.getJSON();
    expect(firstNode(json)?.type).toBe('heading');
    expect(firstNode(json)?.attrs).toMatchObject({ level: 2, textAlign: 'right' });
    expect(editor.getMarkdown().trim()).toBe('<h2 style="text-align: right">title</h2>');
    editor.destroy();
  });

  it('标题上的缩进 / 行高也生效（光标在标题里不会因「段落找不到」而短路）', () => {
    const editor = build('## title');
    editor.commands.setTextSelection(4); // 光标在标题内
    expect(editor.commands.increaseIndent()).toBe(true);
    expect(editor.commands.setLineHeight(1.5)).toBe(true);
    expect(firstNode(editor.getJSON())?.attrs).toMatchObject({
      level: 2,
      indent: 1,
      lineHeight: 1.5,
    });
    expect(editor.getMarkdown().trim()).toBe(
      '<h2 style="margin-left: 2em; line-height: 1.5">title</h2>',
    );
    editor.destroy();
  });

  it('段内行内 markdown 照常解析（tokenizer 用 lexer 解析内容）', () => {
    const md = '<p style="text-align: center">**bold** and [link](https://x.dev)</p>';
    const editor = build(md);
    const para = firstNode(editor.getJSON());
    const types = (para?.content ?? []).map((child) => child.type);
    expect(types).toContain('text');
    const marks = (para?.content ?? []).flatMap((child) =>
      (child.marks ?? []).map((mark) => mark.type),
    );
    expect(marks).toContain('bold');
    expect(marks).toContain('link');
    editor.destroy();
  });

  it('server 端保留段落样式（style 不被剥）', () => {
    const rendered = renderReportHtml(
      '<p style="text-align: center; line-height: 1.5">hello</p>',
    );
    expect(rendered.ok).toBe(true);
    expect(rendered.html).toContain('text-align: center');
    expect(rendered.html).toContain('line-height: 1.5');
    expect(rendered.html).not.toContain('&lt;p');
  });

  it('独占一行的图片仍被提成顶层节点（不被段落包住）', () => {
    const editor = new Editor({
      extensions: [
        ...baseExtensions,
        Image.configure({ inline: false }),
        Markdown,
      ],
      content: '![a](https://x/a.png)',
      contentType: 'markdown',
    });
    const node = firstNode(editor.getJSON());
    expect(node?.type).toBe('image');
    editor.destroy();
  });
});
