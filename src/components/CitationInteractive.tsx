'use client';

import {
  useEffect,
  useState,
  type RefObject,
} from 'react';
import {
  findCitationRefElement,
  readCitationAttrs,
} from '../citationDom';
import type { RenderCitationInteractive } from '../citationTypes';

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

/**
 * SSR 阅读页脚注增强：在静态 HTML 圆标上事件委托，把 `index` + `anchorEl`
 * 交给宿主 `renderCitation`（与编辑器 NodeView 插槽同构，挂载方式不同）。
 *
 * 用法：
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * <div ref={ref}>
 *   <ReportContent html={html} />
 *   <CitationInteractive
 *     containerRef={ref}
 *     renderCitation={({ index, anchorEl, close }) => (
 *       <Popover anchorEl={anchorEl} onClose={close}>…</Popover>
 *     )}
 *   />
 * </div>
 * ```
 */
export function CitationInteractive({
  containerRef,
  renderCitation,
  trigger = 'click',
}: CitationInteractiveProps) {
  const [active, setActive] = useState<ActiveCitation | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const activate = (el: HTMLElement, e?: Event) => {
      e?.preventDefault();
      e?.stopPropagation();
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
      if (el) activate(el, e);
    };

    const onMouseLeave = () => setActive(null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };

    if (trigger === 'hover') {
      root.addEventListener('mouseover', onMouseOver);
      root.addEventListener('mouseleave', onMouseLeave);
    } else {
      root.addEventListener('click', onClick);
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      root.removeEventListener('mouseover', onMouseOver);
      root.removeEventListener('mouseleave', onMouseLeave);
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, trigger]);

  if (!active) return null;

  return (
    <>
      {renderCitation({
        index: active.index,
        attrs: active.attrs,
        anchorEl: active.anchorEl,
        close: () => setActive(null),
      })}
    </>
  );
}
