'use client';

import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useState } from 'react';
import { useEditorBundle } from '../i18n/store';
import type { MathKind } from '../math';
import { MathEditorPopover } from './MathEditorPopover';
import { useMarkdownLocale } from './TiptapConfigProvider';

export interface MathEditingLayerProps {
  /** 编辑器实例。只读态不接管点击。 */
  editor: Editor;
}

interface MathEdit {
  kind: MathKind;
  pos: number;
  latex: string;
}

/** 官方公式 NodeView 的包裹元素；行内是 span、块级是 div。 */
const MATH_SELECTOR = '[data-type="inline-math"], [data-type="block-math"]';

/**
 * 点击公式 → 打开编辑器。节点位置从 NodeView 的 DOM 反查，不依赖工具栏的全局事件。
 * 多个编辑器各挂一份，监听器只在自己的 `editor.view.dom` 上，互不串台。
 */
function resolveMathClick(
  editor: Editor,
  target: EventTarget | null,
): MathEdit | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(MATH_SELECTOR);
  if (!el || !editor.view.dom.contains(el)) return null;

  const kind: MathKind =
    el.getAttribute('data-type') === 'block-math' ? 'block' : 'inline';
  const expected = kind === 'block' ? 'blockMath' : 'inlineMath';

  let pos: number | null = null;
  try {
    pos = editor.view.posAtDOM(el, 0);
  } catch {
    pos = null;
  }
  if (pos == null) return null;

  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== expected) return null;
  return { kind, pos, latex: String(node.attrs.latex ?? '') };
}

/**
 * 公式的点击编辑层：挂在编辑器壳里，替代原来由 `<EditorToolbar>` 注册的全局点击回调。
 * 没挂工具栏的宿主也能点开公式；有工具栏时仍然只有这一层处理点击（工具栏只负责插入）。
 */
export function MathEditingLayer({ editor }: MathEditingLayerProps) {
  const t = useEditorBundle(editor, useMarkdownLocale()).toolbar;
  const [edit, setEdit] = useState<MathEdit | null>(null);

  useEffect(() => {
    setEdit(null);
    if (!editor.isEditable) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      if (!editor.isEditable) return;
      const next = resolveMathClick(editor, event.target);
      if (next) setEdit(next);
    };
    // capture：官方 NodeView 自己的 click 处理器会 stopPropagation，冒泡阶段收不到。
    dom.addEventListener('click', onClick, true);
    return () => dom.removeEventListener('click', onClick, true);
  }, [editor]);

  const apply = useCallback(
    (latex: string) => {
      if (!edit) return;
      const { kind, pos } = edit;
      setEdit(null);
      if (kind === 'inline') {
        editor.chain().updateInlineMath({ latex, pos }).run();
      } else {
        editor.chain().updateBlockMath({ latex, pos }).run();
      }
    },
    [edit, editor],
  );

  const cancel = useCallback(() => setEdit(null), []);

  if (!edit) return null;

  return (
    <MathEditorPopover
      editor={editor}
      kind={edit.kind}
      mode="edit"
      pos={edit.pos}
      latex={edit.latex}
      portalHost={typeof document === 'undefined' ? null : document.body}
      newLabel={edit.kind === 'inline' ? t.mathNewInline : t.mathNewBlock}
      placeholder={t.mathPlaceholder}
      doneLabel={t.mathDone}
      onConfirm={apply}
      onCancel={cancel}
    />
  );
}
