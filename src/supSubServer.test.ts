import { describe, expect, it } from 'vitest';
import { renderReportHtml } from './renderReportHtml';

/**
 * 上标 / 下标导出的行内 HTML 在 server 端（无 window / DOMParser）也要能解析。
 * 官方管线对没被扩展认领的行内 HTML 会退化成转义字面文本；<sup>/<sub> 自带
 * 行内 tokenizer（见 extensions.ts 的 htmlTagTokenizer），故这里断言真实标签。
 */
describe('上标/下标：server 端渲染', () => {
  it('markdown 里的 <sup>/<sub> 渲染成标签而不是字面文本', () => {
    const { html, ok } = renderReportHtml('H<sub>2</sub>O 与 x<sup>2</sup>。', {
      includeToc: false,
    });
    expect(ok).toBe(true);
    expect(html).toContain('<sub>2</sub>');
    expect(html).toContain('<sup>2</sup>');
    expect(html).not.toContain('&lt;sup&gt;');
    expect(html).not.toContain('&lt;sub&gt;');
  });

  it('内层 markdown 照常解析', () => {
    const { html } = renderReportHtml('x<sup>**2**</sup>', { includeToc: false });
    expect(html).toContain('<sup>');
    expect(html).toContain('<strong>2</strong>');
  });
});
