'use client';

import type { Editor } from '@tiptap/react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { renderMathHtml, type MathKind } from '../math';
import styles from '../styles/toolbar.module.css';

export interface MathEditorPopoverProps {
  editor: Editor;
  kind: MathKind;
  mode: 'insert' | 'edit';
  pos?: number;
  latex: string;
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

/** 相对编辑器外壳的坐标：浮层挂在壳内，随 .scrollArea 一起滚，避免 fixed 脱锚。 */
function getMathLayerStyle(
  editor: Editor,
  kind: MathKind,
  mode: 'insert' | 'edit',
  pos?: number,
): CSSProperties {
  const host = editor.view.dom.parentElement;
  if (!host) return {};
  const hostRect = host.getBoundingClientRect();
  const editorRect = editor.view.dom.getBoundingClientRect();
  const gap = mode === 'edit' ? 0 : 6;
  const blockWidth = editor.view.dom.clientWidth;

  if (pos != null) {
    const el = resolveNodeEl(editor, pos);
    if (el) {
      const r = el.getBoundingClientRect();
      if (kind === 'block') {
        return {
          left: editorRect.left - hostRect.left,
          top: r.top - hostRect.top + gap,
          width: blockWidth,
        };
      }
      return {
        left: r.left - hostRect.left,
        top: r.top - hostRect.top + gap,
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
  newLabel,
  placeholder,
  doneLabel,
  onConfirm,
  onCancel,
}: MathEditorPopoverProps) {
  const [draft, setDraft] = useState(latex);
  const [layerStyle, setLayerStyle] = useState<CSSProperties>(() =>
    getMathLayerStyle(editor, kind, mode, pos),
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
    const update = () =>
      setLayerStyle(getMathLayerStyle(editor, kind, mode, pos));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [editor, kind, mode, pos]);

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
    const onPtr = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      onCancel();
    };
    document.addEventListener('pointerdown', onPtr);
    return () => document.removeEventListener('pointerdown', onPtr);
  }, [onCancel]);

  const preview = useMemo(
    () => renderMathHtml(draft.trim(), isBlock),
    [draft, isBlock],
  );
  const canSubmit = draft.trim().length > 0;
  const showHint = !canSubmit && mode === 'insert';

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
        ) : (
          <div
            id={titleId}
            className={
              isBlock ? styles.mathPreviewBlock : styles.mathPreviewInline
            }
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
        <div
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
