import type { Node as PMNode, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';

/**
 * 手柄拖过来的是一块闭合节点（openStart 为 0）。ProseMirror 的 dropPoint
 * 第二轮会找包装：列表正好能把段落 / 标题包成 listItem，于是单行块会掉进列表里。
 * 列表在这个编辑器里是一整块，落点只能在它外面（上半段前面，下半段后面）。
 */
const LIST_NAMES = new Set(['bulletList', 'orderedList', 'taskList']);

const draggingViews = new WeakSet<EditorView>();

export const blockDragListGuardKey = new PluginKey('blockDragListGuard');

export function setBlockHandleDragging(view: EditorView, dragging: boolean) {
  if (dragging) draggingViews.add(view);
  else draggingViews.delete(view);
}

export function isBlockHandleDragging(view: EditorView): boolean {
  return draggingViews.has(view);
}

function outermostListDepth(doc: PMNode, pos: number): number {
  const safe = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(safe);
  let listDepth = -1;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (LIST_NAMES.has($pos.node(depth).type.name)) listDepth = depth;
  }
  return listDepth;
}

/** 坐标落在某份列表（含其中的条目）里面。 */
export function isPosInsideList(doc: PMNode, pos: number): boolean {
  return outermostListDepth(doc, pos) > 0;
}

/**
 * 把列表内部的位置抬到最外层那份列表的边界。
 * `after` 为真时放在列表后面，否则放在前面。
 */
export function listEscapePos(
  doc: PMNode,
  pos: number,
  after: boolean,
): number | null {
  const listDepth = outermostListDepth(doc, pos);
  if (listDepth < 0) return null;
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  const start = $pos.before(listDepth);
  const node = $pos.node(listDepth);
  return after ? start + node.nodeSize : start;
}

/** 指针在列表盒的下半段时落到列表后面，否则落到前面。 */
export function listEscapeEdge(
  view: EditorView,
  pos: number,
  clientY: number,
): number | null {
  const listDepth = outermostListDepth(view.state.doc, pos);
  if (listDepth < 0) return null;
  const $pos = view.state.doc.resolve(
    Math.max(0, Math.min(pos, view.state.doc.content.size)),
  );
  const start = $pos.before(listDepth);
  const node = $pos.node(listDepth);
  const dom = view.nodeDOM(start);
  let after = pos >= start + node.nodeSize / 2;
  if (dom instanceof HTMLElement) {
    const rect = dom.getBoundingClientRect();
    if (rect.height > 0) after = clientY >= rect.top + rect.height / 2;
  }
  return after ? start + node.nodeSize : start;
}

/**
 * 把手柄拖来的切片挪到 `insertPos`。位置落在被拖的选区内部时不挪。
 * 返回 true 表示这次落点已经由我们处理（包括故意不挪）。
 */
export function moveDraggedSlice(
  view: EditorView,
  slice: Slice,
  insertPos: number,
): boolean {
  const { state } = view;
  const { from, to } = state.selection;
  if (insertPos > from && insertPos < to) return true;

  const tr = state.tr;
  tr.deleteSelection();
  const pos = tr.mapping.map(insertPos, 1);
  const block =
    slice.openStart === 0 &&
    slice.openEnd === 0 &&
    slice.content.childCount === 1
      ? slice.content.firstChild
      : null;
  if (block) tr.replaceRangeWith(pos, pos, block);
  else tr.replaceRange(pos, pos, slice);
  if (tr.doc.eq(state.doc)) return true;

  const $pos = tr.doc.resolve(Math.max(0, Math.min(pos, tr.doc.content.size)));
  const near = TextSelection.findFrom($pos, 1, true) ?? TextSelection.findFrom($pos, -1, true);
  if (near) tr.setSelection(near);
  try {
    view.focus();
  } catch {
    // 无 window 的环境里 focus 会抛；文档修改仍然要提交。
  }
  view.dispatch(tr.setMeta('uiEvent', 'drop').scrollIntoView());
  return true;
}

function snappedListEdge(
  view: EditorView,
  clientX: number,
  clientY: number,
  slice: Slice,
): number | null {
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;
  const natural = dropPoint(view.state.doc, coords.pos, slice);
  const probe = natural ?? coords.pos;
  if (!isPosInsideList(view.state.doc, probe)) return null;
  return listEscapeEdge(view, probe, clientY);
}

/** 列表内部的落点指示挪到整份列表的上沿或下沿，避免画在条目之间。 */
function placeBlockDropCursor(view: EditorView, pos: number) {
  const parent = view.dom.offsetParent;
  if (!(parent instanceof HTMLElement)) return;
  const cursor = parent.querySelector(
    '.prosemirror-dropcursor-block, .prosemirror-dropcursor-inline',
  );
  if (!(cursor instanceof HTMLElement)) return;

  const $pos = view.state.doc.resolve(pos);
  const before = $pos.nodeBefore;
  const anchorPos = before ? pos - before.nodeSize : pos;
  const anchor = view.nodeDOM(anchorPos);
  if (!(anchor instanceof HTMLElement)) return;
  const anchorRect = anchor.getBoundingClientRect();
  let lineTop = before ? anchorRect.bottom : anchorRect.top;
  if (before && $pos.nodeAfter) {
    const next = view.nodeDOM(pos);
    if (next instanceof HTMLElement) {
      lineTop = (anchorRect.bottom + next.getBoundingClientRect().top) / 2;
    }
  }

  const editorRect = view.dom.getBoundingClientRect();
  const scaleX = editorRect.width / view.dom.offsetWidth || 1;
  const scaleY = editorRect.height / view.dom.offsetHeight || 1;
  const parentRect = parent.getBoundingClientRect();
  const parentScaleX = parentRect.width / parent.offsetWidth || 1;
  const parentScaleY = parentRect.height / parent.offsetHeight || 1;
  const parentLeft = parentRect.left - parent.scrollLeft * parentScaleX;
  const parentTop = parentRect.top - parent.scrollTop * parentScaleY;
  const half = scaleY;

  cursor.classList.add('prosemirror-dropcursor-block');
  cursor.classList.remove('prosemirror-dropcursor-inline');
  cursor.style.left = `${(anchorRect.left - parentLeft) / scaleX}px`;
  cursor.style.top = `${(lineTop - half - parentTop) / scaleY}px`;
  cursor.style.width = `${(anchorRect.right - anchorRect.left) / scaleX}px`;
  cursor.style.height = `${(2 * half) / scaleY}px`;
}

export function blockDragListGuardPlugin(): Plugin {
  return new Plugin({
    key: blockDragListGuardKey,
    props: {
      handleDrop(view, event, slice, moved) {
        if (!moved || !isBlockHandleDragging(view)) return false;
        const edge = snappedListEdge(view, event.clientX, event.clientY, slice);
        if (edge == null) return false;
        moveDraggedSlice(view, slice, edge);
        return true;
      },
    },
    view(editorView) {
      const onDragOver = (event: DragEvent) => {
        const slice = editorView.dragging?.slice;
        if (!slice || !isBlockHandleDragging(editorView)) return;
        const edge = snappedListEdge(
          editorView,
          event.clientX,
          event.clientY,
          slice,
        );
        if (edge == null) return;
        placeBlockDropCursor(editorView, edge);
      };
      editorView.dom.addEventListener('dragover', onDragOver);
      return {
        destroy() {
          editorView.dom.removeEventListener('dragover', onDragOver);
          setBlockHandleDragging(editorView, false);
        },
      };
    },
  });
}
