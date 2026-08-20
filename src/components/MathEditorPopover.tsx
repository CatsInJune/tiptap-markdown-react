'use client';

import type { Editor } from '@tiptap/react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { renderMathInto, type MathKind } from '../math';
import styles from '../styles/toolbar.module.css';

export interface MathEditorPopoverProps {
  editor: Editor;
  kind: MathKind;
  mode: 'insert' | 'edit';
  pos?: number;
  latex: string;
  /** 工具栏新插入：取消时删掉占位节点 */
  isNew?: boolean;
  newLabel: string;
  placeholder: string;
  doneLabel: string;
  onConfirm: (latex: string) => void;
  onCancel: () => void;
}

function resolveNodeEl(editor: Editor, pos: number): HTMLElement | null {
  const dom = editor.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) return dom;
  if (dom instanceof Node) return dom.parentElement;
  return null;
}

function mathRenderTarget(el: HTMLElement, isBlock: boolean): HTMLElement {
  if (!isBlock) return el;
  return (el.querySelector('.block-math-inner') as HTMLElement | null) ?? el;
}

function getMathLayerStyle(
  editor: Editor,
  kind: MathKind,
  pos?: number,
): CSSProperties {
  const host = editor.view.dom.parentElement;
  if (!host) return {};
  const hostRect = host.getBoundingClientRect();
  const editorRect = editor.view.dom.getBoundingClientRect();
  const gap = 6;
  const blockWidth = editor.view.dom.clientWidth;

  if (pos != null) {
    const el = resolveNodeEl(editor, pos);
    if (el) {
      const r = el.getBoundingClientRect();
      const top = r.bottom - hostRect.top + gap;
      if (kind === 'block') {
        return {
          left: editorRect.left - hostRect.left,
          top,
          width: blockWidth,
        };
      }
      return {
        left: r.left - hostRect.left,
        top,
      };
    }
  }

  const coords = editor.view.coordsAtPos(editor.state.selection.from);
  if (kind === 'block') {
    return {
      left: editorRect.left - hostRect.left,
      top: coords.bottom - hostRect.top + gap,
      width: blockWidth,
    };
  }
  return {
    left: coords.left - hostRect.left,
    top: coords.bottom - hostRect.top + gap,
  };
}

export function MathEditorPopover({
  editor,
  kind,
  mode,
  pos,
  latex,
  isNew = false,
  newLabel,
  placeholder,
  doneLabel,
  onConfirm,
  onCancel,
}: MathEditorPopoverProps) {
  const [draft, setDraft] = useState(latex);
  const [layerStyle, setLayerStyle] = useState<CSSProperties>(() =>
    getMathLayerStyle(editor, kind, pos),
  );
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isBlock = kind === 'block';
  const host = editor.view.dom.parentElement;

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  useEffect(() => {
    const update = () => setLayerStyle(getMathLayerStyle(editor, kind, pos));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [editor, kind, pos, draft]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pos == null) return;
    const el = resolveNodeEl(editor, pos);
    if (!el) return;
    el.classList.add('tmr-math-editing');
    return () => {
      el.classList.remove('tmr-math-editing');
    };
  }, [editor, pos]);

  useEffect(() => {
    if (pos == null) return;
    const el = resolveNodeEl(editor, pos);
    if (!el) return;
    const target = mathRenderTarget(el, isBlock);
    const src = draft.trim();
    if (src) renderMathInto(target, src, isBlock);
    else target.textContent = '';
  }, [draft, pos, editor, isBlock]);

  useEffect(() => {
    if (pos == null || isNew) return;
    const el = resolveNodeEl(editor, pos);
    if (!el) return;
    const target = mathRenderTarget(el, isBlock);
    return () => {
      const restore = latex.trim();
      if (restore) renderMathInto(target, restore, isBlock);
      else target.textContent = '';
    };
  }, [pos, editor, isBlock, latex, isNew]);

  useEffect(() => {
    const onPtr = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (pos != null) {
        const el = resolveNodeEl(editor, pos);
        if (el?.contains(target)) return;
      }
      onCancel();
    };
    document.addEventListener('pointerdown', onPtr);
    return () => document.removeEventListener('pointerdown', onPtr);
  }, [onCancel, editor, pos]);

  const canSubmit = draft.trim().length > 0;
  const showHint = !canSubmit && (mode === 'insert' || isNew);

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(draft.trim());
  };

  const onKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Enter') return;
    if (isBlock && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    submit();
  };

  const field = isBlock ? (
    <textarea
      ref={inputRef as RefObject<HTMLTextAreaElement>}
      className={styles.mathInput}
      value={draft}
      placeholder={placeholder}
      rows={Math.max(3, draft.split('\n').length)}
      aria-labelledby={titleId}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
    />
  ) : (
    <input
      ref={inputRef as RefObject<HTMLInputElement>}
      className={styles.mathInput}
      value={draft}
      placeholder={placeholder}
      aria-labelledby={titleId}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );

  if (!host) return null;

  return createPortal(
    <div
      ref={rootRef}
      className={styles.mathLayer}
      style={layerStyle}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <div
        className={
          isBlock
            ? `${styles.mathStack} ${styles.mathStackBlock}`
            : styles.mathStack
        }
      >
        {showHint ? (
          <div
            id={titleId}
            className={
              isBlock
                ? `${styles.mathHint} ${styles.mathHintBlock}`
                : styles.mathHint
            }
          >
            <span className={styles.mathHintIcon} aria-hidden>
              {isBlock ? 'TeX' : '√x'}
            </span>
            {newLabel}
          </div>
        ) : null}
        <div
          id={showHint ? undefined : titleId}
          className={
            isBlock
              ? `${styles.mathField} ${styles.mathFieldBlock}`
              : styles.mathField
          }
        >
          {field}
          <button
            type="button"
            className={styles.mathDone}
            disabled={!canSubmit}
            title={
              isBlock ? `${doneLabel} (⌘/Ctrl+Enter)` : `${doneLabel} (Enter)`
            }
            onClick={submit}
          >
            {doneLabel}
            <span className={styles.mathDoneKbd} aria-hidden>
              ↵
            </span>
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
