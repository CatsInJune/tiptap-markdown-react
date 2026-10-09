// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import {
  applyLink,
  canSetLink,
  isApplyKey,
  isLinkActive,
  normalizeLinkHref,
  openLinkUrl,
  readLinkHref,
  removeLink,
  sanitizeLinkUrl,
} from './linkEditing';

/**
 * 链接编辑的语义契约（逻辑照官方 UI Components 的 useLinkPopover 搬，外壳自绘）。
 *
 * 这里钉的是相对旧 `window.prompt` 的三个增量，以及地址规范化 / 白名单这两处容易写错的边界。
 */
function build(markdown: string, editable = true): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content: markdown,
    contentType: 'markdown',
    editable,
  });
}

/** 把光标放到第一段匹配文本里（offset 默认落在中间，避免正好卡在边界） */
function caretIn(editor: Editor, text: string, offset = 0): void {
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (pos === -1 && node.isText && node.text?.includes(text)) {
      pos = nodePos + Math.max(1, offset);
    }
    return true;
  });
  if (pos === -1) throw new Error(`正文里找不到「${text}」`);
  editor.commands.setTextSelection(pos);
}

/** 选中第一段匹配文本 */
function selectText(editor: Editor, text: string): void {
  let from = -1;
  let to = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (from === -1 && node.isText && node.text?.includes(text)) {
      const at = node.text.indexOf(text);
      from = nodePos + at;
      to = from + text.length;
    }
    return true;
  });
  if (from === -1) throw new Error(`正文里找不到「${text}」`);
  editor.commands.setTextSelection({ from, to });
}

describe('链接地址规范化', () => {
  it('裸域名补协议（用扩展配的 defaultProtocol，Tiptap 默认 http）', () => {
    const editor = build('x');
    expect(normalizeLinkHref(editor, 'example.com')).toBe('http://example.com');
    expect(normalizeLinkHref(editor, 'example.com/a?b=1')).toBe(
      'http://example.com/a?b=1',
    );
    // 首尾空格吃掉
    expect(normalizeLinkHref(editor, '  example.com  ')).toBe('http://example.com');
    editor.destroy();
  });

  it('已带协议 / 站内相对地址 / 邮件电话：原样保留', () => {
    const editor = build('x');
    for (const value of [
      'https://example.com',
      'mailto:hi@example.com',
      'tel:+8613800000000',
      '/docs/start',
      '#anchor',
      '?q=1',
      'foo/bar',
    ]) {
      expect(normalizeLinkHref(editor, value)).toBe(value);
    }
    editor.destroy();
  });

  it('host:port 这种「像协议、其实是主机」的输入也补协议', () => {
    const editor = build('x');
    expect(normalizeLinkHref(editor, 'localhost:3000')).toBe(
      'http://localhost:3000',
    );
    expect(normalizeLinkHref(editor, '127.0.0.1:8080/x')).toBe(
      'http://127.0.0.1:8080/x',
    );
    editor.destroy();
  });

  it('空输入 → 空串（等同于「没填」）', () => {
    const editor = build('x');
    expect(normalizeLinkHref(editor, '   ')).toBe('');
    editor.destroy();
  });
});

describe('应用链接', () => {
  it('选区套上链接', () => {
    const editor = build('看 example 就懂');
    selectText(editor, 'example');

    expect(applyLink(editor, 'https://a.example')).toBe(true);
    expect(editor.getMarkdown()).toContain('[example](https://a.example)');
    editor.destroy();
  });

  it('空选区：把地址本身当文本插进去（官方同款；否则 mark 无处可套）', () => {
    const editor = build('前面');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    expect(applyLink(editor, 'https://a.example')).toBe(true);
    expect(editor.getMarkdown()).toContain('[https://a.example](https://a.example)');
    editor.destroy();
  });

  it('改已有链接：范围扩到整条，而不是只改光标那一段', () => {
    const editor = build('[整条链接](https://old.example)');
    caretIn(editor, '整条链接', 2); // 光标落在链接中间

    expect(applyLink(editor, 'https://new.example')).toBe(true);
    expect(editor.getMarkdown()).toBe('[整条链接](https://new.example)');
    editor.destroy();
  });

  it('编辑器拒绝的地址（javascript:）返回 false，正文不动', () => {
    const editor = build('[x](https://old.example)');
    caretIn(editor, 'x');

    expect(applyLink(editor, 'javascript:alert(1)')).toBe(false);
    expect(editor.getMarkdown()).toBe('[x](https://old.example)');
    editor.destroy();
  });

  it('空地址不做任何事', () => {
    const editor = build('看 example');
    selectText(editor, 'example');
    expect(applyLink(editor, '   ')).toBe(false);
    expect(editor.getMarkdown()).toBe('看 example');
    editor.destroy();
  });
});

describe('移除链接', () => {
  it('光标在链接中间也能整条摘掉', () => {
    const editor = build('前面 [整条链接](https://a.example) 后面');
    caretIn(editor, '整条链接', 2);

    expect(removeLink(editor)).toBe(true);
    expect(editor.getMarkdown()).toBe('前面 整条链接 后面');
    editor.destroy();
  });
});

describe('读链接状态', () => {
  it('isLinkActive / readLinkHref 跟着光标走', () => {
    const editor = build('[链接](https://a.example) 末尾');
    caretIn(editor, '链接');
    expect(isLinkActive(editor)).toBe(true);
    expect(readLinkHref(editor)).toBe('https://a.example');

    caretIn(editor, '末尾');
    expect(isLinkActive(editor)).toBe(false);
    expect(readLinkHref(editor)).toBe('');
    editor.destroy();
  });

  it('只读态不能改链接（canSetLink 为 false）', () => {
    const editor = build('[链接](https://a.example)', false);
    expect(canSetLink(editor)).toBe(false);
    editor.destroy();
  });
});

describe('打开地址前的白名单', () => {
  const base = 'https://site.example/page';

  it('允许的协议原样返回绝对地址', () => {
    expect(sanitizeLinkUrl('https://a.example', base)).toBe('https://a.example/');
    expect(sanitizeLinkUrl('mailto:hi@example.com', base)).toBe(
      'mailto:hi@example.com',
    );
    // 相对地址按 base 解析
    expect(sanitizeLinkUrl('/docs', base)).toBe('https://site.example/docs');
  });

  it('不允许的协议 / 解析不了的输入 → "#"（表示别打开）', () => {
    expect(sanitizeLinkUrl('javascript:alert(1)', base)).toBe('#');
    expect(sanitizeLinkUrl('data:text/html,<b>x</b>', base)).toBe('#');
    expect(sanitizeLinkUrl('', base)).toBe(base);
  });

  it('openLinkUrl：非法地址不开窗', () => {
    const opened: string[] = [];
    const original = window.open;
    window.open = ((url: string) => {
      opened.push(url);
      return null;
    }) as typeof window.open;

    expect(openLinkUrl('javascript:alert(1)', base)).toBe(false);
    expect(openLinkUrl('https://a.example', base)).toBe(true);
    expect(opened).toEqual(['https://a.example/']);

    window.open = original;
  });
});

describe('回车应用（输入法守卫）', () => {
  it('普通回车算应用，组合中的回车不算', () => {
    const plain = new KeyboardEvent('keydown', { key: 'Enter' });
    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
    });

    expect(isApplyKey({ key: 'Enter', nativeEvent: plain })).toBe(true);
    expect(isApplyKey({ key: 'Enter', nativeEvent: composing })).toBe(false);
    expect(isApplyKey({ key: 'a', nativeEvent: plain })).toBe(false);
  });
});
