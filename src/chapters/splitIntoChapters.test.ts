import type { Node as PMNode } from '@tiptap/pm/model';
import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from '../extensions';
import { splitIntoChapters } from './splitIntoChapters';

const schema = getSchema(baseExtensions);

function p(text = ''): PMNode {
  return schema.node(
    'paragraph',
    null,
    text ? [schema.text(text)] : [],
  );
}

function h(level: number, text: string): PMNode {
  return schema.node('heading', { level }, [schema.text(text)]);
}

/** 便于肉眼比对的形状：标题 hN，段落取文本。 */
function shape(chapters: PMNode[][]): string[][] {
  return chapters.map((chapter) =>
    chapter.map((node) =>
      node.type.name === 'heading'
        ? `h${String(node.attrs.level)}:${node.textContent}`
        : node.textContent,
    ),
  );
}

describe('splitIntoChapters：golden', () => {
  it('H1 大类 + H2 小节：首个 H2 前（含首个 H2）归第一章，之后每个 H2 开新章', () => {
    const blocks = [
      h(1, '报告'),
      p('导语'),
      h(2, '甲'),
      p('A'),
      h(2, '乙'),
      p('B'),
    ];
    expect(shape(splitIntoChapters(blocks))).toEqual([
      ['h1:报告', '导语', 'h2:甲', 'A'],
      ['h2:乙', 'B'],
    ]);
  });

  it('纯 H2：每个 H2 一章', () => {
    const blocks = [h(2, '甲'), p('A'), h(2, '乙')];
    expect(shape(splitIntoChapters(blocks))).toEqual([
      ['h2:甲', 'A'],
      ['h2:乙'],
    ]);
  });

  it('纯 H3：整篇一章', () => {
    const blocks = [h(3, '小标题'), p('正文')];
    expect(splitIntoChapters(blocks)).toHaveLength(1);
    expect(splitIntoChapters(blocks)[0]).toEqual(blocks);
  });

  it('无标题：整篇一章', () => {
    const blocks = [p('一'), p('二'), p('三')];
    expect(splitIntoChapters(blocks)).toEqual([blocks]);
  });

  it('空文档：[[]]', () => {
    expect(splitIntoChapters([])).toEqual([[]]);
  });

  it('壳章：H2 紧邻 H2 保留、不合并', () => {
    const blocks = [h(2, '甲'), h(2, '乙'), p('B')];
    expect(shape(splitIntoChapters(blocks))).toEqual([
      ['h2:甲'],
      ['h2:乙', 'B'],
    ]);
  });

  it('文档以 H2 开头：首章就是该 H2', () => {
    const blocks = [h(2, '开头'), p('正文')];
    expect(shape(splitIntoChapters(blocks))).toEqual([['h2:开头', '正文']]);
  });

  it('不变量：chapters.flat() 严格等于输入（同一批节点、顺序不变）', () => {
    const blocks = [
      p('导语'),
      h(2, '甲'),
      p('A'),
      h(2, '乙'),
      h(2, '丙'),
      p('C'),
    ];
    const flat = splitIntoChapters(blocks).flat();
    expect(flat).toHaveLength(blocks.length);
    flat.forEach((node, index) => expect(node).toBe(blocks[index]));
  });

  it('幂等：切分 → flat → 再切分，形状与节点完全一致', () => {
    const blocks = [
      h(3, '前言'),
      p('导语'),
      h(2, '甲'),
      p('A'),
      h(2, '乙'),
      p('B'),
    ];
    const once = splitIntoChapters(blocks);
    const twice = splitIntoChapters(once.flat());
    expect(twice.map((chapter) => chapter.map((node) => node.textContent))).toEqual(
      once.map((chapter) => chapter.map((node) => node.textContent)),
    );
    expect(twice.flat()).toEqual(once.flat());
  });
});
