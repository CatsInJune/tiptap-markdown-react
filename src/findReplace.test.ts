// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { pureChart } from './chart/ChartExtension';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { baseExtensions, pureCodeBlock } from './extensions';
import { runFindCommand } from './findReplace';

/**
 * 官方查找替换在本 schema 下的语义契约。
 *
 * 这些断言有意钉住**官方**的行为（搜索范围、跨标记、替换取哪一段的标记、全部替换的撤销
 * 粒度）——它们决定了用户看到什么，升级 @tiptap 时若变了，这里必须首先红。
 *
 * 注意 searchDebounceMs: 0：扩展的防抖走 setTimeout，异步抛错兜不住，库内一律关掉，
 * 防抖由调用方自己做（见 findReplace.ts）。
 */
function build(markdown: string, options: { editable?: boolean } = {}): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      pureCodeBlock,
      pureChart,
      FindAndReplace.configure({ injectCSS: false, searchDebounceMs: 0 }),
      Markdown,
    ],
    content: prepareChartMarkdown(markdown),
    contentType: 'markdown',
    editable: options.editable ?? true,
  });
}

const search = (editor: Editor, term: string) => {
  runFindCommand(() => editor.commands.setSearchTerm(term));
  return editor.storage.findAndReplace;
};

describe('查找替换（官方扩展语义）', () => {
  it('命中计数与当前位置：setSearchTerm 后停在第一个命中', () => {
    const editor = build('one two one');
    const storage = search(editor, 'one');

    expect(storage.results).toHaveLength(2);
    expect(storage.currentIndex).toBe(0);
    editor.destroy();
  });

  it('搜索范围是 textblock：代码块与表格单元格里的文字能搜到', () => {
    const editor = build(
      ['```js', 'const needle = 1;', '```', '', '| a | b |', '| --- | --- |', '| c | needle |'].join(
        '\n',
      ),
    );

    expect(search(editor, 'needle').results).toHaveLength(2);
    editor.destroy();
  });

  it('原子节点里的文字搜不到：公式与图表数据不进结果', () => {
    const editor = build(
      [
        '公式 $$a^2$$ 之后。',
        '',
        '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
        '',
        '| 项目 | 金额 |',
        '| --- | --- |',
        '| 收入 | 100 |',
      ].join('\n'),
    );

    // 公式的 LaTeX 与图表的数据都在节点 attrs 里，正文里没有这些字 → 不命中
    expect(search(editor, 'a^2').results).toHaveLength(0);
    expect(search(editor, '收入').results).toHaveLength(0);
    // 正文文字照常命中
    expect(search(editor, '之后').results).toHaveLength(1);
    editor.destroy();
  });

  it('可以跨标记命中，但不跨段落', () => {
    const editor = build(['**bold** tail', '', '下一段 tail'].join('\n'));

    // 跨 mark（粗体 → 纯文本）能命中
    expect(search(editor, 'bold tail').results).toHaveLength(1);
    // 跨段落的同一串文字不命中
    expect(search(editor, 'tail 下一段').results).toHaveLength(0);
    editor.destroy();
  });

  it('不确定是不是 markdown 语法：搜的是渲染后的文字，不是源码', () => {
    const editor = build('**bold** tail');

    expect(search(editor, 'bold').results).toHaveLength(1);
    expect(search(editor, '**bold**').results).toHaveLength(0);
    editor.destroy();
  });

  it('替换：取命中起点处的标记（跨标记命中会带上起点的格式）', () => {
    const editor = build('**bold** tail');
    search(editor, 'bold tail');
    editor.commands.setReplaceTerm('X');
    editor.commands.replace();

    // 命中起点在粗体里 → 替换后的文字仍是粗体；末尾的纯文本段不再单独保留
    expect(editor.getMarkdown()).toBe('**X**');
    editor.destroy();
  });

  it('替换：同一 text 节点内替换保留该段格式', () => {
    const editor = build('**bold word** tail');
    search(editor, 'word');
    editor.commands.setReplaceTerm('W');
    editor.commands.replace();

    expect(editor.getMarkdown()).toBe('**bold W** tail');
    editor.destroy();
  });

  it('全部替换是一个事务：撤销一次回到原文', () => {
    const editor = build('aaa bbb aaa ccc aaa');
    const before = editor.getMarkdown();
    search(editor, 'aaa');
    editor.commands.setReplaceTerm('ZZ');
    editor.commands.replaceAll();
    expect(editor.getMarkdown()).toBe('ZZ bbb ZZ ccc ZZ');

    editor.commands.undo();
    expect(editor.getMarkdown()).toBe(before);
    editor.destroy();
  });

  it('导航会循环：末尾 next 回到第一个，开头 prev 落到最后一个', () => {
    const editor = build('one two one');
    search(editor, 'one');

    editor.commands.goToNextResult();
    expect(editor.storage.findAndReplace.currentIndex).toBe(1);
    editor.commands.goToNextResult();
    expect(editor.storage.findAndReplace.currentIndex).toBe(0);
    editor.commands.goToPreviousResult();
    expect(editor.storage.findAndReplace.currentIndex).toBe(1);
    editor.destroy();
  });

  it('高亮是 decoration：进了 DOM、带官方类名，且不进 markdown', () => {
    const editor = build('one two one');
    const before = editor.getMarkdown();
    search(editor, 'one');

    expect(editor.view.dom.querySelectorAll('.find-and-replace-result')).toHaveLength(2);
    // 当前命中额外带 current 类
    expect(
      editor.view.dom.querySelectorAll('.find-and-replace-result-current'),
    ).toHaveLength(1);
    expect(editor.getMarkdown()).toBe(before);

    editor.commands.clearSearch();
    expect(editor.view.dom.querySelectorAll('.find-and-replace-result')).toHaveLength(0);
    expect(editor.getMarkdown()).toBe(before);
    editor.destroy();
  });

  it('默认不区分大小写；打开开关后区分', () => {
    const editor = build('Alpha alpha');

    expect(search(editor, 'ALPHA').results).toHaveLength(2);
    editor.commands.setCaseSensitive(true);
    expect(editor.storage.findAndReplace.results).toHaveLength(0);
    editor.destroy();
  });

  it('正则走 RE2：支持 \\d，非法模式静默零结果而不是抛错', () => {
    const editor = build('a1 b2 c3');
    editor.commands.setUseRegex(true);

    expect(search(editor, '\\d').results).toHaveLength(3);
    // lookahead 是 RE2 不支持的语法 → 官方返回零结果，不抛
    expect(search(editor, '(?=x)').results).toHaveLength(0);
    editor.destroy();
  });

  it('文末是代码块时，第一个查询也不再抛 Tiptap 的事务错配（runFindCommand 兜底）', () => {
    const editor = build(['foo', '', '```js', 'const baz = 1;', '```'].join('\n'));
    expect(editor.state.doc.lastChild?.type.name).toBe('codeBlock');

    // 不加守卫时官方命令会抛 RangeError: Applying a mismatched transaction
    // （TrailingNode 在第一个事务补尾段落，CommandManager 随后又派发旧 tr）
    expect(() => search(editor, 'baz')).not.toThrow();
    expect(editor.storage.findAndReplace.results).toHaveLength(1);
    editor.destroy();
  });

  it('只读态照样能查（替换由 UI 负责隐藏）', () => {
    const editor = build('one two one', { editable: false });

    expect(search(editor, 'one').results).toHaveLength(2);
    editor.destroy();
  });
});
