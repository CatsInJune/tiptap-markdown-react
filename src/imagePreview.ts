import { normalizeImageCrop, type ImageCrop } from './imageMarkdown';

/**
 * 图片灯箱的纯逻辑：从正文里收集图、判断点到的是哪一张、以及适应视口的缩放。
 * 阅读态单击打开，编辑态双击或工具条打开；裁剪进行时不抢手势。
 */

export interface PreviewImage {
  src: string;
  alt: string;
  crop: ImageCrop | null;
}

/** 灯箱自定义事件。工具条在 body 上，不在正文根里，用它通知所属正文打开这一张。 */
export const IMAGE_PREVIEW_EVENT = 'tmr-image-preview';

const ZOOM_STEP = 1.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
/** 视口左右各留出的空隙，避免图贴边。 */
const PAD_X = 48;
/** 视口上下各留出的空隙，给关闭按钮和底部工具条腾位置。 */
const PAD_Y = 88;

export function requestImagePreview(img: HTMLImageElement) {
  img.dispatchEvent(
    new CustomEvent(IMAGE_PREVIEW_EVENT, { bubbles: true, detail: { img } }),
  );
}

/** 正文里按阅读顺序能预览的图。灯箱自己 portal 出去的图不算。 */
export function listPreviewImages(root: ParentNode): HTMLImageElement[] {
  return [...root.querySelectorAll('img')].filter((node): node is HTMLImageElement => {
    if (!(node instanceof HTMLImageElement)) return false;
    if (!node.getAttribute('src')) return false;
    if (node.closest('[data-image-lightbox]')) return false;
    return true;
  });
}

export function toPreviewImage(img: HTMLImageElement): PreviewImage {
  return {
    src: img.getAttribute('src') ?? '',
    alt: img.getAttribute('alt') ?? '',
    crop: normalizeImageCrop(img.getAttribute('data-crop')),
  };
}

/**
 * 点击 / 双击的目标是不是一张正文图。
 * 裁剪进行时、缩放手柄上都不打开，避免和剪裁、缩放抢手势。
 * 裁过的图 img 是 pointer-events:none，点到的是外面的 `.tmr-image-crop`。
 */
export function previewImageFromTarget(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('[data-image-lightbox], [data-resize-handle], [data-image-cropping]')) {
    return null;
  }
  const frame = target.closest('.tmr-image-crop');
  const node = frame ? frame.querySelector('img') : target.closest('img');
  if (!(node instanceof HTMLImageElement)) return null;
  if (!node.getAttribute('src')) return null;
  if (node.closest('[data-image-lightbox]')) return null;
  return node;
}

/** 灯箱里要显示的像素尺寸：裁剪后是可见区域，不是整张原图。 */
export function previewPixelSize(
  naturalWidth: number,
  naturalHeight: number,
  crop: ImageCrop | null,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) return { width: 0, height: 0 };
  if (!crop) return { width: naturalWidth, height: naturalHeight };
  return { width: naturalWidth * crop.w, height: naturalHeight * crop.h };
}

export interface PreviewFit {
  /** 未旋转时的布局宽（zoom = 1 时正好适应视口）。 */
  width: number;
  /** 未旋转时的布局高。 */
  height: number;
  /** 乘上它之后，屏幕上的一边等于可见区域的像素。放大缩小的上下限用它兜住。 */
  actualZoom: number;
}

/**
 * zoom = 1 时图适应视口（大图缩小，小图放大，和阅读页灯箱一样铺满可视区域）。
 * 旋转 90/270 后按转过的外接框来适应；返回的宽高仍是旋转前的布局盒，
 * 视觉上的外接框由 CSS rotate 交换。自适应就是 zoom = 1。
 */
export function fitPreviewBox(input: {
  viewportWidth: number;
  viewportHeight: number;
  imageWidth: number;
  imageHeight: number;
  rotation: number;
}): PreviewFit | null {
  const { imageWidth, imageHeight } = input;
  if (imageWidth <= 0 || imageHeight <= 0) return null;
  const quarter = ((input.rotation % 360) + 360) % 360;
  const swapped = quarter === 90 || quarter === 270;
  const screenW = swapped ? imageHeight : imageWidth;
  const screenH = swapped ? imageWidth : imageHeight;
  const availW = Math.max(64, input.viewportWidth - PAD_X * 2);
  const availH = Math.max(64, input.viewportHeight - PAD_Y * 2);
  const fitScale = Math.min(availW / screenW, availH / screenH);
  if (!Number.isFinite(fitScale) || fitScale <= 0) return null;
  return {
    width: imageWidth * fitScale,
    height: imageHeight * fitScale,
    actualZoom: 1 / fitScale,
  };
}

/** 放大、缩小、自适应（回到适应视口的 zoom = 1）。 */
export function nextPreviewZoom(
  action: 'in' | 'out' | 'fit',
  zoom: number,
  actualZoom: number,
): number {
  if (action === 'fit') return 1;
  const max = Math.max(ZOOM_MAX, actualZoom);
  const min = Math.min(ZOOM_MIN, actualZoom);
  const next = action === 'in' ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
  return Math.min(max, Math.max(min, next));
}
