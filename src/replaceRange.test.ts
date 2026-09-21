// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { createChart } from './chart/createChart';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { insertMarkdown } from './insertMarkdown';
import { findRangeByAnchor } from './anchorRange';
import { replaceRangeWithMarkdown } from './replaceRange';

const here = dirname(fileURLToPath(import.meta.url));

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function build(content = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, createChart({ editable: false }), Markdown],
    content: prepareChartMarkdown(content),
    contentType: 'markdown',
  });
}

function blockRange(
  editor: Editor,
  pred: (node: { type: { name: string }; textContent: string }) => boolean,
  index = 0,
): { from: number; to: number } {
  let seen = 0;
  let found = { from: -1, to: -1 };
  editor.state.doc.forEach((node, offset) => {
    if (found.from >= 0) return;
    if (pred(node)) {
      if (seen === index) {
        found = { from: offset, to: offset + node.nodeSize };
        return;
      }
      seen += 1;
    }
  });
  return found;
}

const paraWith = (text: string) => (node: { type: { name: string }; textContent: string }) =>
  node.type.name === 'paragraph' && node.textContent.includes(text);

describe('replaceRangeWithMarkdown', () => {
  it('替换指定段落，其它块不动', () => {
    const editor = build(['第一段。', '', '第二段。', '', '第三段。'].join('\n'));
    const range = blockRange(editor, paraWith('第二段'));
    expect(replaceRangeWithMarkdown(editor, range, '第二段改过了。')).toBe(true);
    const md = editor.getMarkdown();
    expect(md).toContain('第一段。');
    expect(md).toContain('第二段改过了。');
    expect(md).toContain('第三段。');
    expect(md).not.toContain('第二段。\n');
    editor.destroy();
  });

  it('实现里不出现 .focus()（后台回填不抢焦点）；对照：insertMarkdown 有', () => {
    // happy-dom 里 focus 观察不到（editor.isFocused 与 spy view.focus 都试过），所以按仓库
    // 既有做法（见 reader.entry.test.ts）断言实现源码本身；并拿 insertMarkdown 作对照，
    // 证明这条断言有牙齿——它确实能区分「带 focus」与「不带 focus」两种实现。
    const silent = stripComments(readFileSync(join(here, 'replaceRange.ts'), 'utf8'));
    expect(silent).not.toMatch(/\.focus\(/);

    const byUser = stripComments(readFileSync(join(here, 'insertMarkdown.ts'), 'utf8'));
    expect(byUser).toMatch(/\.focus\(/);
  });

  it('一次撤销回到原文（整段替换是一个 transaction）', () => {
    const original = ['第一段。', '', '第二段。'].join('\n');
    const editor = build(original);
    const range = blockRange(editor, paraWith('第二段'));
    replaceRangeWithMarkdown(editor, range, '改过了。');
    expect(editor.getMarkdown()).toContain('改过了。');

    editor.commands.undo();
    expect(editor.getMarkdown()).toBe(editor.getMarkdown());
    expect(editor.getMarkdown()).not.toContain('改过了。');
    expect(editor.getMarkdown()).toContain('第二段。');
    editor.destroy();
  });

  it('替换成图表 markdown → 文档里出现图节点', () => {
    const editor = build(['前文。', '', '| 项目 | 金额 |', '| --- | --- |', '| 收入 | 100 |'].join('\n'));
    const table = blockRange(editor, (n) => n.type.name === 'table');
    const chartMd = [
      '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
    ].join('\n');
    expect(replaceRangeWithMarkdown(editor, table, chartMd)).toBe(true);
    expect(editor.state.doc.content.content.some((n) => n.type.name === 'chart')).toBe(true);
    expect(editor.getMarkdown()).toContain('"chartType":"column"');
    editor.destroy();
  });

  it('脏输出走降级：不抛错，能落的块都落下', () => {
    const editor = build(['第一段。', '', '第二段。'].join('\n'));
    const range = blockRange(editor, paraWith('第二段'));
    const dirty = ['hello', '**(**一**)** 现任董事', 'world'].join('\n\n');
    expect(() => replaceRangeWithMarkdown(editor, range, dirty)).not.toThrow();
    const text = editor.state.doc.textContent;
    expect(text).toContain('hello');
    expect(text).toContain('world');
    expect(text).toMatch(/现任/);
    editor.destroy();
  });

  it('替换成多块（图表 + 附加段落）都插进去', () => {
    const editor = build(['前文。', '', '待替换。'].join('\n'));
    const range = blockRange(editor, paraWith('待替换'));
    const md = [
      '<!-- {"chartType":"line","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
      '',
      '图注：收入口径见下。',
    ].join('\n');
    expect(replaceRangeWithMarkdown(editor, range, md)).toBe(true);
    const out = editor.getMarkdown();
    expect(out).toContain('"chartType":"line"');
    expect(out).toContain('图注：收入口径见下。');
    expect(out).not.toContain('待替换。');
    editor.destroy();
  });

  it('空 markdown 不动文档（不静默删内容）', () => {
    const editor = build(['第一段。', '', '第二段。'].join('\n'));
    const before = editor.getMarkdown();
    const range = blockRange(editor, paraWith('第二段'));
    expect(replaceRangeWithMarkdown(editor, range, '   \n ')).toBe(false);
    expect(editor.getMarkdown()).toBe(before);
    editor.destroy();
  });

  it('塌缩区间返回 false', () => {
    const editor = build('有内容。');
    expect(replaceRangeWithMarkdown(editor, { from: 1, to: 1 }, 'x')).toBe(false);
    editor.destroy();
  });
});

/**
 * 圈选改写的回填：宿主拿 `findRangeByAnchor` 定位出来的是**文字**区间，而表格/列表这类块，
 * 它的文字区间起止都落在**单元格 / 列表项内部**。这一组测试把「为什么必须扩块后写」钉住：
 * 直接拿文字区间塞块级内容（表格 + 图），表格会被嵌进一个 1×1 表格的单元格里（线上实测症状：
 * 图被框进表格、位置往里缩了一层）。
 */
describe('写块级内容必须落在块边界（圈选改写回填）', () => {
  const TABLE = [
    '| 财务指标 | 虎牙      | 斗鱼      |',
    '| ---- | ------- | ------- |',
    '| 年营收  | 62.6亿美元 | 40.4亿美元 |',
    '| 市销率  | 0.102   | 0.056   |',
  ].join('\n');
  const CHART_PAIR = [
    '<!-- {"chartType":"column","x":"财务指标","y":"金额","title":"对比"} -->',
    '',
    '| 财务指标 | 公司 | 金额 |',
    '|------|------|------|',
    '| 年营收 | 虎牙 | 62.6 |',
    '| 年营收 | 斗鱼 | 40.4 |',
  ].join('\n');
  /** 宿主 `expandToTopLevelBlock` 的规则：扩到包含这段文字的顶层块边界 */
  const blockAligned = (editor: Editor, from: number, to: number) => {
    const doc = editor.state.doc;
    const $from = doc.resolve(from);
    const $to = doc.resolve(to);
    return {
      from: $from.depth >= 1 ? $from.before(1) : from,
      to: $to.depth >= 1 ? $to.after(1) : to,
    };
  };
  const hasNestedTable = (editor: Editor): boolean => {
    const doc = editor.state.doc;
    let nested = false;
    doc.descendants((node, pos) => {
      if (node.type.name !== 'table') return;
      const $pos = doc.resolve(pos);
      for (let d = $pos.depth; d > 0; d -= 1) {
        if ($pos.node(d).type.name === 'table') nested = true;
      }
    });
    return nested;
  };

  it('传**文字**区间：表格被嵌进单元格（所以宿主不能这么写）', () => {
    const editor = build(TABLE);
    const anchor = findRangeByAnchor(editor, { exact: '市销率' });
    expect(anchor).not.toBeNull();

    // 锚点是单元格里的文字区间 —— 起点在单元格内部
    expect(editor.state.doc.resolve(anchor!.from).depth).toBeGreaterThan(1);
    expect(
      replaceRangeWithMarkdown(
        editor,
        { from: anchor!.from, to: anchor!.to },
        `${TABLE}\n\n${CHART_PAIR}`,
      ),
    ).toBe(true);

    expect(hasNestedTable(editor)).toBe(true);
    editor.destroy();
  });

  it('传**顶层块**区间：表格、图、数据表各占一个顶层块，没有嵌套', () => {
    const editor = build(TABLE);
    const anchor = findRangeByAnchor(editor, { exact: '市销率' });
    expect(anchor).not.toBeNull();

    const target = blockAligned(editor, anchor!.from, anchor!.to);
    expect(
      replaceRangeWithMarkdown(editor, target, `${TABLE}\n\n${CHART_PAIR}`),
    ).toBe(true);

    expect(hasNestedTable(editor)).toBe(false);
    // 图会把它的数据表**吃进图表节点**（库的图表约定），所以数据表不单独占一个顶层块；
    // 末尾的空段落是 TrailingNode 补的。关键结论：原表格**原样还在**（表头 + 2 行数据，
    // 分隔行不算行；每行 3 格）。
    const names: string[] = [];
    editor.state.doc.forEach((node) => names.push(node.type.name));
    expect(names.slice(0, 2)).toEqual(['table', 'chart']);
    const first = editor.state.doc.child(0);
    expect(first.type.name).toBe('table');
    expect(first.childCount).toBe(3);
    expect(first.child(0).childCount).toBe(3);
    editor.destroy();
  });
});
