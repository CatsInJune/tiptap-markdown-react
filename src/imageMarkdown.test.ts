import { describe, expect, it } from 'vitest';
import { imageRenderMarkdown } from './imageMarkdown';
import { normalizeMarkdown } from './normalizeMarkdown';

describe('imageRenderMarkdown 转义', () => {
  it('普通图片保持标准 `![alt](src "title")`', () => {
    expect(
      imageRenderMarkdown({ attrs: { src: 'https://e.com/a.png', alt: '图' } }),
    ).toBe('![图](https://e.com/a.png)');
    expect(
      imageRenderMarkdown({
        attrs: { src: 'https://e.com/a.png', alt: '图', title: '标题' },
      }),
    ).toBe('![图](https://e.com/a.png "标题")');
  });

  it('URL 含空格 / alt 含 ] / title 含引号时回退 HTML 形式并往返', () => {
    const cases = [
      { src: 'https://e.com/a b.png', alt: '图[1]', title: 't"q' },
      { src: 'https://e.com/a b.png', alt: 'x' },
      { src: 'https://e.com/a(b.png', alt: 'x' },
      { src: 'https://e.com/a.png', alt: 'x', title: 'line\nbreak' },
    ];
    for (const attrs of cases) {
      const md = imageRenderMarkdown({ attrs });
      expect(md.startsWith('<img')).toBe(true);
      // 重新解析 → 再序列化，结构不丢、不变成文字 + 链接。
      expect(normalizeMarkdown(md)).toBe(md);
    }
  });

  it('成对括号的 URL 仍走标准语法', () => {
    const md = imageRenderMarkdown({
      attrs: { src: 'https://e.com/a(b).png', alt: 'x' },
    });
    expect(md).toBe('![x](https://e.com/a(b).png)');
  });
});
