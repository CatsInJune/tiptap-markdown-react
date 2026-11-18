import { describe, expect, it } from 'vitest';
import { renderReportHtml } from './renderReportHtml';

const MARKDOWN = '正文[^1]';

describe('citation URL 安全（SSR）', () => {
  it('javascript: 来源不会出现在产出的 href / data-url 里', () => {
    const r = renderReportHtml(MARKDOWN, {
      sources: [{ index: '1', url: 'javascript:alert(1)', title: '危险来源' }],
    });
    expect(r.ok).toBe(true);
    expect(r.html).not.toContain('javascript:');
    expect(r.html).not.toContain('data-url=');
    expect(r.html).toContain('data-index="1"');
    expect(r.html).toContain('危险来源');
  });

  it('data: 来源同样被丢弃', () => {
    const r = renderReportHtml(MARKDOWN, {
      sources: [
        {
          index: '1',
          url: 'data:text/html,<script>alert(1)</script>',
          title: 'data',
        },
      ],
    });
    expect(r.html).not.toContain('data:text/html');
  });

  it('https 来源照常渲染成可点击链接', () => {
    const r = renderReportHtml(MARKDOWN, {
      sources: [{ index: '1', url: 'https://example.com/a', title: '正常来源' }],
    });
    expect(r.html).toContain('href="https://example.com/a"');
    expect(r.html).toContain('data-url="https://example.com/a"');
  });
});
