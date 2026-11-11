import { describe, expect, it } from 'vitest';
import { chunkMarkdownBlocks, splitTopLevelMarkdown } from './splitMarkdownBlocks';

describe('splitTopLevelMarkdown', () => {
  it('空行分开的段落各自成块', () => {
    expect(splitTopLevelMarkdown('甲\n\n乙')).toEqual(['甲', '乙']);
  });

  it('围栏里的空行留在同一块', () => {
    const markdown = '```\nfoo\n\nbar\n```\n\n后';
    expect(splitTopLevelMarkdown(markdown)).toEqual(['```\nfoo\n\nbar\n```', '后']);
  });

  it('表格留在同一块', () => {
    const markdown = ['| 甲 | 乙 |', '| --- | --- |', '| 1 | 2 |', '', '后'].join('\n');
    expect(splitTopLevelMarkdown(markdown)[0]).toContain('| 1 | 2 |');
    expect(splitTopLevelMarkdown(markdown)[1]).toBe('后');
  });

  it('列表项留在同一块', () => {
    const markdown = '- 甲\n- 乙\n\n后';
    expect(splitTopLevelMarkdown(markdown)).toEqual(['- 甲\n- 乙', '后']);
  });

  it('details 留在同一块', () => {
    const markdown = '<details>\n<summary>题</summary>\n\n正文\n\n</details>\n\n后';
    const blocks = splitTopLevelMarkdown(markdown);
    expect(blocks[0]).toContain('正文');
    expect(blocks[0]).toContain('</details>');
    expect(blocks[1]).toBe('后');
  });
});

describe('chunkMarkdownBlocks', () => {
  it('短文整篇放进首屏', () => {
    const chunks = chunkMarkdownBlocks(['甲', '乙'], 8000);
    expect(chunks).toEqual({ first: '甲\n\n乙', rest: [] });
  });

  it('长文首屏不超过预算太多，其余打包', () => {
    const blocks = Array.from({ length: 10 }, (_, index) => '段'.repeat(1000) + index);
    const chunks = chunkMarkdownBlocks(blocks, 2500, 3000);
    expect(chunks.first.length).toBeGreaterThan(0);
    expect(chunks.first.length).toBeLessThan(5000);
    expect(chunks.rest.length).toBeGreaterThan(0);
    expect([chunks.first, ...chunks.rest].join('\n\n')).toContain('段段');
  });
});
