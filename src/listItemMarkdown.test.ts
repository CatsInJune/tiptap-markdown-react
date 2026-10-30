/** @vitest-environment happy-dom */
// 列表项第一个块必须是段落（schema: `paragraph block*`）。markdown 解析不校验 schema，
// `- ## 标题` / 列表项里的 setext 标题会产出非法文档；TOC 补 id 时抛 TransformError 整页白屏。
// issue #44。
import { Editor } from '@tiptap/core';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import { Markdown } from '@tiptap/markdown';
import { afterEach, describe, expect, it } from 'vitest';
import { baseExtensions, pureCodeBlock } from './extensions';
import { renderReportHtml } from './renderReportHtml';

const CASES: Record<string, string> = {
  流式输出到一半的嵌套列表: '## 已按反馈改进（v2）\n\n- 新增小节，含三点口径提示：\n  -',
  列表项里写标题: '- ## 标题\n- 第二项',
  列表项里的setext标题: '- 文字\n  ---\n- 第二项',
  列表项里的setext一级标题: '- 文字\n  ===',
};

function build(extensions = [...baseExtensions, Markdown], content = ''): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions,
    content,
    ...(content ? { contentType: 'markdown' as const } : {}),
  });
}

function firstListItemBlock(editor: Editor): string {
  let name = '';
  editor.state.doc.descendants((node) => {
    if (name) return false;
    if (node.type.name === 'listItem') name = node.firstChild?.type.name ?? '';
    return !name;
  });
  return name;
}

describe('issue#44 列表项第一个块是标题', () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  for (const [name, markdown] of Object.entries(CASES)) {
    it(`${name}：不抛错，文档合法，列表项以段落开头`, () => {
      editor = build([...baseExtensions, Markdown, TableOfContents]);
      expect(() =>
        editor.commands.setContent(markdown, { contentType: 'markdown' }),
      ).not.toThrow();
      expect(() => editor.state.doc.check()).not.toThrow();
      expect(firstListItemBlock(editor)).toBe('paragraph');
    });
  }

  it('不挂 TOC 时文档也合法（根因在解析而非目录）', () => {
    editor = build();
    editor.commands.setContent(CASES['列表项里写标题'], { contentType: 'markdown' });
    expect(() => editor.state.doc.check()).not.toThrow();
  });
});

describe('issue#44 正常写法不受影响', () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  const NORMAL: Record<string, string> = {
    嵌套列表: '- 一级\n  - 二级\n  - 二级二',
    空列表项后接内容: '- 证据\n-',
    标题后面跟列表: '## 标题\n\n- 一项\n- 二项',
    有序列表: '1. 第一\n2. 第二',
    多层有序无序混排: '- 一\n  1. 子一\n  2. 子二\n- 二',
  };

  for (const [name, markdown] of Object.entries(NORMAL)) {
    it(`${name}：结构合法且往返一致`, () => {
      editor = build();
      editor.commands.setContent(markdown, { contentType: 'markdown' });
      expect(() => editor.state.doc.check()).not.toThrow();
      expect(editor.getMarkdown().trim()).toBe(markdown.trim());
    });
  }

  it('列表项里的标题被降成同内容段落，往返为 `- 标题`', () => {
    editor = build();
    editor.commands.setContent('- ## 标题\n- 第二项', { contentType: 'markdown' });
    expect(editor.getMarkdown().trim()).toBe('- 标题\n- 第二项');
  });

  it('列表项里有多块时只降第一个标题，后续块原样保留', () => {
    editor = build();
    editor.commands.setContent('- ## 标题\n\n  正文段落\n\n  ## 第二块标题', {
      contentType: 'markdown',
    });
    expect(() => editor.state.doc.check()).not.toThrow();
    const blocks: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'listItem') return true;
      if (blocks.length) return false;
      node.forEach((child) => blocks.push(child.type.name));
      return false;
    });
    expect(blocks).toEqual(['paragraph', 'paragraph', 'heading']);
  });

  // 与 issue 同根因：官方 parseMarkdown 的兜底分支把 inline token 原样塞进 listItem，
  // 首个块虽是段落，后面的裸 text 一样让文档不合法，TOC 补 id 时同样崩。
  it('列表项首块是标题、后接无空行正文：裸 text 也要包成段落', () => {
    editor = build([...baseExtensions, Markdown, TableOfContents]);
    expect(() =>
      editor.commands.setContent('- ## 标题\n  正文段落', { contentType: 'markdown' }),
    ).not.toThrow();
    expect(() => editor.state.doc.check()).not.toThrow();
    const blocks: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'listItem') return true;
      if (blocks.length) return false;
      node.forEach((child) => blocks.push(child.type.name));
      return false;
    });
    expect(blocks).toEqual(['paragraph', 'paragraph']);
  });

  it('有序列表里的 setext 写法不触发（既有边界）', () => {
    editor = build();
    expect(() =>
      editor.commands.setContent('1. 文字\n   ---', { contentType: 'markdown' }),
    ).not.toThrow();
    expect(() => editor.state.doc.check()).not.toThrow();
  });
});

