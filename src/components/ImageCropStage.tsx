'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  moveCrop,
  resizeCrop,
  type ImageCropHandle,
} from '../imageCrop';
import type { ImageCrop } from '../imageMarkdown';
import styles from '../styles/imageCrop.module.css';

const HANDLES: ImageCropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const FULL: ImageCrop = { x: 0, y: 0, w: 1, h: 1 };

export interface ImageCropStageProps {
  /** 盖在文档原图上的层。选区相对这一层，也就是相对原图。 */
  overlay: HTMLElement;
  /** 已保存的裁剪；null 表示当前看见的是整张图，框从满幅开始。 */
  crop: ImageCrop | null;
  label: string;
  onApply: (crop: ImageCrop | null) => void;
  onCancel: () => void;
}

export interface ImageCropStageHandle {
  apply: () => void;
}

interface Drag {
  mode: 'move' | ImageCropHandle;
  start: ImageCrop;
  pointerX: number;
  pointerY: number;
}

function isHandle(value: string | undefined): value is ImageCropHandle {
  return !!value && (HANDLES as string[]).includes(value);
}

/**
 * 裁剪选区：画在文档里的原图上，不另开一张缩略图。
 * 坐标全是相对原图的比例。应用时把还没归一的草稿交回去。
 */
export const ImageCropStage = forwardRef<ImageCropStageHandle, ImageCropStageProps>(
  function ImageCropStage({ overlay, crop, label, onApply, onCancel }, ref) {
    const dragRef = useRef<Drag | null>(null);
    const [draft, setDraft] = useState<ImageCrop>(crop ?? FULL);
    const draftRef = useRef(draft);
    draftRef.current = draft;

    useImperativeHandle(ref, () => ({
      apply() {
        onApply(draftRef.current);
      },
    }));

    const pointOf = (event: ReactPointerEvent) => {
      const rect = overlay.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      return {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      // 点在原图上时不要把选区交给编辑器，否则节点更新会把展开的原图收回去。
      event.preventDefault();
      event.stopPropagation();
      const point = pointOf(event);
      if (!point) return;
      const handle = (event.target as HTMLElement | null)?.dataset.cropHandle;
      const onBox = (event.target as HTMLElement | null)?.closest('[data-crop-box]');
      if (!isHandle(handle) && !onBox) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        mode: isHandle(handle) ? handle : 'move',
        start: draft,
        pointerX: point.x,
        pointerY: point.y,
      };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const point = pointOf(event);
      if (!drag || !point) return;
      const dx = point.x - drag.pointerX;
      const dy = point.y - drag.pointerY;
      setDraft(
        drag.mode === 'move'
          ? moveCrop(drag.start, dx, dy)
          : resizeCrop(drag.start, drag.mode, dx, dy),
      );
    };

    const endDrag = () => {
      dragRef.current = null;
    };

    useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      };
      document.addEventListener('keydown', onKey, true);
      return () => document.removeEventListener('keydown', onKey, true);
    }, [onCancel]);

    return createPortal(
      <div
        className={styles.surface}
        role="application"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={styles.dim}
          style={{ top: 0, left: 0, right: 0, height: `${draft.y * 100}%` }}
        />
        <div
          className={styles.dim}
          style={{
            left: 0,
            right: 0,
            bottom: 0,
            height: `${(1 - draft.y - draft.h) * 100}%`,
          }}
        />
        <div
          className={styles.dim}
          style={{
            top: `${draft.y * 100}%`,
            left: 0,
            width: `${draft.x * 100}%`,
            height: `${draft.h * 100}%`,
          }}
        />
        <div
          className={styles.dim}
          style={{
            top: `${draft.y * 100}%`,
            right: 0,
            width: `${(1 - draft.x - draft.w) * 100}%`,
            height: `${draft.h * 100}%`,
          }}
        />
        <div
          className={styles.box}
          data-crop-box=""
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${draft.w * 100}%`,
            height: `${draft.h * 100}%`,
          }}
        >
          <div className={styles.grid} />
          {HANDLES.map((handle) => (
            <span
              key={handle}
              className={styles.handle}
              data-crop-handle={handle}
            />
          ))}
        </div>
      </div>,
      overlay,
    );
  },
);
