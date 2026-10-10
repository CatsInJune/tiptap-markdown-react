// @vitest-environment happy-dom
import type { JSONContent, ResizableNodeViewDirection } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions, pureImage } from './extensions';
import {
  ImageWithConfirmDelete,
  type ImageResizeOptions,
} from './components/MarkdownWysiwygEditor';
import { renderReportHtml } from './renderReportHtml';
import { resetImageSize } from './resetImageSize';

const SIZED_MD =
  '<img src="https://x/a.png" alt="a" width="300" height="200">';

function build(opts: {
  imageResize?: boolean | ImageResizeOptions;
  editable?: boolean;
  content?: string;
} = {}) {
  // 复刻 MarkdownWysiwygEditor 的接线（含本库默认：左右手柄、等比、min 80）
  const resize =
    opts.imageResize === false
      ? false
      : {
          enabled: true,
          alwaysPreserveAspectRatio: true,
          directions: ['left', 'right'] as ResizableNodeViewDirection[],
          minWidth: 80,
          minHeight: 80,
          ...(typeof opts.imageResize === 'object' ? opts.imageResize : null),
        };
  return new Editor({
    extensions: [
      ...baseExtensions,
      ImageWithConfirmDelete.configure({ inline: false, resize }),
      Markdown,
    ],
    content: opts.content ?? '',
    contentType: 'markdown',
    editable: opts.editable ?? true,
  });
}

function handlesIn(editor: Editor): number {
  return editor.view.dom.querySelectorAll('[data-resize-handle]').length;
}

function imageAttrs(json: JSONContent): Record<string, unknown> | undefined {
  const img = (json.content ?? []).find((n) => n.type === 'image');
  return img?.attrs as Record<string, unknown> | undefined;
}

/**
 * 图片尺寸的 markdown 往返（A 方案）与缩放接线：
 * 带尺寸 → `<img …>` 保真；无尺寸 → 标准 `![alt](url)`；三端（编辑器 / 预览 / server）
 * 走同一条解析路径；只读态不露手柄；resetImageSize 提供「反悔」出口。
 */
describe('图片尺寸的 markdown 往返', () => {
  it('序列化：带尺寸输出 <img>，无尺寸保持标准语法', () => {
    const editor = build();
    editor.commands.setImage({
      src: 'https://x/a.png',
      alt: 'a',
      title: 'a',
    });
    expect(editor.getMarkdown()).toContain('![a](https://x/a.png "a")');

    editor.commands.setImage({
      src: 'https://x/b.png',
      alt: 'b',
      width: 300,
      height: 200,
    });
    expect(editor.getMarkdown()).toContain(
      '<img src="https://x/b.png" alt="b" width="300" height="200">',
    );
    editor.destroy();
  });

  it('解析：<img …> 还原成带尺寸的图片节点', () => {
    const editor = build({ content: SIZED_MD });
    expect(imageAttrs(editor.getJSON())).toMatchObject({
      src: 'https://x/a.png',
      alt: 'a',
      width: 300,
      height: 200,
    });
    editor.destroy();
  });

  it('往返幂等：解析再序列化回到同一段 markdown', () => {
    const editor = build({ content: SIZED_MD });
    expect(editor.getMarkdown().trim()).toBe(SIZED_MD);
    editor.destroy();
  });

  it('属性转义与还原对称（URL 里的 & 等）', () => {
    const editor = build();
    editor.commands.setImage({
      src: 'https://x/a.png?a=1&b=2',
      alt: 'x',
      width: 120,
    });
    const md = editor.getMarkdown();
    expect(md).toContain('&amp;');
    editor.destroy();

    const back = build({ content: md });
    expect(imageAttrs(back.getJSON())?.src).toBe(
      'https://x/a.png?a=1&b=2',
    );
    back.destroy();
  });

  it('server 端（renderReportHtml）同样认领 <img>，不再转义成字面文本', () => {
    const rendered = renderReportHtml(SIZED_MD);
    expect(rendered.ok).toBe(true);
    expect(rendered.html).toContain('src="https://x/a.png"');
    expect(rendered.html).toContain('width="300"');
    expect(rendered.html).not.toContain('&lt;img');
  });

  it('pureImage（预览端）也认领 <img>', () => {
    const editor = new Editor({
      extensions: [...baseExtensions, pureImage, Markdown],
      content: SIZED_MD,
      contentType: 'markdown',
    });
    expect(imageAttrs(editor.getJSON())).toMatchObject({
      width: 300,
      height: 200,
    });
    editor.destroy();
  });
});

