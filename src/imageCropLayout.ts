import {
  cropImageBox,
  normalizeImageCrop,
  type ImageCrop,
} from './imageMarkdown';

/**
 * 编辑态裁剪的 DOM 同步。
 *
 * 官方 ResizableNodeView 把 width / height 写在它的 `element` 上，并按这个元素的
 * offsetWidth 计算拖拽。裁剪之后用户看见、拖到的应该是裁剪框，不是整张原图，
 * 所以裁过的图在 img 外包一层 frame，把 `element` 换成 frame：拖拽改的是可见
 * 尺寸，img 用百分比铺进裁剪窗口（原图比例不变）。没裁剪时原样把尺寸写回 img，
 * 不插入 frame，缩放路径与官方一致。
 */

interface ResizeHost {
  element: HTMLElement;
  onResize?: (width: number, height: number) => void;
}

interface FrameState {
  frame: HTMLDivElement;
  originalOnResize?: (width: number, height: number) => void;
  installed: boolean;
  loadHandler?: () => void;
}

const frames = new WeakMap<HTMLImageElement, FrameState>();

/** 正在原图上拖选区：这段时间 attrs 同步不要把展开的原图收回裁剪窗口。 */
const cropEditing = new WeakSet<HTMLImageElement>();

function pixel(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  // 不在这里取整：拖拽提交的是 offsetWidth 的浮点，取整会把等比约束的结果改掉
  // （官方同步路径原样写回 style）。markdown 序列化自己会收成整数像素。
  return Number.isFinite(n) && n > 0 ? n : null;
}

function applyCropImageStyle(img: HTMLImageElement, crop: ImageCrop): void {
  const box = cropImageBox(crop);
  img.style.position = 'absolute';
  img.style.margin = '0';
  img.style.maxWidth = 'none';
  img.style.pointerEvents = 'none';
  img.style.width = box.width;
  img.style.height = box.height;
  img.style.left = box.left;
  img.style.top = box.top;
}

function clearCropStyles(img: HTMLImageElement): void {
  img.style.position = '';
  img.style.margin = '';
  img.style.maxWidth = '';
  img.style.pointerEvents = '';
  img.style.width = '';
  img.style.height = '';
  img.style.left = '';
  img.style.top = '';
}

function detachLoad(img: HTMLImageElement, state: FrameState): void {
  if (!state.loadHandler) return;
  img.removeEventListener('load', state.loadHandler);
  state.loadHandler = undefined;
}

/**
 * 把节点 attrs 同步到这张图的 DOM。`host` 是官方 ResizableNodeView
 * （裁剪时把它的 element / onResize 临时换成 frame）。
 */
export function syncResizableImageCrop(
  host: ResizeHost,
  img: HTMLImageElement,
  attrs: Record<string, unknown>,
): void {
  if (cropEditing.has(img)) return;
  const crop = normalizeImageCrop(attrs.crop);
  const width = pixel(attrs.width);
  const height = pixel(attrs.height);
  const state = frames.get(img);

  if (!crop) {
    if (state?.installed) {
      detachLoad(img, state);
      state.frame.replaceWith(img);
      host.element = img;
      host.onResize = state.originalOnResize;
      state.installed = false;
    }
    clearCropStyles(img);
    img.style.width = width ? `${width}px` : '';
    img.style.height = height ? `${height}px` : '';
    return;
  }

  const frameState = state ?? {
    frame: document.createElement('div'),
    installed: false,
  };
  if (!state) frames.set(img, frameState);

  const { frame } = frameState;
  frame.className = 'tmr-image-crop';
  frame.style.position = 'relative';
  frame.style.overflow = 'hidden';
  frame.style.display = 'block';
  frame.style.maxWidth = '100%';
  frame.style.lineHeight = '0';
  // 裁剪编辑会用负 margin 把原图展开；提交后这里收回，避免裁完的图还留着偏移。
  frame.style.marginLeft = '';
  frame.style.marginTop = '';

  if (!frameState.installed) {
    frameState.originalOnResize = host.onResize;
    img.parentElement?.insertBefore(frame, img);
    frame.appendChild(img);
    host.element = frame;
    frameState.installed = true;
  }

  // 官方 onResize 会把 img 设成 frame 的像素尺寸，把百分比裁剪盖掉。
  // 拖拽期间 frame 的尺寸由 ResizableNodeView 自己写，这里只维持 img 的裁剪窗口。
  host.onResize = () => applyCropImageStyle(img, crop);
  host.element = frame;

  if (width && height) {
    detachLoad(img, frameState);
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.aspectRatio = `${width} / ${height}`;
  } else {
    frame.style.width = '';
    frame.style.height = '';
    frame.style.aspectRatio = '';
    detachLoad(img, frameState);
    const fitToNatural = () => {
      const w = Math.round(img.naturalWidth * crop.w);
      const h = Math.round(img.naturalHeight * crop.h);
      if (w <= 0 || h <= 0) return;
      frame.style.width = `${w}px`;
      frame.style.height = `${h}px`;
      frame.style.aspectRatio = `${w} / ${h}`;
    };
    frameState.loadHandler = fitToNatural;
    if (img.complete && img.naturalWidth > 0) fitToNatural();
    else img.addEventListener('load', fitToNatural);
  }

  applyCropImageStyle(img, crop);
}

