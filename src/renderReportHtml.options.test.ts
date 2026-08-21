import { describe, expect, it } from 'vitest';
import { renderReportHtml } from './renderReportHtml';

const REPORT = [
  '# 报告标题',
  '',
  '开篇段落。',
  '',
  '## 第一节',
  '',
  '第一节内容。',
].join('\n');

describe('renderReportHtml options', () => {
  it('默认产出 toc 与 heading 锚点，ok=true', () => {
    const r = renderReportHtml(REPORT);
    expect(r.ok).toBe(true);
    expect(r.toc.length).toBeGreaterThan(0);
    expect(r.html).toContain(r.toc[0].id);
    expect(r.html).toContain('报告标题');
  });

  it('includeToc:false 不跑目录、正文仍在', () => {
    const r = renderReportHtml(REPORT, { includeToc: false });
    expect(r.ok).toBe(true);
    expect(r.toc).toEqual([]);
    expect(r.html).toContain('报告标题');
    expect(r.html).toContain('第一节内容');
  });

  it('空内容 ok=true 且 html 为空', () => {
    expect(renderReportHtml('')).toEqual({ html: '', toc: [], ok: true });
    expect(renderReportHtml('   \n  ')).toEqual({ html: '', toc: [], ok: true });
  });

  it('stabilize 让未闭合 fence 的后文不再被吞进 code', () => {
    const partial = [
      '## 业绩',
      '',
      '营收增长。',
      '',
      '```python',
      'print(1)',
    ].join('\n');

    const raw = renderReportHtml(partial, { includeToc: false });
    const fixed = renderReportHtml(partial, {
      includeToc: false,
      stabilize: true,
    });

    expect(fixed.ok).toBe(true);
    expect(fixed.html).toContain('营收增长');
    expect(fixed.html).toContain('print(1)');
    // 未 stabilize 时未闭合 fence 会把 print 留在 code 里；stabilize 后仍有 code，
    // 但不会把 fence 前的标题吃掉。
    expect(raw.html).toContain('业绩');
    expect(fixed.html).toContain('业绩');
  });
});
