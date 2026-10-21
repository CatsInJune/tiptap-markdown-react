import { describe, expect, it } from 'vitest';
import { renderReportHtml } from './renderReportHtml';

/**
 * 字号 / 颜色导出的 `<span style>` 在 server 端（无 window / DOMParser）也要解析内层 markdown。
 * 官方管线会把开闭标签之间的原文拼回去；没有 tokenizer 时 `**加粗**` 会原样留在 span 里。
 */
const text = '启示一：IP的价值不在产品，而在意义';

describe('字号/颜色：server 端渲染内层 markdown', () => {
  it('字号 span 里的 **加粗** 渲染成 strong，而不是字面星号', () => {
    const { html, ok } = renderReportHtml(
      `<span style="font-size:24px">**${text}**</span>`,
      { includeToc: false },
    );
    expect(ok).toBe(true);
    expect(html).toContain(
      `<span style="font-size: 24px"><strong>${text}</strong></span>`,
    );
    expect(html).not.toContain('**');
    expect(html).not.toContain('&lt;span');
  });

  it('颜色和字号可以叠在同一 span 上，内层加粗仍然解析', () => {
    const { html, ok } = renderReportHtml(
      `<span style="color:#ff0000;font-size:24px">**${text}**</span>`,
      { includeToc: false },
    );
    expect(ok).toBe(true);
    expect(html).toContain(
      `<span style="color: #ff0000; font-size: 24px"><strong>${text}</strong></span>`,
    );
    expect(html).not.toContain('**');
  });

  it('只给片段加粗时，星号不会漏到其余正文', () => {
    const { html } = renderReportHtml(
      '<span style="font-size:24px">启示**一**</span>',
      { includeToc: false },
    );
    expect(html).toContain('<span style="font-size: 24px">启示</span>');
    expect(html).toContain(
      '<span style="font-size: 24px"><strong>一</strong></span>',
    );
    expect(html).not.toContain('**');
  });

  it('span 里的链接和行内代码照常解析', () => {
    const { html } = renderReportHtml(
      '<span style="font-size:18px">**[原文](https://example.com)** 与 `**x**`</span>',
      { includeToc: false },
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<strong>原文</strong>');
    expect(html).toContain(
      '<span style="font-size: 18px"><code>**x**</code></span>',
    );
    expect(html).not.toContain('**原文**');
  });

  it('嵌套 span 按深度闭合，内层颜色和加粗都保留', () => {
    const { html } = renderReportHtml(
      '<span style="font-size:24px">外<span style="color:#ff0000">**内**</span></span>',
      { includeToc: false },
    );
    expect(html).toContain('外');
    expect(html).toContain('font-size: 24px');
    expect(html).toContain('color: #ff0000');
    expect(html).toContain('<strong>');
    expect(html).toContain('内');
    expect(html).not.toContain('**');
  });

  it('不认识的 style 不抢，避免把无关 span 当成字号', () => {
    const { html } = renderReportHtml(
      '<span style="display:inline">**x**</span>',
      { includeToc: false },
    );
    expect(html).not.toContain('<strong>x</strong>');
    expect(html).toContain('**x**');
  });
});
