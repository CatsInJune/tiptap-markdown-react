// @vitest-environment happy-dom
import type { JSONContent, ResizableNodeViewDirection } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { ImageWithConfirmDelete } from './components/MarkdownWysiwygEditor';
import {
  croppedDisplaySize,
  moveCrop,
  resizeCrop,
  setImageCropAtPos,
} from './imageCrop';
import { renderReportHtml } from './renderReportHtml';
import { openCropSurface } from './imageCropLayout';
import { resetImageSize } from './resetImageSize';

const CROP_MD =
  '<img src="https://x/a.png" alt="a" width="200" height="200" data-crop="0.0000,0.0000,0.5000,1.0000">';

function build(content = '') {
  return new Editor({
    extensions: [
      ...baseExtensions,
      ImageWithConfirmDelete.configure({
        inline: false,
        resize: {
          enabled: true,
          alwaysPreserveAspectRatio: true,
          directions: ['left', 'right'] as ResizableNodeViewDirection[],
          minWidth: 80,
          minHeight: 80,
        },
      }),
      Markdown,
    ],
    content,
    contentType: 'markdown',
  });
}

function imageAttrs(json: JSONContent): Record<string, unknown> | undefined {
  const img = (json.content ?? []).find((n) => n.type === 'image');
  return img?.attrs as Record<string, unknown> | undefined;
}

describe('裁剪几何', () => {
  const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

  it('平移夹在原图内，尺寸不变', () => {
    expect(moveCrop(start, 0.1, -0.05)).toEqual({ x: 0.3, y: 0.15, w: 0.4, h: 0.4 });
    expect(moveCrop(start, 1, 1)).toEqual({ x: 0.6, y: 0.6, w: 0.4, h: 0.4 });
  });

  it('手柄只动对应的边，拖出原图被夹住', () => {
    expect(resizeCrop(start, 'e', 0.1, 0)).toEqual({
      x: 0.2,
      y: 0.2,
      w: 0.5,
      h: 0.4,
    });
    expect(resizeCrop(start, 'w', -0.1, 0)).toEqual({
      x: 0.1,
      y: 0.2,
      w: 0.5,
      h: 0.4,
    });
    expect(resizeCrop(start, 'e', 5, 0)).toEqual({ x: 0.2, y: 0.2, w: 0.8, h: 0.4 });
    expect(resizeCrop(start, 'nw', -0.05, -0.05)).toEqual({
      x: 0.15,
      y: 0.15,
      w: 0.45,
      h: 0.45,
    });
  });

  it('显示尺寸按原图像素比例换算，重置时回到整图', () => {
    const cropped = croppedDisplaySize({
      naturalWidth: 400,
      naturalHeight: 200,
      displayWidth: 400,
      from: null,
      to: { x: 0, y: 0, w: 0.5, h: 1 },
    });
    expect(cropped).toEqual({ width: 200, height: 200 });

    expect(
      croppedDisplaySize({
        naturalWidth: 400,
        naturalHeight: 200,
        displayWidth: 200,
        from: { x: 0, y: 0, w: 0.5, h: 1 },
        to: null,
      }),
    ).toEqual({ width: 400, height: 200 });

    expect(
      croppedDisplaySize({
        naturalWidth: 0,
        naturalHeight: 200,
        displayWidth: 400,
        from: null,
        to: { x: 0, y: 0, w: 0.5, h: 1 },
      }),
    ).toBeNull();
  });
});

describe('图片裁剪的 markdown 往返', () => {
  it('序列化带 data-crop，没裁过的图保持标准语法', () => {
    const editor = build('![a](https://x/a.png)');
    expect(editor.getMarkdown()).toContain('![a](https://x/a.png)');

    setImageCropAtPos(editor, 0, { x: 0, y: 0, w: 0.5, h: 1 }, {
      naturalWidth: 400,
      naturalHeight: 200,
      displayWidth: 400,
    });
    expect(editor.getMarkdown().trim()).toBe(CROP_MD);
    editor.destroy();
  });

  it('解析还原，脏值和整图裁剪都忽略', () => {
    const editor = build(CROP_MD);
    expect(imageAttrs(editor.getJSON())?.crop).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
    expect(editor.getMarkdown().trim()).toBe(CROP_MD);
    editor.destroy();

    const dirty = build('<img src="https://x/a.png" alt="a" data-crop="nope">');
    expect(imageAttrs(dirty.getJSON())?.crop).toBeNull();
    expect(dirty.getMarkdown()).toContain('![a](https://x/a.png)');
    dirty.destroy();

    const full = build(
      '<img src="https://x/a.png" alt="a" width="200" height="100" data-crop="0,0,1,1">',
    );
    expect(imageAttrs(full.getJSON())?.crop).toBeNull();
    expect(full.getMarkdown().trim()).toBe(
      '<img src="https://x/a.png" alt="a" width="200" height="100">',
    );
    full.destroy();
  });

  it('和描述、对齐共存', () => {
    const md = [
      '<figure>',
      '<img src="https://x/a.png" alt="a" width="200" height="200" data-align="center" data-crop="0.0000,0.0000,0.5000,1.0000">',
      '<figcaption>图 1</figcaption>',
      '</figure>',
    ].join('\n');
    const editor = build(md);
    expect(editor.getMarkdown().trim()).toBe(md);
    expect(imageAttrs(editor.getJSON())).toMatchObject({
      align: 'center',
      caption: '图 1',
      crop: { x: 0, y: 0, w: 0.5, h: 1 },
    });
    editor.destroy();
  });

  it('server HTML 带裁剪框，原图 src 还在', () => {
    const rendered = renderReportHtml(CROP_MD);
    expect(rendered.html).toContain('data-crop="0.0000,0.0000,0.5000,1.0000"');
    expect(rendered.html).toContain('tmr-image-crop');
    expect(rendered.html).toContain('width:200%');
    expect(rendered.html).toContain('src="https://x/a.png"');
  });
});

