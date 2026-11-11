import { Extension } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { VersionDiffMark } from './buildDiffDoc';

export const versionDiffKey = new PluginKey<DecorationSet>('versionDiff');

export const versionDiffExtension = Extension.create({
  name: 'versionDiff',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: versionDiffKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(versionDiffKey) as DecorationSet | undefined;
            if (next) return next;
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return versionDiffKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function marksToDecorations(doc: Node, marks: VersionDiffMark[]): DecorationSet {
  const decorations: Decoration[] = [];
  const size = doc.content.size;
  for (const mark of marks) {
    if (!mark.text) continue;
    if (mark.diff === 'delete') {
      const at = clamp(mark.from, 0, size);
      decorations.push(
        Decoration.widget(at, () => deleteWidget(mark), {
          side: -1,
          ignoreSelection: true,
          key: `del:${at}:${mark.text}`,
        }),
      );
      continue;
    }
    const from = clamp(mark.from, 0, size);
    const to = clamp(mark.to, 0, size);
    if (to <= from) continue;
    const attrs = mark.block
      ? { 'data-diff': 'insert', 'data-diff-region': '' }
      : { 'data-diff': 'insert' };
    decorations.push(
      mark.block ? Decoration.node(from, to, attrs) : Decoration.inline(from, to, attrs),
    );
  }
  if (decorations.length === 0) return DecorationSet.empty;
  try {
    return DecorationSet.create(doc, decorations);
  } catch (error) {
    console.error('version diff decorations failed', error);
    return DecorationSet.empty;
  }
}

function deleteWidget(mark: VersionDiffMark): HTMLElement {
  const el = document.createElement(mark.block ? 'div' : 'span');
  el.setAttribute('data-diff', 'delete');
  if (mark.block) {
    el.setAttribute('data-diff-region', '');
    el.style.width = 'fit-content';
    el.style.maxWidth = '100%';
  }
  if (mark.type === 'chart') el.className = 'tmr-chart';
  el.textContent = mark.text;
  return el;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** 空闲时算差异；切到下一版时取消上一版。没有 requestIdleCallback 时退回一个 macrotask。 */
export function scheduleVersionDiff(work: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) work();
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(() => run(), { timeout: 200 });
    return () => {
      cancelled = true;
      cancelIdleCallback(id);
    };
  }
  const id = window.setTimeout(run, 1);
  return () => {
    cancelled = true;
    window.clearTimeout(id);
  };
}