describe('列表项首块是引用 / 表格 / 代码块', () => {
  let editor: Editor;
  afterEach(() => editor?.destroy());

  // 这三类写法是合法 markdown，不能像标题那样降级；schema 放到 `block+` 让文档合法。
  const LEADING: Record<string, { markdown: string; block: string }> = {
    引用开头: { markdown: '- > 引用\n- 第二项', block: 'blockquote' },
    代码块开头: {
      markdown: '- ```js\n  console.log(1)\n  ```\n- 第二项',
      block: 'codeBlock',
    },
    表格开头: {
      markdown: '- | a | b |\n  | - | - |\n  | 1 | 2 |',
      block: 'table',
    },
  };

  for (const [name, { markdown, block }] of Object.entries(LEADING)) {
    it(`${name}：文档合法，首块保留原类型`, () => {
      editor = build([...baseExtensions, pureCodeBlock, Markdown]);
      expect(() =>
        editor.commands.setContent(markdown, { contentType: 'markdown' }),
      ).not.toThrow();
      expect(() => editor.state.doc.check()).not.toThrow();

      let firstBlock = '';
      editor.state.doc.descendants((node) => {
        if (firstBlock) return false;
        if (node.type.name === 'listItem') {
          firstBlock = node.firstChild?.type.name ?? '';
        }
        return !firstBlock;
      });
      expect(firstBlock).toBe(block);
    });

    it(`${name}：列表命令不抛错`, () => {
      editor = build([...baseExtensions, pureCodeBlock, Markdown]);
      editor.commands.setContent(markdown, { contentType: 'markdown' });
      let blockPos = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === block) blockPos = pos;
        return true;
      });
      editor.commands.setTextSelection(blockPos + 3);
      expect(() => editor.commands.liftListItem('listItem')).not.toThrow();
      expect(() => editor.commands.sinkListItem('listItem')).not.toThrow();
      expect(() => editor.state.doc.check()).not.toThrow();
    });
  }

  // 引用首块官方序列化就带 `- > `，原样往返。
  it('引用开头的列表项往返不变', () => {
    editor = build([...baseExtensions, pureCodeBlock, Markdown]);
    editor.commands.setContent('- > 引用\n- 第二项', { contentType: 'markdown' });
    const out = editor.getMarkdown().trim();
    expect(out).toBe('- > 引用\n- 第二项');
    editor.commands.setContent(out, { contentType: 'markdown' });
    expect(() => editor.state.doc.check()).not.toThrow();
  });
});

describe('列表项首块标题：服务端渲染', () => {
  // 修复前 generateTocIds 的 setNodeMarkup 抛同一个错，被 renderReportHtml 的兜底
  // catch 降级成「整篇没有目录」。修复后应走正常 TOC 管线。
  it('不再丢掉目录，列表项里的标题降成段落', () => {
    const result = renderReportHtml(
      '## 已按反馈改进（v2）\n\n- 新增小节，含三点口径提示：\n  -',
    );
    expect(result.ok).toBe(true);
    expect(result.toc).toEqual([
      { id: '已按反馈改进v2', level: 2, text: '已按反馈改进（v2）' },
    ]);
    expect(result.html).not.toContain('<li><h2>');
  });

  it('`- ## 标题` 输出合法的段落结构', () => {
    const result = renderReportHtml('- ## 标题\n- 第二项');
    expect(result.ok).toBe(true);
    expect(result.html).toBe('<ul><li><p>标题</p></li><li><p>第二项</p></li></ul>');
  });

  it('正常文档不带降级标记（tocDegraded 仅在兜底时出现）', () => {
    const result = renderReportHtml('## 标题\n\n- 一项');
    expect(result.ok).toBe(true);
    expect(result.tocDegraded).toBeUndefined();
    expect(result.toc).toHaveLength(1);
  });

  it('引用 / 代码块 / 表格开头的列表项：正文与目录都正常', () => {
    const result = renderReportHtml(
      '## 章节\n\n- > 引用\n- ```js\n  console.log(1)\n  ```\n- | a | b |\n  | - | - |\n  | 1 | 2 |',
    );
    expect(result.ok).toBe(true);
    expect(result.tocDegraded).toBeUndefined();
    expect(result.toc).toHaveLength(1);
    expect(result.html).toContain('<blockquote>');
    expect(result.html).toContain('console.log(1)');
    expect(result.html).toContain('<table');
  });
});

