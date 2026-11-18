import { describe, expect, it } from 'vitest';
import { extractToc } from './extractToc';

describe('extractToc', () => {
  it('标题里的行内原子节点不会从目录文字里消失', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, 'data-toc-id': 'price' },
          content: [
            { type: 'text', text: '价格 ' },
            { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
            { type: 'emoji', attrs: { name: 'rocket' } },
            { type: 'citationRef', attrs: { index: '1' } },
          ],
        },
      ],
    };
    expect(extractToc(doc)).toEqual([
      {
        id: 'price',
        level: 2,
        text: '价格 E=mc^2:rocket:[^1]',
        locked: undefined,
      },
    ]);
  });

  it('空标题 / 未注入锚点的标题不入目录', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [] },
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '没有 id' }],
        },
      ],
    };
    expect(extractToc(doc)).toEqual([]);
  });
});
