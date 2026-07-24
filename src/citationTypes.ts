import type { ReactNode } from 'react';

/** 脚注圆标 NodeView 插槽上下文——数据源查找 / Popover 由消费方完成。 */
export interface RenderCitationContext {
  /** 与 markdown `[^n]` 中的 n 对齐。 */
  index: string;
  attrs: {
    index: string;
    url?: string | null;
    title?: string | null;
  };
  /** 库默认圆标 DOM；消费方通常用 Popover 包住它。 */
  defaultDom: ReactNode;
}

export type RenderCitation = (ctx: RenderCitationContext) => ReactNode;

/**
 * SSR 阅读页增强插槽：在已有 `.citation-ref` DOM 上挂宿主浮层。
 * 与 {@link RenderCitation} 同构（按 index 查数据），输入是锚点元素而非 defaultDom。
 */
export interface RenderCitationInteractiveContext {
  index: string;
  attrs: {
    index: string;
    url?: string | null;
    title?: string | null;
  };
  /** 被激活的圆标 DOM，供 Popover 锚定定位。 */
  anchorEl: HTMLElement;
  /** 关闭浮层。 */
  close: () => void;
}

export type RenderCitationInteractive = (
  ctx: RenderCitationInteractiveContext,
) => ReactNode;
