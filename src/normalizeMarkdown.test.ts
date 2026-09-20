import { describe, expect, it } from 'vitest';
import { normalizeMarkdown } from './normalizeMarkdown';

/** 幂等：规范化过的正文再规范化一次必须逐字不变。 */
function expectIdempotent(markdown: string) {
  const once = normalizeMarkdown(markdown);
  expect(normalizeMarkdown(once)).toBe(once);
  return once;
}

describe('normalizeMarkdown：不该被改动的结构', () => {
  it('标题 / 段落 / 加粗斜体 / 列表 / 引用 原样通过', () => {
    const md = [
      '## 核心结论',
      '',
      '公司**营收**保持*增长*，渠道结构改善。',
      '',
      '- 要点一',
      '- 要点二',
      '',
      '> 引用一段话。',
    ].join('\n');
    expect(normalizeMarkdown(md)).toBe(md);
  });

  it('代码块与公式原样通过', () => {
    const md = [
      '看这段：',
      '',
      '```python',
      'x = 1',
      '```',
      '',
      '行内公式 $a = 1$ 与块级公式：',
      '',
      '$$y = 2$$',
    ].join('\n');
    const out = normalizeMarkdown(md);
    expect(out).toContain('```python\nx = 1\n```');
    expect(out).toContain('$a = 1$');
    expect(out).toContain('$$y = 2$$');
    expectIdempotent(out);
  });

  it('脚注 [^n] 不丢（不需要 sources）', () => {
    const md = ['营收增长。[^1]', '', '结论不变。[^2]'].join('\n');
    const out = normalizeMarkdown(md);
    expect(out).toContain('[^1]');
    expect(out).toContain('[^2]');
    expectIdempotent(out);
  });

  it('图表仍是「注释 + 表」的作者形态，不会变成 tmr-chart 围栏', () => {
    const md = [
      '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
    ].join('\n');
    const out = normalizeMarkdown(md);
    expect(out).toContain('<!-- {');
    expect(out).toContain('"chartType":"column"');
    expect(out).not.toContain('```tmr-chart');
    expectIdempotent(out);
  });
});

describe('normalizeMarkdown：已知会被规范化的结构', () => {
  it('图表注释 JSON 去空格', () => {
    const md = [
      '<!-- {"chartType": "column", "x": "项目", "y": "金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
    ].join('\n');
    const out = normalizeMarkdown(md);
    expect(out).toContain('{"chartType":"column"');
    expect(out).not.toContain('"chartType": "column"');
  });

  it('表格按列宽重排（列宽随内容变化）', () => {
    const md = ['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n');
    const out = normalizeMarkdown(md);
    // 单字符列也会被补齐到分隔符宽度，具体空格数不重要——重要的是幂等
    expect(out).toContain('| a');
    expect(out).toContain('| b');
    expectIdempotent(out);
  });

  it('普通表格的数值保持原样（只有列宽会变）', () => {
    const md = ['| 项目 | 金额 |', '| --- | --- |', '| 收入 | 1,234.50 |'].join('\n');
    const out = normalizeMarkdown(md);
    // 普通 GFM 表格走 marked 的表格解析，单元格是文本、不做数字转换
    expect(out).toContain('1,234.50');
    expectIdempotent(out);
  });

  it('图表区的数值会被规范化（表格数据转成数字再写回）', () => {
    const md = [
      '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 132.0 |',
    ].join('\n');
    const out = normalizeMarkdown(md);
    // 图表把表解析成 payload（数值 → number），序列化时按数字写回
    expect(out).not.toContain('132.0');
    expect(out).toContain('| 132 |');
    expectIdempotent(out);
  });
});

describe('normalizeMarkdown：边界', () => {
  it('空串原样返回；纯空白的正文会被规整成空串', () => {
    expect(normalizeMarkdown('')).toBe('');
    // 与编辑器一致：空白-only 的正文解析成空文档，序列化即空串
    expect(normalizeMarkdown('   \n  ')).toBe('');
  });

  it('混合文档幂等（标题 / 段落 / 表 / 图表 / 列表 / 脚注）', () => {
    const md = [
      '## 概览',
      '',
      '营收保持增长。[^1]',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
      '',
      '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
      '',
      '- 要点一',
      '- 要点二',
    ].join('\n');
    const once = expectIdempotent(md);
    expect(once).toContain('## 概览');
    expect(once).toContain('[^1]');
    expect(once).toContain('"chartType":"column"');
    expect(once).toContain('- 要点一');
  });
});
