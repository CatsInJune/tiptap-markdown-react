'use client';

import type { Editor } from '@tiptap/core';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  CaptionsIcon,
  type IconProps,
} from '../icons';
import type { ToolbarLabels } from '../labels';
import { setImageCaptionAtPos } from '../imageCaption';
import { setImageAlignAtPos } from '../imageAlign';
import { normalizeImageAlign, normalizeImageCaption, type ImageAlign } from '../imageMarkdown';
import styles from '../styles/imageAlignTools.module.css';

export interface ImageAlignToolsProps {
  /** 编辑器实例。只读态不出工具条。 */
  editor: Editor;
  /** 已合并默认值的工具栏文案（工具条与三个按钮的 aria-label 都取自它）。 */
  labels: ToolbarLabels;
}

/** 悬停图片时的几何与位置（工具条 fixed 定位，直接用视口坐标）。 */
interface HoverImage {
  /**
   * 图片节点在文档里的位置：attrs 的读写都走它，**不要长期持有 img 元素引用**——
   * attrs 更新时 prosemirror 会替换裸渲染的 img（旧引用脱离文档、读不到新值）。
   */
  pos: number;
  /** 当前渲染的元素（只用于量几何；每次重测都按 pos 重取）。 */
  img: HTMLImageElement;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 工具条高度（含内边距）与它和图片之间的间距；上方放不下就翻到图片下方。 */
const TOOLBAR_HEIGHT = 34;
const TOOLBAR_GAP = 8;
/**
 * 指针离开图片后工具条再活一会儿（毫秒）：走向工具条的路上有一段「既不在图片上、
 * 也不在工具条上」的缝隙，立刻收起就会点不到（与表格手柄同一套悬停意图）。
 */
const HOVER_KEEP_MS = 160;

const ALIGNS: ImageAlign[] = ['left', 'center', 'right'];

const ICONS: Record<ImageAlign, ComponentType<IconProps>> = {
  left: AlignLeftIcon,
  center: AlignCenterIcon,
  right: AlignRightIcon,
};

function measureImage(editor: Editor, img: HTMLImageElement): HoverImage | null {
  if (!img.isConnected) return null;
  let pos: number;
  try {
    pos = editor.view.posAtDOM(img, 0);
  } catch {
    return null;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return null;
  const rect = img.getBoundingClientRect();
  return {
    pos,
    img,
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

/**
 * 图片对齐工具条（悬停式，与表格悬停手柄同一套交互）：鼠标落在图片上时，图片上方
 * （放不下就下方）浮出一排左 / 中 / 右按钮，点一下即对齐，当前对齐方向高亮。
 *
 * fixed 定位 + portal 到 body：它要贴着图片边缘，而工具栏并不在编辑器 DOM 内。
 * 滚动 / 缩放时重新量悬停的那张图让工具条跟着走。
 *
 * 点击走 {@link setImageAlignAt}（按 DOM 位置改 attrs）：鼠标只是飘过图片时图片
 * 并未被选中，不能像快捷键那样走 selection。
 */
export function ImageAlignTools({ editor, labels }: ImageAlignToolsProps) {
  const [hover, setHover] = useState<HoverImage | null>(null);
  const hoverRef = useRef<HoverImage | null>(null);
  /** 描述编辑态：null = 未在编辑；string = 输入中的草稿。 */
  const [captionDraft, setCaptionDraft] = useState<string | null>(null);
  const captionDraftRef = useRef<string | null>(null);
  captionDraftRef.current = captionDraft;

  const clearHover = useCallback(() => {
    if (!hoverRef.current) return;
    hoverRef.current = null;
    setHover(null);
    setCaptionDraft(null);
  }, []);

  /** 重新量一遍悬停的那张图（滚动 / 缩放 / 属性更新后坐标与元素都会变样）。 */
  const remeasureHover = useCallback(() => {
    const current = hoverRef.current;
    if (!current) return;
    // 按 pos 重取元素：attrs 更新会替换裸渲染的 img，旧引用已脱离文档。
    // 开缩放时图片有 NodeView，nodeDOM 返回的是容器（[data-resize-container]），
    // 要从容器里再找 img。
    const el = editor.view.nodeDOM(current.pos);
    const img =
      el instanceof HTMLImageElement
        ? el
        : el instanceof HTMLElement
          ? el.querySelector('img')
          : null;
    const next = img ? measureImage(editor, img) : null;
    hoverRef.current = next;
    setHover(next);
  }, [editor]);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingClear = useCallback(() => {
    if (clearTimerRef.current === null) return;
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!editor.isEditable) return;
      const target = event.target as HTMLElement | null;

      // 指针已经到工具条上：留着，并取消待收起
      if (target?.closest?.('[data-image-align]')) {
        cancelPendingClear();
        return;
      }

      const img =
        target && editor.view.dom.contains(target)
          ? (target.closest('img') as HTMLImageElement | null)
          : null;

      if (!img) {
        // 正在输入描述：不自动收（用户可能在拖选文字 / 鼠标短暂移开）
        if (captionDraftRef.current !== null) return;
        // 既不在图片也不在工具条上：宽限一段再收（指针可能正走向工具条）
        if (hoverRef.current && clearTimerRef.current === null) {
          clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            clearHover();
          }, HOVER_KEEP_MS);
        }
        return;
      }

      cancelPendingClear();
      if (hoverRef.current?.img === img) return;
      const next = measureImage(editor, img);
      hoverRef.current = next;
      setHover(next);
    };
    const onBlurWindow = () => {
      cancelPendingClear();
      clearHover();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onBlurWindow);
    window.addEventListener('scroll', remeasureHover, true);
    window.addEventListener('resize', remeasureHover);
    return () => {
      cancelPendingClear();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onBlurWindow);
      window.removeEventListener('scroll', remeasureHover, true);
      window.removeEventListener('resize', remeasureHover);
    };
  }, [editor, clearHover, cancelPendingClear, remeasureHover]);

  useEffect(() => {
    // 文档任何变化（点对齐按钮 / 快捷键 / undo）都可能让图片挪位：重新量一遍，
    // 工具条跟着走（无 hover 时 remeasureHover 会直接返回，不进热路径）。
    const onUpdate = () => remeasureHover();
    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [editor, remeasureHover]);

  if (typeof document === 'undefined') return null;
  if (!hover || !editor.isEditable) return null;

  // 位置：默认贴图片左缘、浮在上方；顶上放不下（图片贴着视口上沿）就翻到下方
  const above = hover.top - TOOLBAR_HEIGHT - TOOLBAR_GAP >= 8;
  // active 从文档状态读（不读 DOM 属性：attrs 更新会换元素，DOM 引用不可靠）
  const nodeAttrs = editor.state.doc.nodeAt(hover.pos)?.attrs;
  const active = normalizeImageAlign(nodeAttrs?.align);
  const caption = normalizeImageCaption(nodeAttrs?.caption);
  const labelOf: Record<ImageAlign, string> = {
    left: labels.imageAlignLeft,
    center: labels.imageAlignCenter,
    right: labels.imageAlignRight,
  };

  const commitCaption = () => {
    if (captionDraft === null) return;
    setImageCaptionAtPos(editor, hover.pos, captionDraft);
    setCaptionDraft(null);
    // 描述显示在图片下方 → 几何变了，重新量一遍让工具条归位
    remeasureHover();
  };

  return createPortal(
    <div
      data-image-align=""
      className={styles.bar}
      role="toolbar"
      aria-label={labels.imageAlign}
      style={{
        left: hover.left,
        top: above
          ? hover.top - TOOLBAR_HEIGHT - TOOLBAR_GAP
          : hover.bottom + TOOLBAR_GAP,
      }}
      // 保住编辑器选区：点工具条不该先把光标丢掉；输入框例外（要能聚焦）
      onMouseDown={(e) => {
        if ((e.target as HTMLElement | null)?.closest?.('input')) return;
        e.preventDefault();
      }}
    >
      {ALIGNS.map((align) => {
        const Icon = ICONS[align];
        return (
          <button
            key={align}
            type="button"
            data-image-align-action={align}
            className={`${styles.btn} ${active === align ? styles.btnActive : ''}`}
            title={labelOf[align]}
            aria-label={labelOf[align]}
            aria-pressed={active === align}
            onClick={() => {
              setImageAlignAtPos(editor, hover.pos, align);
              // 对齐后图片会挪位：立即重测一遍让工具条跟过去（顺带刷新 active 态）
              remeasureHover();
            }}
          >
            <Icon size={14} />
          </button>
        );
      })}

      <span className={styles.divider} aria-hidden />

      <button
        type="button"
        data-image-align-action="caption"
        className={`${styles.btn} ${caption ? styles.btnActive : ''}`}
        title={labels.imageCaption}
        aria-label={labels.imageCaption}
        aria-pressed={!!caption}
        onClick={() => {
          // 已打开就交给输入框的 blur 提交；这里只管打开
          if (captionDraftRef.current !== null) return;
          setCaptionDraft(caption ?? '');
        }}
      >
        <CaptionsIcon size={14} />
      </button>

      {captionDraft !== null ? (
        <div className={styles.captionRow}>
          <input
            className={styles.captionInput}
            value={captionDraft}
            placeholder={labels.imageCaptionPlaceholder}
            aria-label={labels.imageCaptionPlaceholder}
            autoFocus
            onChange={(e) => setCaptionDraft(e.target.value)}
            onKeyDown={(e) => {
              // 按键别冒进编辑器：Enter 提交、Esc 取消
              e.stopPropagation();
              if (e.key === 'Enter') commitCaption();
              else if (e.key === 'Escape') setCaptionDraft(null);
            }}
            onBlur={commitCaption}
          />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
