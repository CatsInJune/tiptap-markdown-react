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
 * SSR 阅读页：圆标被 hover/click 激活时交给宿主的载荷。
 * 与 {@link RenderCitation} 同构（按 index 查数据），输入是锚点元素而非 defaultDom。
 * 开/关状态由宿主管，库只报事件。
 */
export interface CitationEnterContext {
  index: string;
  attrs: {
    index: string;
    url?: string | null;
    title?: string | null;
  };
  /** 被激活的圆标 DOM，供 Popover 锚定定位。 */
  anchorEl: HTMLElement;
}

export type OnCitationEnter = (ctx: CitationEnterContext) => void;
export type OnCitationLeave = () => void;