describe('图片缩放接线', () => {
  it('编辑态：左右两枚手柄挂载；关闭缩放则连 NodeView 容器都没有', () => {
    const on = build({ content: '![a](https://x/a.png)' });
    expect(handlesIn(on)).toBe(2);
    on.destroy();

    const off = build({
      imageResize: false,
      content: '![a](https://x/a.png)',
    });
    expect(handlesIn(off)).toBe(0);
    expect(
      off.view.dom.querySelectorAll('[data-resize-container]').length,
    ).toBe(0);
    off.destroy();
  });

  it('打开就是只读：手柄不出现（官方只在 update 后同步，这里创建时就摘）', () => {
    const editor = build({
      editable: false,
      content: '![a](https://x/a.png)',
    });
    expect(
      editor.view.dom.querySelectorAll('[data-resize-container]').length,
    ).toBe(1);
    expect(handlesIn(editor)).toBe(0);
    editor.destroy();
  });

  it('运行时切回编辑态：手柄能挂回来（走官方自身的 update 监听）', () => {
    const editor = build({
      editable: false,
      content: '![a](https://x/a.png)',
    });
    expect(handlesIn(editor)).toBe(0);
    editor.setEditable(true);
    expect(handlesIn(editor)).toBe(2);
    editor.destroy();
  });

  it('缩放上下限：超过 max 夹到上限、低于 min 夹到下限（等比同时约束）', () => {
    const editor = build({
      content: '![a](https://x/a.png)',
      imageResize: {
        minWidth: 100,
        minHeight: 100,
        maxWidth: 500,
        maxHeight: 500,
      },
    });
    const img = editor.view.dom.querySelector<HTMLImageElement>(
      '[data-resize-container] img',
    );
    const handle = editor.view.dom.querySelector<HTMLElement>(
      '[data-resize-handle="right"]',
    );
    if (!img || !handle) throw new Error('node view not mounted');
    // happy-dom 不做布局：把 offsetWidth/Height 模拟成「跟随内联 style」——拖拽过程中
    // 官方会把 style.width/height 写新值，mouseup 时再读 offsetWidth 提交，
    // 固定值会让提交回滚到旧尺寸（真实浏览器里它本来就跟着 style 走）。
    Object.defineProperty(img, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 400;
      },
    });
    Object.defineProperty(img, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 300;
      },
    });

    const dragBy = (deltaX: number) => {
      handle.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }),
      );
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 100 + deltaX,
          clientY: 100,
        }),
      );
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    };

    // 从 400 拖到 900 → 超过 maxWidth 500，夹到 500（等比高 = 500 ÷ 4/3 = 375）
    dragBy(500);
    expect(parseFloat(img.style.width)).toBe(500);
    expect(parseFloat(img.style.height)).toBe(375);

    // 从 500 拖到 50 → 低于 min：宽先夹到 100（高 75），高度再触底 100（宽回 133.33）
    dragBy(-450);
    expect(parseFloat(img.style.height)).toBe(100);
    expect(parseFloat(img.style.width)).toBeCloseTo(133.33, 1);
    editor.destroy();
  });
});

describe('resetImageSize', () => {
  it('清掉尺寸，让图片回到标准语法', () => {
    const editor = build({ content: SIZED_MD });
    editor.commands.setNodeSelection(0);
    expect(resetImageSize(editor)).toBe(true);

    const md = editor.getMarkdown();
    expect(md).toContain('![a](https://x/a.png)');
    expect(md).not.toContain('width=');
    editor.destroy();
  });

  it('程序化改尺寸后编辑态视觉同步（官方 update 跳过 width/height，这里补上）', () => {
    const editor = build({ content: SIZED_MD });
    const img = editor.view.dom.querySelector<HTMLImageElement>(
      '[data-resize-container] img',
    );
    // 构造时按 attrs 设过内联尺寸
    expect(img?.style.width).toBe('300px');
    expect(img?.style.height).toBe('200px');

    // 清尺寸后视觉要跟着回到自然尺寸（不补的话 style 会停在 300px）
    editor.commands.setNodeSelection(0);
    expect(resetImageSize(editor)).toBe(true);
    expect(img?.style.width).toBe('');
    expect(img?.style.height).toBe('');
    editor.destroy();
  });

  it('光标不在图片旁时返回 false', () => {
    const editor = build({ content: 'just text' });
    editor.commands.setTextSelection(2);
    expect(resetImageSize(editor)).toBe(false);
    editor.destroy();
  });
});
