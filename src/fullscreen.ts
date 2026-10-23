/**
 * 工具栏「全屏 / 退出全屏」。
 *
 * 铺满视口，而不是调 Fullscreen API：下拉菜单、表格手柄、图片工具条都 portal 到
 * `document.body`，进了浏览器的全屏层就看不见了。容器上打 `data-tmr-fullscreen`，
 * 样式在 `styles/fullscreen.css`。
 */

import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isComposingKeyEvent } from './findReplace';

const FULLSCREEN_ATTR = 'data-tmr-fullscreen';
const ROOT_ATTR = 'data-tmr-fullscreen-root';

/**
 * 这些层自己消费 Esc（查找条、灯箱、公式、快捷键抽屉、斜杠 / 表情、表格菜单、
 * 块菜单、Radix 下拉）。捕获阶段它们还在，就让给它们；下一次 Esc 再退出全屏。
 * 不能靠 `defaultPrevented`：ProseMirror 对 Escape 几乎总会 preventDefault。
 */
const ESCAPE_GUARDS = [
  '[data-radix-popper-content-wrapper]',
  '[data-table-menu]',
  '[data-block-drag-menu]',
  '[data-find-bar]',
  '[data-image-lightbox]',
  '[data-crop-box]',
  '[role="dialog"]',
  '[role="listbox"]',
  '[role="menu"]',
].join(',');

/** 显式指定要铺满的节点。函数和 ref 都在点击时再读，方便 ref 晚一拍挂上。 */
export type FullscreenTarget =
  | HTMLElement
  | null
  | (() => HTMLElement | null)
  | { readonly current: HTMLElement | null };

let savedBodyOverflow: string | null = null;

function readExplicitTarget(
  target: FullscreenTarget | undefined,
): HTMLElement | null {
  if (typeof target === 'function') return target();
  if (target instanceof HTMLElement) return target;
  if (target && typeof target === 'object' && 'current' in target) {
    return target.current instanceof HTMLElement ? target.current : null;
  }
  return null;
}

/**
 * 没指定目标时，从工具栏往上找「里面已经有编辑器」的那一层。
 * 工具栏和正文是兄弟节点时，父元素就是这一层；工具栏再多包一层时也能找到。
 * 不升到 `body`，避免把整页都固定住。
 */
function defaultFullscreenElement(toolbarRoot: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = toolbarRoot.parentElement;
  while (
    node &&
    node !== document.body &&
    node !== document.documentElement
  ) {
    if (node.querySelector('.ProseMirror')) return node;
    node = node.parentElement;
  }
  return toolbarRoot.parentElement;
}

export function resolveFullscreenElement(
  target: FullscreenTarget | undefined,
  toolbarRoot: HTMLElement | null,
): HTMLElement | null {
  const explicit = readExplicitTarget(target);
  if (explicit) return explicit;
  if (!toolbarRoot) return null;
  return defaultFullscreenElement(toolbarRoot);
}

export function enterFullscreen(el: HTMLElement) {
  el.setAttribute(FULLSCREEN_ATTR, '');
  document.documentElement.setAttribute(ROOT_ATTR, '');
  if (savedBodyOverflow === null) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

export function leaveFullscreen(el: HTMLElement | null) {
  el?.removeAttribute(FULLSCREEN_ATTR);
  if (document.querySelector(`[${FULLSCREEN_ATTR}]`)) return;
  document.documentElement.removeAttribute(ROOT_ATTR);
  if (savedBodyOverflow !== null) {
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
}

export function useToolbarFullscreen({
  enabled,
  target,
  toolbarRootRef,
  editor,
  onChange,
}: {
  enabled: boolean;
  target: FullscreenTarget | undefined;
  toolbarRootRef: { readonly current: HTMLElement | null };
  editor: Editor;
  onChange?: (fullscreen: boolean) => void;
}): { fullscreen: boolean; toggleFullscreen: () => void } {
  const [fullscreen, setFullscreen] = useState(false);
  const activeRef = useRef<HTMLElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const exit = useCallback(() => {
    if (!activeRef.current) return;
    leaveFullscreen(activeRef.current);
    activeRef.current = null;
    setFullscreen(false);
    onChangeRef.current?.(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (activeRef.current) {
      exit();
      return;
    }
    const el = resolveFullscreenElement(target, toolbarRootRef.current);
    if (!el) return;
    enterFullscreen(el);
    activeRef.current = el;
    setFullscreen(true);
    onChangeRef.current?.(true);
    if (!editor.isDestroyed) editor.commands.focus();
  }, [editor, exit, target, toolbarRootRef]);

  useEffect(() => {
    if (enabled) return;
    exit();
  }, [enabled, exit]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isComposingKeyEvent(event)) return;
      if (document.querySelector(ESCAPE_GUARDS)) return;
      if (
        !editor.isDestroyed &&
        editor.view.dom.classList.contains('tmr-format-painter')
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      exit();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [fullscreen, editor, exit]);

  useEffect(() => {
    return () => {
      if (!activeRef.current) return;
      leaveFullscreen(activeRef.current);
      activeRef.current = null;
      onChangeRef.current?.(false);
    };
  }, []);

  return { fullscreen, toggleFullscreen };
}
