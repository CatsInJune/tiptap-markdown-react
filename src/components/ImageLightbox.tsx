'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { LocaleCode } from '../i18n';
import { getLocaleBundle } from '../i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FitIcon,
  RotateCwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../icons';
import { cropImageBox } from '../imageMarkdown';
import {
  IMAGE_PREVIEW_EVENT,
  fitPreviewBox,
  listPreviewImages,
  nextPreviewZoom,
  previewImageFromTarget,
  previewPixelSize,
  toPreviewImage,
  type PreviewImage,
} from '../imagePreview';
import styles from '../styles/imageLightbox.module.css';

/**
 * 包住一块正文：阅读态单击图片、编辑态双击图片，或收到工具条的预览事件，打开灯箱。
 * 自身 `display: contents`，不改原有布局。
 */
export function ImagePreviewHost({
  children,
  locale = 'en',
  activate = 'click',
}: {
  children: ReactNode;
  locale?: LocaleCode;
  /** 阅读用单击；编辑用双击，单击仍留给选中、缩放和剪裁。 */
  activate?: 'click' | 'dblclick';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<{ images: PreviewImage[]; index: number } | null>(
    null,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const openFrom = (img: HTMLImageElement) => {
      if (!el.contains(img)) return;
      const nodes = listPreviewImages(el);
      const index = nodes.indexOf(img);
      if (index < 0) return;
      setSession({ images: nodes.map(toPreviewImage), index });
    };
    const onActivate = (event: Event) => {
      const img = previewImageFromTarget(event.target);
      if (!img) return;
      event.preventDefault();
      openFrom(img);
    };
    const onRequest = (event: Event) => {
      const img = (event as CustomEvent<{ img?: HTMLImageElement }>).detail?.img;
      if (!(img instanceof HTMLImageElement)) return;
      openFrom(img);
    };
    const eventName = activate === 'dblclick' ? 'dblclick' : 'click';
    el.addEventListener(eventName, onActivate);
    el.addEventListener(IMAGE_PREVIEW_EVENT, onRequest);
    return () => {
      el.removeEventListener(eventName, onActivate);
      el.removeEventListener(IMAGE_PREVIEW_EVENT, onRequest);
    };
  }, [activate]);

  const labels = getLocaleBundle(locale).toolbar;

  return (
    <div
      ref={ref}
      className={styles.root}
      data-image-preview={activate === 'click' ? 'click' : undefined}
    >
      {children}
      {session && typeof document !== 'undefined'
        ? createPortal(
            <ImageLightbox
              images={session.images}
              index={session.index}
              label={labels.imagePreview}
              closeLabel={labels.imagePreviewClose}
              prevLabel={labels.imagePreviewPrev}
              nextLabel={labels.imagePreviewNext}
              zoomOutLabel={labels.imagePreviewZoomOut}
              zoomInLabel={labels.imagePreviewZoomIn}
              fitLabel={labels.imagePreviewFit}
              rotateLabel={labels.imagePreviewRotate}
              onIndex={(index) => setSession((current) => (current ? { ...current, index } : current))}
              onClose={() => setSession(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function ImageLightbox({
  images,
  index,
  label,
  closeLabel,
  prevLabel,
  nextLabel,
  zoomOutLabel,
  zoomInLabel,
  fitLabel,
  rotateLabel,
  onIndex,
  onClose,
}: {
  images: PreviewImage[];
  index: number;
  label: string;
  closeLabel: string;
  prevLabel: string;
  nextLabel: string;
  zoomOutLabel: string;
  zoomInLabel: string;
  fitLabel: string;
  rotateLabel: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const image = images[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 0 : window.innerWidth,
    h: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setNatural(null);
  }, [index, image?.src]);

  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    const read = () => {
      if (node.naturalWidth > 0) {
        setNatural({ w: node.naturalWidth, h: node.naturalHeight });
      }
    };
    read();
    node.addEventListener('load', read);
    return () => node.removeEventListener('load', read);
  }, [index, image?.src]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pixels = image
    ? previewPixelSize(natural?.w ?? 0, natural?.h ?? 0, image.crop)
    : { width: 0, height: 0 };
  const fit = fitPreviewBox({
    viewportWidth: viewport.w,
    viewportHeight: viewport.h,
    imageWidth: pixels.width,
    imageHeight: pixels.height,
    rotation,
  });
  const actualZoom = fit?.actualZoom ?? 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        if (index > 0) onIndex(index - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        if (index < images.length - 1) onIndex(index + 1);
        return;
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [images.length, index, onClose, onIndex]);

  if (!image) return null;

  const applyZoom = (action: 'in' | 'out' | 'fit') => {
    setZoom(nextPreviewZoom(action, zoom, actualZoom));
  };

  const cropStyle = image.crop ? cropImageBox(image.crop) : null;

  return (
    <div
      ref={dialogRef}
      className={styles.backdrop}
      data-image-lightbox=""
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
    >
      <button
        type="button"
        className={styles.close}
        data-image-preview-action="close"
        title={closeLabel}
        aria-label={closeLabel}
        onClick={onClose}
      >
        <XIcon size={22} />
      </button>
      <div
        className={styles.stage}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className={styles.frame}
          style={{
            width: fit ? `${fit.width}px` : undefined,
            height: fit ? `${fit.height}px` : undefined,
            visibility: fit ? 'visible' : 'hidden',
            transform: `rotate(${rotation}deg) scale(${zoom})`,
          }}
        >
          <img
            ref={imgRef}
            src={image.src}
            alt={image.alt}
            draggable={false}
            style={
              cropStyle
                ? {
                    position: 'absolute',
                    maxWidth: 'none',
                    width: cropStyle.width,
                    height: cropStyle.height,
                    left: cropStyle.left,
                    top: cropStyle.top,
                  }
                : undefined
            }
          />
        </div>
      </div>
      <div className={styles.bar} role="toolbar" aria-label={label}>
        <button
          type="button"
          className={styles.tool}
          data-image-preview-action="prev"
          title={prevLabel}
          aria-label={prevLabel}
          disabled={index <= 0}
          onClick={() => onIndex(index - 1)}
        >
          <ChevronLeftIcon size={16} />
        </button>
        <span className={styles.count}>
          {index + 1}/{images.length}
        </span>
        <button
          type="button"
          className={styles.tool}
          data-image-preview-action="next"
          title={nextLabel}
          aria-label={nextLabel}
          disabled={index >= images.length - 1}
          onClick={() => onIndex(index + 1)}
        >
          <ChevronRightIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.tool}
          data-image-preview-action="zoom-out"
          title={zoomOutLabel}
          aria-label={zoomOutLabel}
          onClick={() => applyZoom('out')}
        >
          <ZoomOutIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.tool}
          data-image-preview-action="zoom-in"
          title={zoomInLabel}
          aria-label={zoomInLabel}
          onClick={() => applyZoom('in')}
        >
          <ZoomInIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.tool}
          data-image-preview-action="fit"
          title={fitLabel}
          aria-label={fitLabel}
          aria-pressed={Math.abs(zoom - 1) < 0.02}
          onClick={() => applyZoom('fit')}
        >
          <FitIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.tool}
          data-image-preview-action="rotate"
          title={rotateLabel}
          aria-label={rotateLabel}
          onClick={() => setRotation((current) => (current + 90) % 360)}
        >
          <RotateCwIcon size={16} />
        </button>
      </div>
    </div>
  );
}
