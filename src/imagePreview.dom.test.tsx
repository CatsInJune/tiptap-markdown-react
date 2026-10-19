// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ImagePreviewHost } from './components/ImageLightbox';
import {
  fitPreviewBox,
  listPreviewImages,
  nextPreviewZoom,
  requestImagePreview,
  toPreviewImage,
} from './imagePreview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('图片灯箱几何', () => {
  it('大图缩小到适应视口', () => {
    const fit = fitPreviewBox({
      viewportWidth: 800,
      viewportHeight: 600,
      imageWidth: 1000,
      imageHeight: 500,
      rotation: 0,
    });
    expect(fit).not.toBeNull();
    expect(fit?.width).toBeCloseTo(704);
    expect(fit?.height).toBeCloseTo(352);
    expect(fit?.actualZoom).toBeCloseTo(1 / 0.704);
  });

  it('小图放大到适应视口', () => {
    const fit = fitPreviewBox({
      viewportWidth: 800,
      viewportHeight: 600,
      imageWidth: 100,
      imageHeight: 50,
      rotation: 0,
    });
    expect(fit?.width).toBeCloseTo(704);
    expect(fit?.height).toBeCloseTo(352);
    expect(fit?.actualZoom).toBeCloseTo(100 / 704);
  });

  it('旋转 90° 后按转过的外接框适应', () => {
    const fit = fitPreviewBox({
      viewportWidth: 800,
      viewportHeight: 600,
      imageWidth: 1000,
      imageHeight: 500,
      rotation: 90,
    });
    expect(fit?.width).toBeCloseTo(424);
    expect(fit?.height).toBeCloseTo(212);
  });

  it('放大、缩小，自适应回到 1', () => {
    expect(nextPreviewZoom('in', 1, 2)).toBeCloseTo(1.25);
    expect(nextPreviewZoom('out', 1.25, 2)).toBeCloseTo(1);
    expect(nextPreviewZoom('fit', 3, 2)).toBe(1);
  });
});

describe('ImagePreviewHost', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  const mount = async (activate: 'click' | 'dblclick' = 'click') => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <ImagePreviewHost locale="zh" activate={activate}>
          <img src="a.png" alt="第一张" />
          <span className="tmr-image-crop">
            <img
              src="b.png"
              alt="第二张"
              data-crop="0.1000,0.2000,0.5000,0.5000"
            />
          </span>
          <img alt="没地址" />
          <div data-image-lightbox="">
            <img src="hidden.png" alt="灯箱里的" />
          </div>
        </ImagePreviewHost>,
      );
    });
  };

  const dialog = () => document.querySelector('[data-image-lightbox][role="dialog"]');

  it('只收集有地址、且不在灯箱里的图，并读出裁剪', async () => {
    await mount();
    const images = listPreviewImages(host).map(toPreviewImage);
    expect(images.map((item) => item.src)).toEqual(['a.png', 'b.png']);
    expect(images[1]?.crop).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
  });

  it('单击裁剪框打开对应的那一张，带页码、裁剪定位和关闭', async () => {
    await mount();
    const frame = host.querySelector('.tmr-image-crop');
    if (!frame) throw new Error('no crop frame');
    await act(async () => {
      frame.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(dialog()?.getAttribute('aria-label')).toBe('图片预览');
    expect(dialog()?.textContent).toContain('2/2');
    const img = dialog()?.querySelector('img');
    expect(img?.getAttribute('src')).toBe('b.png');
    expect(img?.style.left).toBe('-20%');
    expect(img?.style.top).toBe('-40%');
    expect(
      dialog()?.querySelector<HTMLButtonElement>('[data-image-preview-action="prev"]')
        ?.disabled,
    ).toBe(false);
    expect(
      dialog()?.querySelector<HTMLButtonElement>('[data-image-preview-action="next"]')
        ?.disabled,
    ).toBe(true);

    const frameBox = dialog()?.querySelector<HTMLElement>('[style*="rotate"]');
    await act(async () => {
      dialog()
        ?.querySelector<HTMLButtonElement>('[data-image-preview-action="zoom-in"]')
        ?.click();
    });
    expect(frameBox?.style.transform).toContain('scale(1.25)');
    expect(dialog()?.querySelector('[data-image-preview-action="actual"]')).toBeNull();
    expect(dialog()?.textContent).not.toContain('1:1');
    const fit = dialog()?.querySelector<HTMLButtonElement>('[data-image-preview-action="fit"]');
    expect(fit?.getAttribute('aria-label')).toBe('自适应');
    await act(async () => {
      fit?.click();
    });
    expect(frameBox?.style.transform).toContain('scale(1)');
    expect(frameBox?.style.transform).not.toContain('scale(1.25)');
    await act(async () => {
      dialog()
        ?.querySelector<HTMLButtonElement>('[data-image-preview-action="rotate"]')
        ?.click();
    });
    expect(frameBox?.style.transform).toContain('rotate(90deg)');

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialog()).toBeNull();
  });

  it('剪裁进行时不打开；编辑态单击不打开，双击才打开', async () => {
    await mount('dblclick');
    const frame = host.querySelector('.tmr-image-crop');
    frame?.setAttribute('data-image-cropping', '');
    await act(async () => {
      frame?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      host.querySelector('img')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(dialog()).toBeNull();

    frame?.removeAttribute('data-image-cropping');
    await act(async () => {
      host.querySelector('img')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(dialog()?.textContent).toContain('1/2');
  });

  it('工具条的预览事件打开这一张', async () => {
    await mount('dblclick');
    const img = host.querySelector<HTMLImageElement>('img[src="b.png"]');
    if (!img) throw new Error('no img');
    await act(async () => {
      requestImagePreview(img);
    });
    expect(dialog()?.textContent).toContain('2/2');
    expect(dialog()?.querySelector('[data-image-preview-action="close"]')?.getAttribute('aria-label')).toBe(
      '关闭',
    );
  });
});