describe('setImageCropAtPos / 编辑态裁剪框', () => {
  it('写入裁剪后 img 只露出窗口，宽度变成可见尺寸', () => {
    const editor = build('![a](https://x/a.png)');
    expect(
      setImageCropAtPos(editor, 0, { x: 0, y: 0, w: 0.5, h: 1 }, {
        naturalWidth: 400,
        naturalHeight: 200,
        displayWidth: 400,
      }),
    ).toBe(true);

    const frame = editor.view.dom.querySelector<HTMLElement>('.tmr-image-crop');
    const img = frame?.querySelector('img');
    expect(frame?.style.width).toBe('200px');
    expect(frame?.style.height).toBe('200px');
    expect(img?.style.width).toBe('200%');
    expect(img?.style.left).toBe('0%');
    expect(img?.getAttribute('src')).toBe('https://x/a.png');
    editor.destroy();
  });

  it('再裁一次按已经裁过的显示宽换算；重置回到整图', () => {
    const editor = build(CROP_MD);
    setImageCropAtPos(editor, 0, { x: 0.25, y: 0, w: 0.25, h: 1 }, {
      naturalWidth: 400,
      naturalHeight: 200,
      displayWidth: 200,
    });
    expect(imageAttrs(editor.getJSON())).toMatchObject({
      crop: { x: 0.25, y: 0, w: 0.25, h: 1 },
      width: 100,
      height: 200,
    });

    setImageCropAtPos(editor, 0, null, {
      naturalWidth: 400,
      naturalHeight: 200,
      displayWidth: 100,
    });
    expect(imageAttrs(editor.getJSON())?.crop).toBeNull();
    expect(imageAttrs(editor.getJSON())).toMatchObject({ width: 400, height: 200 });
    expect(editor.view.dom.querySelector('.tmr-image-crop')).toBeNull();
    editor.destroy();
  });

  it('同值不写事务；光标不在图旁时返回 false', () => {
    const editor = build(CROP_MD);
    const before = editor.state.doc;
    expect(
      setImageCropAtPos(editor, 0, { x: 0, y: 0, w: 0.5, h: 1 }, {
        naturalWidth: 400,
        naturalHeight: 200,
        displayWidth: 200,
      }),
    ).toBe(true);
    expect(editor.state.doc).toBe(before);

    const text = build('just text');
    text.commands.setTextSelection(2);
    expect(setImageCropAtPos(text, 0, { x: 0, y: 0, w: 0.5, h: 0.5 })).toBe(false);
    text.destroy();
    editor.destroy();
  });

  it('resetImageSize 连裁剪一起清掉', () => {
    const editor = build(CROP_MD);
    editor.commands.setNodeSelection(0);
    expect(resetImageSize(editor)).toBe(true);
    expect(editor.getMarkdown()).toContain('![a](https://x/a.png)');
    expect(editor.getMarkdown()).not.toContain('data-crop');
    editor.destroy();
  });

  it('重新打开裁剪时原图回到重置后的整图位置，选区仍是当前裁剪', () => {
    const editor = build(
      '<img src="https://x/a.png" alt="a" width="100" height="80" data-crop="0.2500,0.2000,0.5000,0.5000">',
    );
    const frame = editor.view.dom.querySelector<HTMLElement>('.tmr-image-crop');
    const img = frame?.querySelector('img');
    if (!frame || !img) throw new Error('no frame');
    const before = {
      width: frame.style.width,
      height: frame.style.height,
      marginLeft: frame.style.marginLeft,
      marginTop: frame.style.marginTop,
      imgLeft: img.style.left,
      imgTop: img.style.top,
    };
    Object.defineProperty(frame, 'clientWidth', { configurable: true, get: () => 100 });
    Object.defineProperty(frame, 'clientHeight', { configurable: true, get: () => 80 });

    const session = openCropSurface(img, { x: 0.25, y: 0.2, w: 0.5, h: 0.5 });

    expect(frame.style.marginLeft).toBe(before.marginLeft);
    expect(frame.style.marginTop).toBe(before.marginTop);
    expect(frame.style.width).toBe('200px');
    expect(frame.style.height).toBe('auto');
    expect(frame.style.aspectRatio).toBe('200 / 160');
    expect(img.style.left).toBe('0px');
    expect(img.style.top).toBe('0px');
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('100%');
    expect(session.overlay.style.inset).toBe('0');
    expect(session.displayWidth).toBe(100);

    session.restore();
    expect(frame.style.width).toBe(before.width);
    expect(frame.style.height).toBe(before.height);
    expect(img.style.left).toBe(before.imgLeft);
    expect(img.style.top).toBe(before.imgTop);
    editor.destroy();
  });
});
