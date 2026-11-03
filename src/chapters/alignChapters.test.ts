import { describe, expect, it } from 'vitest';
import {
  alignChapters,
  type ChapterBaseline,
  type ChapterDraft,
} from './alignChapters';

function base(
  sectionId: number,
  leadBlockId: string | null,
  content: string,
  revision = 1,
): ChapterBaseline {
  return { sectionId, revision, leadBlockId, content };
}

function draft(leadBlockId: string | null, content: string): ChapterDraft {
  return { leadBlockId, content };
}

describe('alignChapters：RFC §7.4', () => {
  it('纯内容变：前缀段同章，只进 changed', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A'), base(2, 'b_b', 'B', 7)],
      [draft('b_a', 'A'), draft('b_b', 'B2')],
    );
    expect(delta).toEqual({
      changed: [{ sectionId: 2, expectedRevision: 7, content: 'B2' }],
      created: [],
      deleted: [],
      order: [1, 2],
    });
  });

  it('内容没变：全空，不发请求', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A'), base(2, 'b_b', 'B')],
      [draft('b_a', 'A'), draft('b_b', 'B')],
    );
    expect(delta).toEqual({ changed: [], created: [], deleted: [], order: [1, 2] });
  });

  it('中间插入 H2：新建章锚在前一现存章后面', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A'), base(2, 'b_b', 'B')],
      [draft('b_a', 'A'), draft('b_new', 'N'), draft('b_b', 'B')],
    );
    expect(delta.changed).toEqual([]);
    expect(delta.created).toEqual([{ afterSectionId: 1, content: 'N' }]);
    expect(delta.deleted).toEqual([]);
    expect(delta.order).toEqual([1, 2]);
  });

  it('末尾追加：afterSectionId = 最后一个现存章', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A')],
      [draft('b_a', 'A'), draft('b_new', 'N')],
    );
    expect(delta.created).toEqual([{ afterSectionId: 1, content: 'N' }]);
    expect(delta.order).toEqual([1]);
  });

  it('删除 H2（含边界声明）：被删章进 deleted，后续章保身份', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A'), base(2, 'b_b', 'B'), base(3, 'b_c', 'C')],
      [draft('b_a', 'A'), draft('b_c', 'C')],
    );
    expect(delta.changed).toEqual([]);
    expect(delta.created).toEqual([]);
    expect(delta.deleted).toEqual([2]);
    expect(delta.order).toEqual([1, 3]);
  });

  it('纯调序：按 ID 全部匹配，order 是新顺序', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A'), base(2, 'b_b', 'B'), base(3, 'b_c', 'C')],
      [draft('b_c', 'C'), draft('b_a', 'A'), draft('b_b', 'B')],
    );
    expect(delta).toEqual({
      changed: [],
      created: [],
      deleted: [],
      order: [3, 1, 2],
    });
  });

  it('首存全建：基线为空，全部 created、afterSectionId 为 null', () => {
    const delta = alignChapters(
      [],
      [draft('b_a', 'A'), draft('b_b', 'B')],
    );
    expect(delta.changed).toEqual([]);
    expect(delta.created).toEqual([
      { afterSectionId: null, content: 'A' },
      { afterSectionId: null, content: 'B' },
    ]);
    expect(delta.deleted).toEqual([]);
    expect(delta.order).toEqual([]);
  });

  it('多章新建时，afterSectionId 取「前一现存章」（跳过新建章）', () => {
    const delta = alignChapters(
      [base(1, 'b_a', 'A'), base(2, 'b_b', 'B')],
      [
        draft('b_a', 'A'),
        draft('b_n1', 'N1'),
        draft('b_n2', 'N2'),
        draft('b_b', 'B'),
      ],
    );
    expect(delta.created).toEqual([
      { afterSectionId: 1, content: 'N1' },
      { afterSectionId: 1, content: 'N2' },
    ]);
    expect(delta.order).toEqual([1, 2]);
  });

  it('内容比对剥块 ID 注释：只有 ID 行不同不算变更', () => {
    const delta = alignChapters(
      [base(1, 'b_a', '<!--b:b_a-->\n## 甲\n\n正文')],
      [draft('b_a', '<!--b:b_a-->\n## 甲\n\n正文\n')],
    );
    expect(delta.changed).toEqual([]);
  });

  it('内容真变了（剥 ID 后仍不同）才算 changed', () => {
    const delta = alignChapters(
      [base(1, 'b_a', '<!--b:b_a-->\n正文')],
      [draft('b_a', '<!--b:b_a-->\n正文改')],
    );
    expect(delta.changed).toHaveLength(1);
    expect(delta.changed[0].content).toBe('<!--b:b_a-->\n正文改');
  });

  it('基线章首 ID 为 null 且没在前缀对上 → 删除', () => {
    const delta = alignChapters(
      [base(1, null, 'A'), base(2, 'b_b', 'B')],
      [draft('b_b', 'B')],
    );
    expect(delta.changed).toEqual([]);
    expect(delta.created).toEqual([]);
    expect(delta.deleted).toEqual([1]);
    expect(delta.order).toEqual([2]);
  });

  it('边界声明：删除 H2 标题且正文独立成新章首 → 合并章新建、被删章删除', () => {
    // 基线：甲/乙/丙三章，章首分别是 H2（b_h1/b_h2/b_h3）。
    // 当前：删掉「## 乙」标题，正文乙变成独立顶层块（b_p2，不在基线章首序列），
    // 与丙章之间仍是 H2 边界。v1 按「该章新建 + 乙章删除」处理，内容无损但身份断链。
    const delta = alignChapters(
      [
        base(1, 'b_h1', '## 甲\n\n正文甲'),
        base(2, 'b_h2', '## 乙\n\n正文乙'),
        base(3, 'b_h3', '## 丙\n\n正文丙'),
      ],
      [
        draft('b_h1', '## 甲\n\n正文甲'),
        draft('b_p2', '正文乙'),
        draft('b_h3', '## 丙\n\n正文丙'),
      ],
    );
    expect(delta.changed).toEqual([]);
    expect(delta.created).toEqual([{ afterSectionId: 1, content: '正文乙' }]);
    expect(delta.deleted).toEqual([2]);
    expect(delta.order).toEqual([1, 3]);
  });
});
