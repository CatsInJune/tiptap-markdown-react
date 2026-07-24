import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import {
  applyCitationSources,
  enrichMarkdownCitations,
  type SourceRef,
} from './citationUtils';

const SOURCES: SourceRef[] = [
  {
    index: '1',
    url: 'https://example.com/a',
    title: 'Source A',
    excerpt: 'excerpt one',
  },
  {
    index: '3',
    url: 'https://example.com/c',
    title: 'Title "quoted"',
  },
];

describe('enrichMarkdownCitations', () => {
  it('空 sources 时原样返回', () => {
    const md = '营收下滑[^1]。';
    expect(enrichMarkdownCitations(md, [])).toBe(md);
  });

  it('匹配到 source 时换成 span.citation-ref（非 sup）', () => {
    const out = enrichMarkdownCitations('同比 -4.53%）[^1]，结构未变[^3]。', SOURCES);
    expect(out).toContain('class="citation-ref"');
    expect(out).toContain('data-index="1"');
    expect(out).toContain('data-url="https://example.com/a"');
    expect(out).toContain('data-index="3"');
    expect(out).not.toContain('<sup');
    expect(out).not.toContain('[^1]');
    expect(out).not.toContain('[^3]');
  });

  it('未匹配的 [^n] 原样保留', () => {
    const out = enrichMarkdownCitations('有来源[^1]，无来源[^9]。', SOURCES);
    expect(out).toContain('data-index="1"');
    expect(out).toContain('[^9]');
  });

  it('无 url 的 source 仍产出圆标 span', () => {
    const out = enrichMarkdownCitations('注[^2]', [{ index: '2', title: '仅标题' }]);
    expect(out).toBe(
      '注<span class="citation-ref" data-index="2" data-title="仅标题">2</span>',
    );
  });

  it('转义 title / url 中的引号与尖括号', () => {
    const out = enrichMarkdownCitations('x[^3]', SOURCES);
    expect(out).toContain('data-title="Title &quot;quoted&quot;"');
  });
});

describe('applyCitationSources', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'hello ' },
          { type: 'citationRef', attrs: { index: '1', url: null, title: null } },
          { type: 'text', text: ' and ' },
          { type: 'citationRef', attrs: { index: '9', url: null, title: null } },
        ],
      },
    ],
  };

  it('按 index 补 url/title，未命中的节点不动', () => {
    const next = applyCitationSources(doc, SOURCES);
    const nodes = next.content![0].content!;
    expect(nodes[1]).toEqual({
      type: 'citationRef',
      attrs: {
        index: '1',
        url: 'https://example.com/a',
        title: 'Source A',
      },
    });
    expect(nodes[3]).toEqual({
      type: 'citationRef',
      attrs: { index: '9', url: null, title: null },
    });
  });

  it('不修改原 doc（浅不可变）', () => {
    const snapshot = JSON.stringify(doc);
    applyCitationSources(doc, SOURCES);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('空 sources 返回同一引用', () => {
    expect(applyCitationSources(doc, [])).toBe(doc);
  });
});
