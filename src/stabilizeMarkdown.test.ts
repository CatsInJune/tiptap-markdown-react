import { describe, expect, it } from 'vitest';
import { stabilizeMarkdown } from './stabilizeMarkdown';

describe('stabilizeMarkdown', () => {
  it('完整稿原样返回', () => {
    const md = '# 标题\n\n一段正文。\n';
    expect(stabilizeMarkdown(md)).toBe(md);
  });

  it('已闭合 fence 原样返回', () => {
    const md = '前文\n```ts\nconst x = 1;\n```\n后文';
    expect(stabilizeMarkdown(md)).toBe(md);
  });

  it('未闭合 ``` 在末尾补闭合', () => {
    const md = '前文\n```python\nprint(1)';
    expect(stabilizeMarkdown(md)).toBe(`${md}\n\`\`\``);
  });

  it('未闭合 fence 且原文已换行时不重复换行', () => {
    const md = '```\nhello\n';
    expect(stabilizeMarkdown(md)).toBe('```\nhello\n```');
  });

  it('~~~ 围栏同样补闭合', () => {
    const md = '~~~js\ncode';
    expect(stabilizeMarkdown(md)).toBe('~~~js\ncode\n~~~');
  });

  it('空串原样', () => {
    expect(stabilizeMarkdown('')).toBe('');
  });
});
