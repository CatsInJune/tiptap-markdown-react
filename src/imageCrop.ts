import type { Editor } from '@tiptap/core';
import { findImagePos } from './imageAlign';
import {
  normalizeImageCrop,
  type ImageCrop,
} from './imageMarkdown';

/**
 * 图片裁剪的交互几何与写入。
 *
 * 矩形是相对原图的比例（0–1），不是像素：显示尺寸（width / height）另算，
 * 之后再拖缩放不会把裁剪区域冲掉。原图 `src` 保持不变，所以裁剪可重入、可重置。
 */

/** 裁剪框拖动手柄。 */
export type ImageCropHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

/** 裁剪框最短边（相对原图）。再小就既难拖中，显示也会糊成一条线。 */
const MIN_CROP = 0.05;

export interface ImageCropMetrics {
  naturalWidth: number;
  naturalHeight: number;
  /**
   * 当前可见宽度。已经裁过的图，这是裁剪框的显示宽，不是整张原图的显示宽。
   */
  displayWidth: number;
}

/** 平移裁剪框，夹在原图内（尺寸不变）。 */
export function moveCrop(start: ImageCrop, dx: number, dy: number): ImageCrop {
  return tidy({
    x: clamp(start.x + dx, 0, 1 - start.w),
    y: clamp(start.y + dy, 0, 1 - start.h),
    w: start.w,
    h: start.h,
  });
}

/**
 * 按手柄缩放裁剪框。被拖的是对应的边，对边钉住；拖过对边时那一侧改由最小边长顶住。
 */
export function resizeCrop(
  start: ImageCrop,
  handle: ImageCropHandle,
  dx: number,
  dy: number,
): ImageCrop {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  if (handle.includes('w')) left += dx;
  if (handle.includes('e')) right += dx;
  if (handle.includes('n')) top += dy;
  if (handle.includes('s')) bottom += dy;

  if (right - left < MIN_CROP) {
    if (handle.includes('w') && !handle.includes('e')) left = right - MIN_CROP;
    else right = left + MIN_CROP;
  }
  if (bottom - top < MIN_CROP) {
    if (handle.includes('n') && !handle.includes('s')) top = bottom - MIN_CROP;
    else bottom = top + MIN_CROP;
  }

  left = clamp(left, 0, 1 - MIN_CROP);
  top = clamp(top, 0, 1 - MIN_CROP);
  right = clamp(right, left + MIN_CROP, 1);
  bottom = clamp(bottom, top + MIN_CROP, 1);

  return tidy({ x: left, y: top, w: right - left, h: bottom - top });
}

/**
 * 裁剪前后保持「原图像素 → 屏幕像素」的比例，算出新的可见宽高。
 *
 * `from == null` 表示当前看见的是整张图。图片还没加载出自然尺寸时返回 null，
 * 调用方只写 crop、不动 width / height。
 */
export function croppedDisplaySize(args: {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  from: ImageCrop | null;
  to: ImageCrop | null;
}): { width: number; height: number } | null {
  const { naturalWidth, naturalHeight, displayWidth, from, to } = args;
  if (!(naturalWidth > 0) || !(naturalHeight > 0) || !(displayWidth > 0)) return null;
  const scale = displayWidth / (naturalWidth * (from?.w ?? 1));
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  const fractionW = to?.w ?? 1;
  const fractionH = to?.h ?? 1;
  return {
    width: Math.max(1, Math.round(naturalWidth * fractionW * scale)),
    height: Math.max(1, Math.round(naturalHeight * fractionH * scale)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 交互过程里的比例，收掉二进制浮点尾巴（写入 markdown 时还会再收成四位小数）。 */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function tidy(crop: ImageCrop): ImageCrop {
  return { x: round6(crop.x), y: round6(crop.y), w: round6(crop.w), h: round6(crop.h) };
}

function sameCrop(a: ImageCrop | null, b: ImageCrop | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/**
 * 按文档位置写入裁剪。`crop == null` 清除。
 *
 * 同时按 {@link croppedDisplaySize} 改 width / height，让可见区域立刻变成裁剪结果，
 * 而不是把整张图塞进原来的盒子里。一次事务，撤销一步回到裁之前。
 * 返回是否找到图片。没变化时不写事务。
 */
export function setImageCropAtPos(
  editor: Editor,
  pos: number,
  crop: ImageCrop | null,
  metrics?: ImageCropMetrics | null,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return false;

  const next = normalizeImageCrop(crop);
  const current = normalizeImageCrop(node.attrs.crop);
  const sized = metrics
    ? croppedDisplaySize({ ...metrics, from: current, to: next })
    : null;

  const width = sized?.width ?? node.attrs.width;
  const height = sized?.height ?? node.attrs.height;
  if (
    sameCrop(current, next) &&
    width === node.attrs.width &&
    height === node.attrs.height
  ) {
    return true;
  }

  let tr = editor.state.tr.setNodeAttribute(pos, 'crop', next);
  if (sized && sized.width !== node.attrs.width) {
    tr = tr.setNodeAttribute(pos, 'width', sized.width);
  }
  if (sized && sized.height !== node.attrs.height) {
    tr = tr.setNodeAttribute(pos, 'height', sized.height);
  }
  editor.view.dispatch(tr);
  return true;
}

/** 设置「当前图片」（选中 / 光标紧邻）的裁剪。返回是否找到图片。 */
export function setImageCrop(
  editor: Editor,
  crop: ImageCrop | null,
  metrics?: ImageCropMetrics | null,
): boolean {
  const pos = findImagePos(editor);
  if (pos == null) return false;
  return setImageCropAtPos(editor, pos, crop, metrics);
}
