import { describe, expect, it, vi } from 'vitest';

// 让 generateTocIds 固定抛错，验证 renderReportHtml 的降级出口。其余导出保留真实实现。
vi.mock('@tiptap/extension-table-of-contents', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tiptap/extension-table-of-contents')>();
  return {
    ...actual,
    generateTocIds: () => {
      throw new Error('boom: Invalid content for node listItem');
    },
  };
});

const { renderReportHtml } = await import('./renderReportHtml');

describe('renderReportHtml：TOC 管线降级', () => {
  it('正文照常输出，toc 为空，tocDegraded 标记为 true', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = renderReportHtml('## 标题\n\n正文');
    warn.mockRestore();

    expect(result.ok).toBe(true);
    expect(result.html).toContain('正文');
    expect(result.toc).toEqual([]);
    expect(result.tocDegraded).toBe(true);
  });

  it('调用方可以据此区分「文档没有标题」和「目录丢了」', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const withHeadings = renderReportHtml('## 标题');
    const withoutHeadings = renderReportHtml('正文');
    warn.mockRestore();

    expect(withHeadings.tocDegraded).toBe(true);
    expect(withoutHeadings.tocDegraded).toBe(true);
    // 两者 toc 都是空，只有 tocDegraded 能说明这次是降级而非文档本身没有标题。
    expect(withHeadings.toc).toEqual([]);
    expect(withoutHeadings.toc).toEqual([]);
  });
});
