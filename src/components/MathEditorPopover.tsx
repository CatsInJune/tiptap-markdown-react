'use client';

import * as Popover from '@radix-ui/react-popover';
import type { Editor } from '@tiptap/react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
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

function getMathAnchorRect(
  editor: Editor,
  kind: MathKind,
  pos?: number,
): DOMRect {
  const editorRect = editor.view.dom.getBoundingClientRect();
  if (pos != null) {
    const dom = editor.view.nodeDOM(pos);
    const el =
      dom instanceof HTMLElement
        ? dom
        : dom instanceof Node
          ? dom.parentElement
          : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (kind === 'block') {
        return new DOMRect(editorRect.left, r.top, editorRect.width, r.height);
      }
      return r;
    }
  }
  const coords = editor.view.coordsAtPos(editor.state.selection.from);
  if (kind === 'block') {
    return new DOMRect(editorRect.left, coords.bottom, editorRect.width, 0);
  }
  return new DOMRect(coords.left, coords.bottom, 0, 0);
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
  const [rect, setRect] = useState(() => getMathAnchorRect(editor, kind, pos));
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const confirmedRef = useRef(false);
  const isBlock = kind === 'block';

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  useEffect(() => {
    const update = () => setRect(getMathAnchorRect(editor, kind, pos));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [editor, kind, pos]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pos == null) return;
    const dom = editor.view.nodeDOM(pos);
    const el =
      dom instanceof HTMLElement
        ? dom
        : dom instanceof Node
          ? dom.parentElement
          : null;
    if (!el) return;
    el.classList.add('tmr-math-editing');
    return () => {
      el.classList.remove('tmr-math-editing');
    };
  }, [editor, pos]);

  const preview = useMemo(
    () => renderMathHtml(draft.trim(), isBlock),
    [draft, isBlock],
  );
  const canSubmit = draft.trim().length > 0;
  const showHint = !canSubmit && mode === 'insert';

  const submit = () => {
    if (!canSubmit) return;
    confirmedRef.current = true;
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

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open && !confirmedRef.current) onCancel();
      }}
    >
      <Popover.Anchor asChild>
        <span
          className={styles.mathAnchor}
          style={{ left: rect.left, top: rect.top }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className={styles.mathContent}
          side="bottom"
          align="start"
          sideOffset={mode === 'edit' ? 0 : 6}
          collisionPadding={12}
          style={isBlock ? { width: Math.max(rect.width, 280) } : undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className={
              isBlock
                ? `${styles.mathStack} ${styles.mathStackBlock}`
                : styles.mathStack
            }
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
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
                title={isBlock ? `${doneLabel} (⌘/Ctrl+Enter)` : `${doneLabel} (Enter)`}
                onClick={submit}
              >
                {doneLabel}
                <span className={styles.mathDoneKbd} aria-hidden>
                  ↵
                </span>
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
