import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { chunkMarkdownBlocks, splitTopLevelMarkdown } from './splitMarkdownBlocks';
import { scheduleVersionDiff } from './diffDecorations';
import { recallVersionJson, rememberVersionJson, versionCacheKey } from './versionJsonCache';

const FIRST_CHARS = 8000;
const BATCH_CHARS = 24000;

/**
 * 先装首屏，其余块空闲时接上，不进撤销。装完按版本 id 记住 JSON。
 * 返回取消函数：切到下一版时停掉还没装的块。
 */
export function loadVersionPreview(options: {
  editor: Editor;
  markdown: string;
  cacheId?: string;
  onReady: () => void;
}): () => void {
  const { editor, markdown, onReady } = options;
  const key = versionCacheKey(options.cacheId, markdown);
  let cancelled = false;
  let cancelScheduled = () => {};

  const finish = () => {
    if (cancelled || editor.isDestroyed) return;
    rememberVersionJson(key, editor.getJSON());
    onReady();
  };

  const cached = recallVersionJson(key);
  if (cached?.content?.length) {
    const parts = chunkNodes(cached.content, FIRST_CHARS, BATCH_CHARS);
    editor.commands.setContent({ type: 'doc', content: parts.head }, { emitUpdate: false });
    cancelScheduled = runLater(
      parts.rest.map((nodes) => () => insertAtEnd(editor, nodes)),
      finish,
      () => cancelled || editor.isDestroyed,
    );
  } else {
    const parts = chunkMarkdownBlocks(splitTopLevelMarkdown(markdown), FIRST_CHARS, BATCH_CHARS);
    editor.commands.setContent(parts.first || '', {
      contentType: 'markdown',
      emitUpdate: false,
    });
    cancelScheduled = runLater(
      parts.rest.map((chunk) => () => insertAtEnd(editor, chunk)),
      finish,
      () => cancelled || editor.isDestroyed,
    );
  }

  return () => {
    cancelled = true;
    cancelScheduled();
  };
}

function runLater(steps: Array<() => void>, done: () => void, stopped: () => boolean): () => void {
  if (steps.length === 0) {
    done();
    return () => {};
  }
  let cancel = () => {};
  let index = 0;
  const next = () => {
    if (stopped()) return;
    if (index >= steps.length) {
      done();
      return;
    }
    const step = steps[index];
    index += 1;
    cancel = scheduleVersionDiff(() => {
      if (stopped()) return;
      step();
      next();
    });
  };
  next();
  return () => cancel();
}

function insertAtEnd(editor: Editor, content: string | JSONContent[]): void {
  if (editor.isDestroyed) return;
  const pos = insertionPos(editor.state.doc);
  editor
    .chain()
    .command(({ tr }) => {
      tr.setMeta('addToHistory', false);
      return true;
    })
    .insertContentAt(
      pos,
      content,
      typeof content === 'string' ? { contentType: 'markdown' } : {},
    )
    .run();
}

/** 尾部那个空段是编辑器补的，后续块插在它前面。 */
function insertionPos(doc: PMNode): number {
  const last = doc.lastChild;
  if (doc.childCount > 1 && last?.type.name === 'paragraph' && last.content.size === 0) {
    return doc.content.size - last.nodeSize;
  }
  return doc.content.size;
}

function chunkNodes(
  nodes: JSONContent[],
  budget: number,
  batch: number,
): { head: JSONContent[]; rest: JSONContent[][] } {
  if (nodes.length === 0) return { head: [], rest: [] };
  const head: JSONContent[] = [];
  let size = 0;
  let index = 0;
  do {
    head.push(nodes[index]);
    size += jsonSize(nodes[index]);
    index += 1;
  } while (index < nodes.length && size < budget);
  const rest: JSONContent[][] = [];
  while (index < nodes.length) {
    const group: JSONContent[] = [];
    let groupSize = 0;
    do {
      group.push(nodes[index]);
      groupSize += jsonSize(nodes[index]);
      index += 1;
    } while (index < nodes.length && groupSize < batch);
    rest.push(group);
  }
  return { head, rest };
}

function jsonSize(node: JSONContent): number {
  const own = node.text?.length ?? 1;
  return own + (node.content ?? []).reduce((sum, child) => sum + jsonSize(child), 0);
}
