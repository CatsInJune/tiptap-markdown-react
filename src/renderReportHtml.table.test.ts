import { describe, expect, it } from 'vitest';
import { renderReportHtml } from './renderReportHtml';

describe('renderReportHtml tables', () => {
  it('SSR 表格外包 tableWrapper，供窄屏 overflow-x 横滑', () => {
    const md = [
      '| 指标 | Amazon | Microsoft | Alphabet |',
      '| --- | --- | --- | --- |',
      '| Capex | 531亿 | 300亿 | 200亿 |',
    ].join('\n');

    const { html } = renderReportHtml(md);

    expect(html).toContain('class="tableWrapper"');
    expect(html).toMatch(
      /<div class="tableWrapper">[\s\S]*?<table\b[\s\S]*?<\/table><\/div>/,
    );
    expect(html).toContain('Amazon');
    expect(html).toContain('Capex');
  });

  it('无表格时不注入 tableWrapper', () => {
    const { html } = renderReportHtml('## 标题\n\n一段正文。');
    expect(html).not.toContain('tableWrapper');
    expect(html).not.toContain('<table');
  });
});