export interface CropSurface {
  /** 盖在文档原图上的层，选区和手柄画在这里。 */
  overlay: HTMLDivElement;
  /** 展开原图之前的可见宽度，用来在提交时保持缩放比例。 */
  displayWidth: number;
  /** 丢掉展开状态，交给随后的 attrs 同步写回裁剪结果。 */
  discard: () => void;
  /** 取消：把 DOM 收回打开裁剪之前。 */
  restore: () => void;
}

interface FrameSnap {
  width: string;
  height: string;
  aspectRatio: string;
  overflow: string;
  maxWidth: string;
}

interface ImgSnap {
  position: string;
  margin: string;
  maxWidth: string;
  pointerEvents: string;
  width: string;
  height: string;
  left: string;
  top: string;
}

/**
 * 在文档里的这张图上开始裁剪。
 *
 * 已经裁过的图按「重置」后的样子铺开：整张原图从图片块的左上角开始，比例和重置
 * 一样，选区再盖回当前裁剪。不改块的左上角，也不把原图用负偏移甩到裁剪框外面。
 * 没裁过则遮罩直接盖住当前图片。
 */
export function openCropSurface(img: HTMLImageElement, crop: ImageCrop | null): CropSurface {
  const frame = img.closest('.tmr-image-crop');
  const framed = frame instanceof HTMLElement ? frame : null;
  const host = framed ?? img;
  const displayWidth = host.clientWidth;
  const displayHeight = host.clientHeight;

  const frameSnap: FrameSnap | null = framed
    ? {
        width: framed.style.width,
        height: framed.style.height,
        aspectRatio: framed.style.aspectRatio,
        overflow: framed.style.overflow,
        maxWidth: framed.style.maxWidth,
      }
    : null;
  const imgSnap: ImgSnap = {
    position: img.style.position,
    margin: img.style.margin,
    maxWidth: img.style.maxWidth,
    pointerEvents: img.style.pointerEvents,
    width: img.style.width,
    height: img.style.height,
    left: img.style.left,
    top: img.style.top,
  };

  const reflow =
    framed != null &&
    crop != null &&
    displayWidth >= 1 &&
    displayHeight >= 1 &&
    crop.w > 0 &&
    crop.h > 0;

  if (reflow && framed && crop) {
    const fullW = displayWidth / crop.w;
    const fullH = displayHeight / crop.h;
    framed.style.width = `${fullW}px`;
    framed.style.height = 'auto';
    framed.style.aspectRatio = `${fullW} / ${fullH}`;
    framed.style.overflow = 'hidden';
    framed.style.maxWidth = '100%';
    img.style.position = 'absolute';
    img.style.margin = '0';
    img.style.maxWidth = 'none';
    img.style.pointerEvents = 'none';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.left = '0';
    img.style.top = '0';
  }

  const parent = framed ?? img.parentElement ?? img;
  let parentPosition: string | null = null;
  if (!framed && parent !== img && getComputedStyle(parent).position === 'static') {
    parentPosition = parent.style.position;
    parent.style.position = 'relative';
  }

  const overlay = document.createElement('div');
  overlay.className = 'tmr-image-crop-edit';
  overlay.dataset.imageCrop = '';
  overlay.style.position = 'absolute';
  overlay.style.zIndex = '3';
  if (reflow) {
    overlay.style.inset = '0';
  } else {
    overlay.style.left = `${img.offsetLeft}px`;
    overlay.style.top = `${img.offsetTop}px`;
    overlay.style.width = `${Math.max(img.offsetWidth, 0)}px`;
    overlay.style.height = `${Math.max(img.offsetHeight, 0)}px`;
  }
  parent.appendChild(overlay);

  const container = img.closest('[data-resize-container]');
  if (container instanceof HTMLElement) container.dataset.imageCropping = '';

  cropEditing.add(img);

  let alive = true;
  let keepStyles = false;
  const teardown = () => {
    if (!alive) return;
    alive = false;
    cropEditing.delete(img);
    overlay.remove();
    if (container instanceof HTMLElement) delete container.dataset.imageCropping;
    if (keepStyles) return;
    if (framed && frameSnap) {
      framed.style.width = frameSnap.width;
      framed.style.height = frameSnap.height;
      framed.style.aspectRatio = frameSnap.aspectRatio;
      framed.style.overflow = frameSnap.overflow;
      framed.style.maxWidth = frameSnap.maxWidth;
    }
    img.style.position = imgSnap.position;
    img.style.margin = imgSnap.margin;
    img.style.maxWidth = imgSnap.maxWidth;
    img.style.pointerEvents = imgSnap.pointerEvents;
    img.style.width = imgSnap.width;
    img.style.height = imgSnap.height;
    img.style.left = imgSnap.left;
    img.style.top = imgSnap.top;
    if (parentPosition !== null && parent !== img) parent.style.position = parentPosition;
  };

  return {
    overlay,
    displayWidth,
    discard() {
      keepStyles = true;
      teardown();
    },
    restore() {
      teardown();
    },
  };
}
