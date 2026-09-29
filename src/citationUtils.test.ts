import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import {
  applyCitationSources,
  enrichMarkdownCitations,
  extractFootnoteSources,
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

describe('extractFootnoteSources', () => {
  it('无定义行时原样返回、sources 为空', () => {
    const md = '营收下滑[^1]。';
    const out = extractFootnoteSources(md);
    expect(out.markdown).toBe(md);
    expect(out.sources).toEqual([]);
  });

  it('剥离定义行并解析 url / title / excerpt', () => {
    const out = extractFootnoteSources(
      '收益 12.3%[^1]，回撤 8.1%[^2]。\n\n[^1]: [东方财富研报](https://example.com/r1)\n[^2]: 中金研报第 3 页',
    );
    expect(out.markdown).toBe('收益 12.3%[^1]，回撤 8.1%[^2]。');
    expect(out.sources).toEqual([
      {
        index: '1',
        url: 'https://example.com/r1',
        title: '东方财富研报',
        excerpt: '东方财富研报',
      },
      { index: '2', title: '中金研报第 3 页', excerpt: '中金研报第 3 页' },
    ]);
  });

  it('围栏代码块内的定义行不剥离', () => {
    const out = extractFootnoteSources(
      '正文[^1]。\n\n```text\n[^1]: [假的](https://example.com/fake)\n```\n\n[^1]: [真来源](https://example.com/real)',
    );
    expect(out.markdown).toContain('```text');
    expect(out.markdown).toContain('[^1]: [假的](https://example.com/fake)');
    expect(out.sources).toEqual([
      { index: '1', url: 'https://example.com/real', title: '真来源', excerpt: '真来源' },
    ]);
  });

  it('~~~ 围栏同样跳过', () => {
    const out = extractFootnoteSources(
      '~~~\n[^2]: 围栏内\n~~~\n\n结论[^2]。\n\n[^2]: [真](https://example.com/t)',
    );
    expect(out.markdown).toContain('~~~\n[^2]: 围栏内\n~~~');
    expect(out.sources).toEqual([
      { index: '2', url: 'https://example.com/t', title: '真', excerpt: '真' },
    ]);
  });

  it('多行定义：缩进续行并入 excerpt，title 取首行', () => {
    const out = extractFootnoteSources(
      '结论[^1]。\n\n[^1]: 长来源第一行\n    续行第二行\n    续行第三行\n\n后续段落',
    );
    expect(out.markdown).toBe('结论[^1]。\n\n后续段落');
    expect(out.sources).toEqual([
      {
        index: '1',
        title: '长来源第一行',
        excerpt: '长来源第一行\n续行第二行\n续行第三行',
      },
    ]);
  });

  it('URL 带一层配对括号完整解析', () => {
    const out = extractFootnoteSources(
      '见[^1]。\n\n[^1]: [Python](https://en.wikipedia.org/wiki/Python_(programming_language))',
    );
    expect(out.sources[0].url).toBe(
      'https://en.wikipedia.org/wiki/Python_(programming_language)',
    );
    expect(out.sources[0].title).toBe('Python');
  });

  it('`<...>` 包裹的 URL 支持空格', () => {
    const out = extractFootnoteSources(
      '见[^1]。\n\n[^1]: [docs](<https://example.com/a b>)',
    );
    expect(out.sources[0].url).toBe('https://example.com/a b');
  });

  it('同一 label 重复定义取首次', () => {
    const out = extractFootnoteSources('x[^1]\n\n[^1]: 第一\n[^1]: 第二');
    expect(out.markdown).toBe('x[^1]');
    expect(out.sources).toEqual([{ index: '1', title: '第一', excerpt: '第一' }]);
  });

  it('流式半行定义 best-effort：剥离、无 url', () => {
    const out = extractFootnoteSources('正文[^1]。\n\n[^1]: [原文](htt');
    expect(out.markdown).toBe('正文[^1]。');
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0].index).toBe('1');
    expect(out.sources[0].url).toBeUndefined();
  });

  it('行首 0–3 空格的定义仍识别', () => {
    const out = extractFootnoteSources('见[^2]。\n\n  [^2]: 缩进定义');
    expect(out.sources[0].index).toBe('2');
    expect(out.markdown).toBe('见[^2]。');
  });

  it('与 enrichMarkdownCitations 组合：抽出的 sources 命中正文标记', () => {
    const { markdown: body, sources } = extractFootnoteSources(
      '结论[^1]。\n\n[^1]: [研报](https://example.com/x)',
    );
    const enriched = enrichMarkdownCitations(body, sources);
    expect(enriched).toContain('data-url="https://example.com/x"');
    expect(enriched).toContain('class="citation-ref"');
    expect(enriched).not.toContain('[^1]');
  });
});
