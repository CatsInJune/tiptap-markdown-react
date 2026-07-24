'use client';

import { useRef, type ComponentProps } from 'react';
import type { OnCitationEnter, OnCitationLeave } from '../citationTypes';
import { ReportContent } from '../ReportContent';
import { CitationInteractive } from './CitationInteractive';

export interface ReportContentInteractiveProps
  extends Omit<ComponentProps<typeof ReportContent>, 'ref'> {
  /** 点击圆标：宿主 setState 打开自己的 Popover。 */
  onCitationEnter: OnCitationEnter;
  /** 点外部 / 再点圆标 / Escape：宿主关闭。 */
  onCitationLeave: OnCitationLeave;
}

/**
 * SSR HTML 阅读 + 脚注 click 委托的便捷封装。
 * 内部：`ReportContent` + `CitationInteractive`（只报事件，仅 click）。
 */
export function ReportContentInteractive({
  onCitationEnter,
  onCitationLeave,
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
      />
    </div>
  );
}
