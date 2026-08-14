'use client';

import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import styles from '../styles/comment.module.css';

export interface CommentPopoverProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 被点击的 mark 元素（from onCommentClick 的 anchorEl）。 */
  anchorEl: HTMLElement | null;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

/**
 * 评论浮层（Radix）。库只负责锚定与外观，内容由宿主通过 children 提供
 * （典型：评论正文 + Resolve/Dismiss/Reopen 操作）。
 * 锚点是点击 mark 的动态元素：渲染一个 fixed 1x1 span 挂在 anchorEl 的
 * getBoundingClientRect 位置，Radix 以它为锚。
 */
export function CommentPopover({
  open,
  onOpenChange,
  anchorEl,
  children,
  side = 'top',
  align = 'start',
  sideOffset = 6,
}: CommentPopoverProps) {
  const rect = open && anchorEl ? anchorEl.getBoundingClientRect() : null;
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {rect && (
        <Popover.Anchor asChild>
          <span
            className={styles.popoverAnchor}
            style={{ left: rect.left, top: rect.top }}
          />
        </Popover.Anchor>
      )}
      <Popover.Portal>
        <Popover.Content
          className={styles.popoverContent}
          side={side}
          align={align}
          sideOffset={sideOffset}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
