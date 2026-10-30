import { describe, expect, it } from 'vitest';
import { diffAnnotations } from './buildDiffDoc';

describe('版本对比', () => {
  it('相同文档无高亮', () => {
    expect(diffAnnotations('hello **world**', 'hello **world**')).toEqual([]);
  });

  it('段内插入只标出多出来的词', () => {
    const marks = diffAnnotations('hello brave world', 'hello world');
    expect(marks.map((mark) => mark.text).join('')).toContain('brave');
    expect(marks.every((mark) => mark.diff === 'insert')).toBe(true);
    expect(marks.some((mark) => mark.text.includes('hello'))).toBe(false);
  });

  it('段内删除标出对方多出来的词', () => {
    const marks = diffAnnotations('hello world', 'hello brave world');
    expect(marks.some((mark) => mark.diff === 'delete' && mark.text.includes('brave'))).toBe(true);
    expect(marks.some((mark) => mark.diff === 'insert')).toBe(false);
  });

  it('中文按字对比', () => {
    const marks = diffAnnotations('今天天气很好', '今天天气不错');
    const inserted = marks.filter((mark) => mark.diff === 'insert').map((mark) => mark.text).join('');
    const deleted = marks.filter((mark) => mark.diff === 'delete').map((mark) => mark.text).join('');
    expect(inserted).toBe('很好');
    expect(deleted).toBe('不错');
    expect(marks.some((mark) => mark.text.includes('今天'))).toBe(false);
  });

  it('代码块整块替换，不把两边的字揉进同一块', () => {
    const marks = diffAnnotations('```\nfoo\n```', '```\nbar\n```');
    const inserted = marks.find((mark) => mark.diff === 'insert');
    const deleted = marks.find((mark) => mark.diff === 'delete');
    expect(inserted?.text).toContain('foo');
    expect(inserted?.text).not.toContain('bar');
    expect(deleted?.text).toContain('bar');
    expect(deleted?.text).not.toContain('foo');
    expect(marks.some((mark) => mark.diff === 'format')).toBe(false);
  });

  it('文字相同只是标记不同时不高亮', () => {
    expect(diffAnnotations('**bold**', 'bold')).toEqual([]);
  });

  it('表格对齐空格不算修改', () => {
    const spaced = ['| 收入 | 100 |', '| --- | --- |', '| 甲 | 1 |'].join('\n');
    const padded = ['| 收入  |  100 |', '| --- | --- |', '| 甲  |  1 |'].join('\n');
    expect(diffAnnotations(spaced, padded)).toEqual([]);
  });

  it('列表项分别对齐，没改的项不高亮', () => {
    const marks = diffAnnotations('- 甲\n- 乙\n', '- 甲\n- 丙\n');
    const inserted = marks.filter((mark) => mark.diff === 'insert').map((mark) => mark.text).join('');
    const deleted = marks.filter((mark) => mark.diff === 'delete').map((mark) => mark.text).join('');
    expect(inserted).toContain('乙');
    expect(deleted).toContain('丙');
    expect(inserted).not.toContain('甲');
    expect(deleted).not.toContain('甲');
  });

  it('引用往下拆开，只标出改动的段落', () => {
    const marks = diffAnnotations('> 甲\n>\n> 乙\n', '> 甲\n>\n> 丙\n');
    const inserted = marks.filter((mark) => mark.diff === 'insert').map((mark) => mark.text).join('');
    const deleted = marks.filter((mark) => mark.diff === 'delete').map((mark) => mark.text).join('');
    expect(inserted).toContain('乙');
    expect(deleted).toContain('丙');
    expect(marks.some((mark) => mark.text.includes('甲'))).toBe(false);
  });
});
