import { normalizeMarkdown } from '../normalizeMarkdown';

/** 保存基线里的一章（RFC §7.4）。`leadBlockId` = 章首块的块 ID。 */
export interface ChapterBaseline {
  sectionId: number;
  revision: number;
  leadBlockId: string | null;
  content: string;
}

/** 当前文档切出来的一章。 */
export interface ChapterDraft {
  leadBlockId: string | null;
  content: string;
}

export interface ChapterDelta {
  changed: { sectionId: number; expectedRevision: number; content: string }[];
  created: { afterSectionId: number | null; content: string }[];
  deleted: number[];
  /** 现存章按当前序列；新建章由后端分配 sectionId 后回填。 */
  order: number[];
}

/** 内容比对：剥块 ID 注释 + 编辑器整篇规范化的等价写法。 */
function comparable(content: string): string {
  return normalizeMarkdown(content).replace(/\n+$/, '');
}

/** 先做逐字相等短路（常见路径），再走规范化比对。 */
function sameContent(a: string, b: string): boolean {
  return a === b || comparable(a) === comparable(b);
}

/**
 * 对齐「基线章」与「当前章」（RFC §7.4）。
 *
 * 说明：RFC §3.1 的分层原则要求「库代码里不出现 section/revision」，但 §7.4 的
 * 对齐接口本身以 sectionId/revision 为字段。这里按 §7.4 的显式接口实现——库只做
 * 纯计算、不做任何协议 I/O，协议词汇只是宿主传入/取回的透传值。
 *
 * 1. **前缀段**：`leadBlockId` 逐位相同视为同章；内容（normalize 后）变 → `changed`，
 *    不变跳过；首个不同位 = 分叉点；
 * 2. **剩余段**：按 `leadBlockId` 建 Map 匹配——匹配上且内容变 → `changed`（保身份）；
 *    当前章 ID 基线没有 → `created`（`afterSectionId` = 当前序列中前一现存章）；
 *    基线 ID 无主 → `deleted`；
 * 3. **无基线**（新建报告 / 旧单章首存）：全量 `created`；
 * 4. `order` = 现存章按当前序列。
 *
 * 已知边界（RFC §7.4 诚实声明）：删除 H2 标题且正文并入相邻章时，合并章的首块 ID
 * 与被删章不同，按「该章新建 + 被删章删除」处理（内容无损，身份/历史断链）。v1 接受。
 */
export function alignChapters(
  baseline: ChapterBaseline[],
  current: ChapterDraft[],
): ChapterDelta {
  const changed: ChapterDelta['changed'] = [];
  const created: ChapterDelta['created'] = [];
  const deleted: number[] = [];
  const order: number[] = [];

  // 剩余段按章首 ID 找基线（ID 重复时先出现的基线优先）。
  const baselineById = new Map<string, ChapterBaseline>();
  for (const chapter of baseline) {
    if (chapter.leadBlockId != null && !baselineById.has(chapter.leadBlockId)) {
      baselineById.set(chapter.leadBlockId, chapter);
    }
  }
  const matchedBaseline = new Set<ChapterBaseline>();

  // 1) 前缀段：位置与章首 ID 都一致才视为同一序列。
  const prefixLimit = Math.min(baseline.length, current.length);
  let fork = 0;
  while (
    fork < prefixLimit &&
    current[fork].leadBlockId === baseline[fork].leadBlockId
  ) {
    const base = baseline[fork];
    const draft = current[fork];
    if (!sameContent(base.content, draft.content)) {
      changed.push({
        sectionId: base.sectionId,
        expectedRevision: base.revision,
        content: draft.content,
      });
    }
    order.push(base.sectionId);
    matchedBaseline.add(base);
    if (base.leadBlockId != null) baselineById.delete(base.leadBlockId);
    fork += 1;
  }

  // 2) 剩余段：按章首 ID 匹配身份，匹配不上的是新建。
  let previousExistingSectionId: number | null = order.length
    ? order[order.length - 1]
    : null;
  for (let i = fork; i < current.length; i += 1) {
    const draft = current[i];
    const matched =
      draft.leadBlockId != null
        ? baselineById.get(draft.leadBlockId)
        : undefined;

    if (matched) {
      if (!sameContent(matched.content, draft.content)) {
        changed.push({
          sectionId: matched.sectionId,
          expectedRevision: matched.revision,
          content: draft.content,
        });
      }
      order.push(matched.sectionId);
      previousExistingSectionId = matched.sectionId;
      matchedBaseline.add(matched);
      baselineById.delete(draft.leadBlockId as string);
      continue;
    }

    created.push({
      afterSectionId: previousExistingSectionId,
      content: draft.content,
    });
  }

  // 3) 基线里没被当前序列认领的章 = 删除（含章首 ID 为 null、无法按 ID 匹配的旧章）。
  for (const chapter of baseline) {
    if (!matchedBaseline.has(chapter)) deleted.push(chapter.sectionId);
  }

  return { changed, created, deleted, order };
}
