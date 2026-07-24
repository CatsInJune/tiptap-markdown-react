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
   * 离开圆标区域（hover：离开圆标或正文根；click：点正文非圆标处）或 Escape。
   * 库立即回调，不做延迟——延迟关闭与 portal 桥接由宿主管。
   */
  onCitationLeave: OnCitationLeave;
  /** 默认 click；hover 适合桌面预览。 */
  trigger?: 'click' | 'hover';
}

/**
 * SSR 阅读页脚注增强：只做事件委托，**不持有 open 状态**。
 *
 * hover 下同一圆标只 emit 一次 enter（mouseover 会在子节点间反复冒泡），
 * 避免宿主 setState 重渲导致圆标 :hover 闪烁。
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

    /** 当前已 enter 的圆标；用于去重与判断是否真的 leave。 */
    let currentEl: HTMLElement | null = null;

    const emitEnter = (el: HTMLElement, e?: Event) => {
      if (el === currentEl) return;
      currentEl = el;
      e?.preventDefault();
      e?.stopPropagation();
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
        emitEnter(el, e);
        return;
      }
      emitLeave();
    };

    const onMouseOver = (e: MouseEvent) => {
      const el = findCitationRefElement(e.target, root);
      if (el) {
        emitEnter(el, e);
        return;
      }
      emitLeave();
    };

    const onRootMouseLeave = () => emitLeave();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') emitLeave();
    };

    if (trigger === 'hover') {
      root.addEventListener('mouseover', onMouseOver);
      root.addEventListener('mouseleave', onRootMouseLeave);
    } else {
      root.addEventListener('click', onClick);
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      root.removeEventListener('mouseover', onMouseOver);
      root.removeEventListener('mouseleave', onRootMouseLeave);
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, trigger]);

  return null;
}
