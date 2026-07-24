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
  /** 指针进入 / 点击圆标。宿主据此 setState 打开自己的 Popover。 */
  onCitationEnter: OnCitationEnter;
  /**
   * 离开圆标区域（hover：真正离开圆标；click：点正文非圆标处）或 Escape。
   * 库立即回调，不做延迟——延迟关闭与 portal 桥接由宿主管。
   */
  onCitationLeave: OnCitationLeave;
  /** 默认 click；hover 适合桌面预览。 */
  trigger?: 'click' | 'hover';
}

/**
 * SSR 阅读页脚注增强：只做事件委托，**不持有 open 状态**。
 *
 * hover 用 pointerover / pointerout + relatedTarget 判断，避免在「正文其它节点
 * 的冒泡 mouseover」上误 leave（那是圆标闪烁的常见根因）。
 */
export function CitationInteractive({
  containerRef,
  onCitationEnter,
  onCitationLeave,
  trigger = 'click',
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
      if (el === currentEl) return;
      currentEl = el;
      const attrs = readCitationAttrs(el);
      enterRef.current({ index: attrs.index, attrs, anchorEl: el });
    };

    const emitLeave = () => {
      if (!currentEl) return;
      currentEl = null;
      leaveRef.current();
    };

    const onClick = (e: MouseEvent) => {
      const el = findCitationRefElement(e.target, root);
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        // 再点同一圆标 → 关闭（toggle）
        if (el === currentEl) {
          emitLeave();
          return;
        }
        emitEnter(el);
        return;
      }
      emitLeave();
    };

    const onPointerOver = (e: PointerEvent) => {
      const el = findCitationRefElement(e.target, root);
      if (el) emitEnter(el);
    };

    const onPointerOut = (e: PointerEvent) => {
      if (!currentEl) return;
      const related = e.relatedTarget;
      // 仍在当前圆标内（子节点之间移动）
      if (related instanceof Node && currentEl.contains(related)) return;
      // 移到另一圆标
      const next = findCitationRefElement(related, root);
      if (next) {
        emitEnter(next);
        return;
      }
      emitLeave();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') emitLeave();
    };

    if (trigger === 'hover') {
      root.addEventListener('pointerover', onPointerOver);
      root.addEventListener('pointerout', onPointerOut);
    } else {
      root.addEventListener('click', onClick);
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, trigger]);

  return null;
}
