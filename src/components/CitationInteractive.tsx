'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  findCitationRefElement,
  readCitationAttrs,
} from '../citationDom';
import type {
  OnCitationEnter,
  OnCitationLeave,
} from '../citationTypes';

export interface CitationInteractiveProps {
  /**
   * 包含 `ReportContent` HTML 的根节点（其内应有 `.citation-ref`）。
   * 用同一 ref 包住 ReportContent 即可。
   */
  containerRef: RefObject<HTMLElement | null>;
  /** 点击圆标。宿主据此 setState 打开自己的 Popover。 */
  onCitationEnter: OnCitationEnter;
  /**
   * 点正文非圆标处 / 再点同一圆标 / Escape。
   * 库立即回调；浮层开关由宿主管。
   */
  onCitationLeave: OnCitationLeave;
}

/**
 * SSR 阅读页脚注增强：只做 **click** 事件委托，不持有 open 状态。
 *
 * ```tsx
 * <CitationInteractive
 *   containerRef={ref}
 *   onCitationEnter={setActive}
 *   onCitationLeave={() => setActive(null)}
 * />
 * ```
 */
export function CitationInteractive({
  containerRef,
  onCitationEnter,
  onCitationLeave,
}: CitationInteractiveProps) {
  const enterRef = useRef(onCitationEnter);
  const leaveRef = useRef(onCitationLeave);
  enterRef.current = onCitationEnter;
  leaveRef.current = onCitationLeave;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let currentEl: HTMLElement | null = null;

    const emitEnter = (el: HTMLElement) => {
      currentEl = el;
      const attrs = readCitationAttrs(el);
      enterRef.current({ index: attrs.index, attrs, anchorEl: el });
    };

    const emitLeave = () => {
      if (!currentEl) return;
      currentEl = null;
      leaveRef.current();
    };

    const ACTIVE_ATTR = 'data-tmr-citation-active';

    const onClick = (e: MouseEvent) => {
      const el = findCitationRefElement(e.target, root);
      if (el) {
        // 捕获阶段就取消默认，避免圆标内 <a> 跳转
        e.preventDefault();
        e.stopPropagation();
        // 仅当该圆标仍处于打开态时再点才关闭（宿主可能已外部关闭，attr 已清）
        if (el === currentEl && el.hasAttribute(ACTIVE_ATTR)) {
          emitLeave();
          return;
        }
        emitEnter(el);
        return;
      }
      emitLeave();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') emitLeave();
    };

    root.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      root.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef]);

  return null;
}
