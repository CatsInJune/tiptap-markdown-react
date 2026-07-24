import { MarkdownManager } from '@tiptap/markdown';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { CitationRef } from './CitationRef';
import { applyCitationSources } from './citationUtils';
import { baseExtensions, pureCodeBlock, pureImage } from './extensions';
import { renderReportHtml } from './renderReportHtml';

function findCitationNodes(doc: JSONContent): JSONContent[] {
  const found: JSONContent[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'citationRef') found.push(node);
    node.content?.forEach(walk);
  };
  walk(doc);
  return found;
}

describe('CitationRef markdownTokenizer', () => {
  const manager = new MarkdownManager({
    extensions: [
      ...baseExtensions,
      pureCodeBlock,
      pureImage,
      CitationRef,
      TableOfContents,
    ],
  });

  it('把 [^n] 解析成 citationRef 节点（非纯文本）', () => {
    const doc = manager.parse(
      '营收 1,688 亿元（同比 -1.21%）[^1]，结构未变[^3]。',
    ) as JSONContent;
    const citations = findCitationNodes(doc);
    expect(citations).toHaveLength(2);
    expect(citations[0].attrs?.index).toBe('1');
    expect(citations[1].attrs?.index).toBe('3');
  });

  it('serialize 回 [^n]', () => {
    const md = '事实陈述[^2]。';
    const doc = manager.parse(md) as JSONContent;
    const out = manager.serialize(doc);
    expect(out).toContain('[^2]');
    expect(out).not.toContain('citation-ref');
  });

  it('applyCitationSources 后仍可 serialize', () => {
    const doc = applyCitationSources(
      manager.parse('引用[^1]') as JSONContent,
      [{ index: '1', url: 'https://example.com', title: 'T' }],
    );
    const citations = findCitationNodes(doc);
    expect(citations[0].attrs?.url).toBe('https://example.com');
    expect(manager.serialize(doc)).toContain('[^1]');
  });

  it('CitationRef 可与 baseExtensions 组合（不在 base 内，需显式注入）', () => {
    expect(baseExtensions.some((ext) => ext.name === CitationRef.name)).toBe(
      false,
    );
    expect(CitationRef.name).toBe('citationRef');
  });
});

describe('renderReportHtml + citations', () => {
  it('HTML 含居中圆标 span.citation-ref，且不是 sup', () => {
    const { html } = renderReportHtml('毛利率 93.53%[^1]。', {
      sources: [{ index: '1', url: 'https://example.com/report' }],
    });
    expect(html).toContain('citation-ref');
    expect(html).toContain('data-index="1"');
    expect(html).toContain('https://example.com/report');
    expect(html).not.toMatch(/<sup[^>]*class="citation-ref"/);
  });

  it('无 sources 时仍渲染圆标（仅无链接）', () => {
    const { html } = renderReportHtml('仅角标[^7]。');
    expect(html).toContain('citation-ref');
    expect(html).toContain('data-index="7"');
  });

  it('兼容旧签名 lockedTitles: string[]', () => {
    const { toc } = renderReportHtml('# Intro\n\n## Locked\n\nbody[^1]', [
      'Locked',
    ]);
    const locked = toc.find((t) => t.text === 'Locked');
    expect(locked?.locked).toBe(true);
  });
});
