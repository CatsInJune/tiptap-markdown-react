'use client';

import { useRef, type ComponentProps } from 'react';
import type { RenderCitationInteractive } from '../citationTypes';
import { ReportContent } from '../ReportContent';
import { CitationInteractive } from './CitationInteractive';

export interface ReportContentInteractiveProps
  extends Omit<ComponentProps<typeof ReportContent>, 'ref'> {
  /** 与编辑器 `renderCitation` 同构：按 index 查数据、渲染 Popover。 */
  renderCitation: RenderCitationInteractive;
  trigger?: 'click' | 'hover';
  /** 透传 {@link CitationInteractive} hover 延迟关闭。 */
  hoverCloseDelayMs?: number;
}

/**
 * SSR HTML 阅读 + 脚注交互的便捷封装。
 * 内部：`ReportContent`（静态 HTML）+ `CitationInteractive`（事件委托）。
 */
export function ReportContentInteractive({
  renderCitation,
  trigger,
  hoverCloseDelayMs,
  className,
  html,
  ...rest
}: ReportContentInteractiveProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className={className}>
      <ReportContent html={html} {...rest} />
      <CitationInteractive
        containerRef={ref}
        renderCitation={renderCitation}
        trigger={trigger}
        hoverCloseDelayMs={hoverCloseDelayMs}
      />
    </div>
  );
}
