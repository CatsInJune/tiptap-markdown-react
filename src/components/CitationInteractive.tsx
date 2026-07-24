'use client';

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  findCitationRefElement,
  readCitationAttrs,
} from '../citationDom';
import type { RenderCitationInteractive } from '../citationTypes';

/** 宿主浮层根节点挂此属性，hover 移入 portal 浮层时库会取消关闭。 */
export const CITATION_POPOVER_ATTR = 'data-tmr-citation-popover';

export interface CitationInteractiveProps {
  /**
   * 包含 `ReportContent` HTML 的根节点（其内应有 `.citation-ref`）。
   * 用同一 ref 包住 ReportContent 即可。
   */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * 激活圆标时调用。宿主用 `anchorEl` + `index` 渲染 Popover；
   * 数据源完全由宿主持有。
   */
  renderCitation: RenderCitationInteractive;
  /** 默认 click；hover 适合桌面预览。 */
  trigger?: 'click' | 'hover';
  /**
   * hover 离开圆标 / 正文后延迟关闭的毫秒数。
   * 给指针移入 portal 浮层留时间；默认 200。
   */
  hoverCloseDelayMs?: number;
}

interface ActiveCitation {
  index: string;
  attrs: {
    index: string;
    url: string | null;
    title: string | null;
  };
  anchorEl: HTMLElement;
}

function isCitationPopoverTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(`[${CITATION_POPOVER_ATTR}]`)
  );
}

/**
 * SSR 阅读页脚注增强：在静态 HTML 圆标上事件委托，把 `index` + `anchorEl`
 * 交给宿主 `renderCitation`（与编辑器 NodeView 插槽同构，挂载方式不同）。
 *
 * hover 关闭语义：
 * - 离开当前圆标（移到正文其它处）→ 延迟关闭
 * - 离开整篇正文根节点（常见路径：去 portal 浮层）→ 延迟关闭，勿立刻清
 * - 指针进入带 `data-tmr-citation-popover` 的宿主浮层 → 取消关闭
 * - Escape → 立刻关闭
 *
 * 用法：
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * <div ref={ref}>
 *   <ReportContent html={html} />
 *   <CitationInteractive
 *     containerRef={ref}
 *     trigger="hover"
 *     renderCitation={({ index, anchorEl, close }) => (
 *       <Popover>
 *         <div data-tmr-citation-popover>…</div>
 *       </Popover>
 *     )}
 *   />
 * </div>
 * ```
 */
export function CitationInteractive({
  containerRef,
  renderCitation,
  trigger = 'click',
  hoverCloseDelayMs = 200,
}: CitationInteractiveProps) {
  const [active, setActive] = useState<ActiveCitation | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const clearCloseTimer = () => {
      if (closeTimerRef.current != null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };

    const scheduleClose = () => {
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setActive(null);
      }, hoverCloseDelayMs);
    };

    const activate = (el: HTMLElement, e?: Event) => {
      e?.preventDefault();
      e?.stopPropagation();
      clearCloseTimer();
      const attrs = readCitationAttrs(el);
      setActive({ index: attrs.index, attrs, anchorEl: el });
    };

    const onClick = (e: MouseEvent) => {
      const el = findCitationRefElement(e.target, root);
      if (el) {
        activate(el, e);
        return;
      }
      // 点在容器内非圆标处 → 关闭（浮层若 portal 到 body，点浮层不会进这里）
      setActive(null);
    };

    const onMouseOver = (e: MouseEvent) => {
      const el = findCitationRefElement(e.target, root);
      if (el) {
        activate(el, e);
        return;
      }
      // 正文内非圆标：延迟关闭（可移到其它圆标或浮层时被取消）
      scheduleClose();
    };

    // 离开整篇正文（含去 portal 浮层的路径）→ 延迟关闭，勿立刻清 active
    const onRootMouseLeave = () => scheduleClose();

    // 浮层在 body：进浮层时取消关闭；离开浮层且未回到圆标则关闭
    const onDocMouseOver = (e: MouseEvent) => {
      if (isCitationPopoverTarget(e.target)) {
        clearCloseTimer();
      }
    };

    const onDocMouseOut = (e: MouseEvent) => {
      if (!isCitationPopoverTarget(e.target)) return;
      // 仍在同一浮层内移动
      if (isCitationPopoverTarget(e.relatedTarget)) return;
      // 回到圆标
      if (findCitationRefElement(e.relatedTarget, root)) return;
      scheduleClose();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearCloseTimer();
        setActive(null);
      }
    };

    if (trigger === 'hover') {
      root.addEventListener('mouseover', onMouseOver);
      root.addEventListener('mouseleave', onRootMouseLeave);
      document.addEventListener('mouseover', onDocMouseOver);
      document.addEventListener('mouseout', onDocMouseOut);
    } else {
      root.addEventListener('click', onClick);
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearCloseTimer();
      root.removeEventListener('mouseover', onMouseOver);
      root.removeEventListener('mouseleave', onRootMouseLeave);
      root.removeEventListener('click', onClick);
      document.removeEventListener('mouseover', onDocMouseOver);
      document.removeEventListener('mouseout', onDocMouseOut);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, trigger, hoverCloseDelayMs]);

  if (!active) return null;

  return (
    <>
      {renderCitation({
        index: active.index,
        attrs: active.attrs,
        anchorEl: active.anchorEl,
        close: () => {
          if (closeTimerRef.current != null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
          setActive(null);
        },
      })}
    </>
  );
}
