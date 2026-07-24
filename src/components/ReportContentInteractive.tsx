'use client';

import { useRef, type ComponentProps } from 'react';
import type { OnCitationEnter, OnCitationLeave } from '../citationTypes';
import { ReportContent } from '../ReportContent';
import { CitationInteractive } from './CitationInteractive';

export interface ReportContentInteractiveProps
  extends Omit<ComponentProps<typeof ReportContent>, 'ref'> {
  /** 圆标激活：宿主 setState 打开自己的 Popover。 */
  onCitationEnter: OnCitationEnter;
  /** 离开圆标区域 / Escape：宿主决定立即关或延迟关。 */
  onCitationLeave: OnCitationLeave;
  trigger?: 'click' | 'hover';
}

/**
 * SSR HTML 阅读 + 脚注事件委托的便捷封装。
 * 内部：`ReportContent`（静态 HTML）+ `CitationInteractive`（只报事件）。
 * Popover 由宿主在外部渲染，不经本组件。
 */
export function ReportContentInteractive({
  onCitationEnter,
  onCitationLeave,
  trigger,
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
        onCitationEnter={onCitationEnter}
        onCitationLeave={onCitationLeave}
        trigger={trigger}
      />
    </div>
  );
}
