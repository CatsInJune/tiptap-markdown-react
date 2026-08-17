'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderMathHtml, type MathKind } from '../math';
import styles from '../styles/toolbar.module.css';

export interface MathEditorPopoverProps {
  kind: MathKind;
  latex: string;
  title: string;
  placeholder: string;
  doneLabel: string;
  cancelLabel: string;
  onConfirm: (latex: string) => void;
  onCancel: () => void;
}

export function MathEditorPopover({
  kind,
  latex,
  title,
  placeholder,
  doneLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: MathEditorPopoverProps) {
  const [draft, setDraft] = useState(latex);
  const titleId = useId();

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const preview = renderMathHtml(draft.trim(), kind === 'block');
  const canSubmit = draft.trim().length > 0;

  return createPortal(
    <div
      className={styles.mathOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className={styles.mathPopover}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div id={titleId} className={styles.mathTitle}>
          {title}
        </div>
        <textarea
          className={styles.mathTextarea}
          value={draft}
          placeholder={placeholder}
          autoFocus
          rows={kind === 'block' ? 5 : 3}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div
          className={styles.mathPreview}
          dangerouslySetInnerHTML={{ __html: preview }}
        />
        <div className={styles.mathActions}>
          <button
            type="button"
            className={styles.mathBtn}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.mathBtn} ${styles.mathBtnPrimary}`}
            disabled={!canSubmit}
            onClick={() => onConfirm(draft.trim())}
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
