// @vitest-environment happy-dom

/**
 * SPIKE 验证三个关键点：
 * 1. markdown 导出剥离评论 mark（落库干净）；
 * 2. 重叠评论经 mergeCommentIntervals 合并后正确铺 mark；
 * 3. mark 跟随编辑、边界不扩展、undo/redo 可用、粘贴不泄漏。
 * 另附 mapper 在「表格密集的真实卡片 markdown」上的命中/降级行为。
 */

import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { Fragment, Slice } from '@tiptap/pm/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { baseExtensions } from '../extensions';
import { CommentMark, type CommentInterval } from './CommentMark';
import {
  COMMENT_ACTIVE_META,
  COMMENT_CLICK_META,
  commentAnchorExtension,
  commentAnchorPluginKey,
  stripCommentAnchorMarks,
} from './commentAnchorPlugin';
import {
  applyCommentAnchorsToEditor,
  collectCommentIds,
  focusComment,
  nextComment,
} from './commentAnchorController';
import {
  mapCommentAnchors,
  mergeCommentIntervals,
  type CommentAnchorInput,
} from './commentMapper';
import type { CommentClickPayload, CommentRef } from './commentTypes';

const SAMPLE_MD = `## 一、公司概览

寒武纪成立于2016年，是中国目前少数全面掌握AI芯片全栈自研能力的独立芯片设计企业（Fabless模式）。

**FY2025关键财务指标**

| 指标 | FY2025 | FY2024 |
|-----|--------|--------|
| 营业收入 | 649,720万元 | 117,446万元 |
| 归母净利润 | +205,923万元 | -45,234万元 |

## 二、产品线

思元370是首款Chiplet技术AI芯片。`;

function buildEditor(content: string): Editor {
  return new Editor({
    extensions: [...baseExtensions, CommentMark, Markdown],
    content,
    contentType: 'markdown',
  });
}

function buildEditorWithPlugin(
  content: string,
  options: { showGutter?: boolean; interactive?: boolean } = {},
): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      CommentMark,
      commentAnchorExtension(options),
      Markdown,
    ],
    content,
    contentType: 'markdown',
  });
}

function findTextRange(editor: Editor, needle: string): {
  from: number;
  to: number;
} {
  const doc = editor.state.doc;
  const slices: Array<{ pos: number; text: string }> = [];
  const offsets: number[] = [];
  let cursor = 0;
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      slices.push({ pos, text: node.text });
      offsets.push(cursor);
      cursor += node.text.length;
    }
    return true;
  });
  offsets.push(cursor);
  const full = slices.map((s) => s.text).join('');
  const idx = full.indexOf(needle);
  expect(idx, `needle "${needle}" 未找到`).toBeGreaterThanOrEqual(0);
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < slices.length; i++) {
    if (offsets[i] <= idx && idx < offsets[i + 1]) startIdx = i;
    if (offsets[i] < idx + needle.length && idx + needle.length <= offsets[i + 1])
      endIdx = i;
    if (startIdx >= 0 && endIdx >= 0) break;
  }
  return {
    from: slices[startIdx].pos + (idx - offsets[startIdx]),
    to: slices[endIdx].pos + (idx + needle.length - offsets[endIdx]),
  };
}

function countCommentMarks(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'commentAnchor'))
      count += 1;
    return true;
  });
  return count;
}

describe('CommentMark · markdown 剥离', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = buildEditor(SAMPLE_MD);
  });
  afterEach(() => editor.destroy());

  it('apply 后 getMarkdown() 输出纯文本，无评论残留', () => {
    const range = findTextRange(editor, '思元370是首款Chiplet技术AI芯片');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    expect(countCommentMarks(editor)).toBeGreaterThan(0);

    const out = editor.getMarkdown();
    expect(out).not.toContain('tmr-comment');
    expect(out).not.toContain('data-comment-ids');
    expect(out).not.toContain('commentAnchor');
    expect(out).toContain('思元370是首款Chiplet技术AI芯片');
  });

  it('renderHTML 输出 mark[data-comment-ids]（复制携带/只读 HTML 的形态）', () => {
    const range = findTextRange(editor, '营业收入');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    const html = editor.getHTML();
    expect(html).toContain('<mark');
    expect(html).toContain('data-comment-ids="1"');
  });

  it('clearCommentAnchors 清空全部评论 mark', () => {
    const range = findTextRange(editor, '思元370是首款Chiplet技术AI芯片');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    expect(countCommentMarks(editor)).toBeGreaterThan(0);
    editor.chain().clearCommentAnchors().run();
    expect(countCommentMarks(editor)).toBe(0);
  });
});

describe('CommentMark · 编辑跟随 / undo / 粘贴', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = buildEditor('第一段文字需要被评论。');
  });
  afterEach(() => editor.destroy());

  it('区间内部插入字符 → 新字符继承评论 mark', () => {
    const range = findTextRange(editor, '需要被评论');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    editor.chain().insertContentAt(range.from + 2, 'X').run();

    let marked = false;
    editor.state.doc.descendants((node) => {
      if (
        node.isText &&
        node.text?.includes('X') &&
        node.marks.some((m) => m.type.name === 'commentAnchor')
      ) {
        marked = true;
        return false;
      }
      return true;
    });
    expect(marked).toBe(true);
  });

  it('inclusive:false → 在区间末尾输入不会扩展评论 mark', () => {
    const range = findTextRange(editor, '需要被评论');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    editor.chain().insertContentAt(range.to, 'Y').run();

    let leaked = false;
    editor.state.doc.descendants((node) => {
      if (
        node.isText &&
        node.text?.includes('Y') &&
        node.marks.some((m) => m.type.name === 'commentAnchor')
      ) {
        leaked = true;
        return false;
      }
      return true;
    });
    expect(leaked).toBe(false);
  });

  it('锚定不进 undo 历史：undo 不会撤掉 mark，用户编辑仍可撤销', () => {
    const range = findTextRange(editor, '需要被评论');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    expect(countCommentMarks(editor)).toBeGreaterThan(0);
    // 铺 mark 后再做一次用户编辑，undo 应撤销编辑但保留 mark
    editor.chain().insertContentAt(range.from + 1, 'X').run();
    expect(editor.state.doc.textBetween(range.from, range.from + 5)).toContain(
      'X',
    );
    editor.commands.undo();
    expect(editor.state.doc.textBetween(range.from, range.from + 5)).not.toContain(
      'X',
    );
    expect(countCommentMarks(editor)).toBeGreaterThan(0);
  });

  it('stripCommentAnchorMarks 剔除 Slice 内评论 mark（粘贴守卫）', () => {
    const range = findTextRange(editor, '需要被评论');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    const schema = editor.schema;
    const text = schema.text('需要被评论', [
      schema.marks.commentAnchor.create({ commentIds: ['1'] }),
    ]);
    const slice = new Slice(Fragment.fromArray([text]), 0, 0);
    const stripped = stripCommentAnchorMarks(
      slice,
      schema.marks.commentAnchor,
    );
    const node = stripped.content.firstChild!;
    expect(node.isText).toBe(true);
    expect(node.marks.some((m) => m.type.name === 'commentAnchor')).toBe(false);
    expect(node.text).toBe('需要被评论');
  });
});

describe('mergeCommentIntervals · 重叠合并', () => {
  it('部分重叠 → 三段互斥区间，重叠段累积两个 commentId', () => {
    const intervals = mergeCommentIntervals([
      { commentId: '1', ranges: [{ from: 0, to: 5 }] },
      { commentId: '2', ranges: [{ from: 3, to: 10 }] },
    ]);
    expect(intervals).toEqual([
      { from: 0, to: 3, commentIds: ['1'] },
      { from: 3, to: 5, commentIds: ['1', '2'] },
      { from: 5, to: 10, commentIds: ['2'] },
    ]);
  });

  it('完全重叠 → 单区间两个 commentId', () => {
    const intervals = mergeCommentIntervals([
      { commentId: '1', ranges: [{ from: 0, to: 10 }] },
      { commentId: '2', ranges: [{ from: 0, to: 10 }] },
    ]);
    expect(intervals).toEqual([
      { from: 0, to: 10, commentIds: ['1', '2'] },
    ]);
  });

  it('同评论多段（跨段合并）→ 无重复 id', () => {
    const intervals = mergeCommentIntervals([
      { commentId: '1', ranges: [{ from: 0, to: 2 }, { from: 2, to: 4 }] },
      { commentId: '2', ranges: [{ from: 1, to: 3 }] },
    ]);
    expect(intervals).toEqual([
      { from: 0, to: 1, commentIds: ['1'] },
      { from: 1, to: 3, commentIds: ['1', '2'] },
      { from: 3, to: 4, commentIds: ['1'] },
    ]);
  });

  it('应用合并区间后，doc 重叠文本节点同时携带两个 commentId', () => {
    const editor = buildEditor('0123456789');
    const intervals: CommentInterval[] = [
      { from: 0, to: 3, commentIds: ['1'] },
      { from: 3, to: 8, commentIds: ['1', '2'] },
      { from: 8, to: 10, commentIds: ['2'] },
    ];
    editor.chain().applyCommentAnchors(intervals).run();

    const overlapIds: string[][] = [];
    editor.state.doc.descendants((node) => {
      if (node.isText) {
        const ids = node.marks
          .filter((m) => m.type.name === 'commentAnchor')
          .flatMap((m) => (m.attrs.commentIds as string[]) ?? []);
        if (ids.length) overlapIds.push(ids);
      }
      return true;
    });
    expect(overlapIds).toContainEqual(['1', '2']);
    editor.destroy();
  });
});

describe('commentMapper · 表格密集真实卡片语料', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = buildEditor(SAMPLE_MD);
  });
  afterEach(() => editor.destroy());

  const map = (input: CommentAnchorInput[]) =>
    mapCommentAnchors(editor.state.doc, input);

  it('正文段落 exact 命中', () => {
    const [r] = map([
      { commentId: '1', segments: [{ exact: '寒武纪成立于2016年' }] },
    ]);
    expect(r.status).toBe('matched');
    expect(r.ranges.length).toBe(1);
    const text = editor.state.doc.textBetween(r.ranges[0].from, r.ranges[0].to);
    expect(text).toBe('寒武纪成立于2016年');
  });

  it('表格单元格 exact 命中（无 DOM wrapper 噪音）', () => {
    const [r] = map([
      { commentId: '2', segments: [{ exact: '649,720万元' }] },
    ]);
    expect(r.status).toBe('matched');
    expect(editor.state.doc.textBetween(r.ranges[0].from, r.ranges[0].to)).toBe(
      '649,720万元',
    );
  });

  it('context（prefix+exact+suffix）命中且只圈 exact', () => {
    const [r] = map([
      {
        commentId: '3',
        segments: [
          {
            prefix: '寒武纪成立于2016年，是',
            exact: '中国目前少数',
            suffix: '全面掌握',
          },
        ],
      },
    ]);
    expect(r.status).toBe('matched');
    expect(editor.state.doc.textBetween(r.ranges[0].from, r.ranges[0].to)).toBe(
      '中国目前少数',
    );
  });

  it('原文被改 → 前缀 20 字降级命中', () => {
    const [r] = map([
      {
        commentId: '4',
        segments: [
          {
            exact:
              '寒武纪成立于2016年，是中国目前少数全面掌握AI芯片全栈自研能力的独立芯片设计企业（Fabless模式）。公司以自研MLU指令集为核心，构建云端、边缘端、终端三条产品线，旗舰思元系列历经六代迭代。',
          },
        ],
      },
    ]);
    expect(r.status).toBe('matched');
    const text = editor.state.doc.textBetween(r.ranges[0].from, r.ranges[0].to);
    expect(text.length).toBe(20);
    expect(text.startsWith('寒武纪成立于2016年')).toBe(true);
  });

  it('完全找不到 → outdated', () => {
    const [r] = map([
      { commentId: '5', segments: [{ exact: '完全不存在的一句话xyz' }] },
    ]);
    expect(r.status).toBe('outdated');
    expect(r.ranges).toEqual([]);
  });

  it('同文多次出现 → ambiguous', () => {
    const [r] = map([{ commentId: '6', segments: [{ exact: '万元' }] }]);
    expect(r.status).toBe('ambiguous');
    expect(r.ranges.length).toBeGreaterThan(1);
  });

  it('跨 block 的 needle 不命中（作用域正确）', () => {
    const [r] = map([
      { commentId: '7', segments: [{ exact: '模式）。**FY2025' }] },
    ]);
    expect(r.status).toBe('outdated');
  });

  it('多 segment：一段命中一段过期 → partial', () => {
    const [r] = map([
      {
        commentId: '8',
        segments: [
          { exact: '思元370是首款Chiplet技术AI芯片' },
          { exact: '完全不存在的一句话xyz' },
        ],
      },
    ]);
    expect(r.status).toBe('partial');
    expect(r.ranges.length).toBe(1);
  });
});

describe('commentAnchorController · 应用 / 聚焦 / 导航', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = buildEditorWithPlugin(SAMPLE_MD);
  });
  afterEach(() => editor.destroy());

  const comments: CommentRef[] = [
    {
      commentId: '1',
      segments: [{ exact: '寒武纪成立于2016年' }],
    },
    {
      commentId: '2',
      segments: [{ exact: '思元370是首款Chiplet技术AI芯片' }],
    },
  ];

  it('applyCommentAnchorsToEditor 铺 mark，collectCommentIds 按文档顺序去重', () => {
    applyCommentAnchorsToEditor(editor, comments);
    expect(collectCommentIds(editor)).toEqual(['1', '2']);
  });

  it('无评论时清空全部 mark（幂等）', () => {
    applyCommentAnchorsToEditor(editor, comments);
    expect(collectCommentIds(editor)).toEqual(['1', '2']);
    applyCommentAnchorsToEditor(editor, []);
    expect(collectCommentIds(editor)).toEqual([]);
  });

  it('focusComment 设 active + 光标落到区间起点；未知 id 清 active 返回 false', () => {
    applyCommentAnchorsToEditor(editor, comments);
    const ok = focusComment(editor, '1');
    expect(ok).toBe(true);
    expect(commentAnchorPluginKey.getState(editor.state)?.activeCommentId).toBe(
      '1',
    );
    const range = editor.state.selection.from;
    expect(editor.state.doc.textBetween(range, range + 5)).toBe('寒武纪成立');

    const missing = focusComment(editor, 'nope');
    expect(missing).toBe(false);
    expect(commentAnchorPluginKey.getState(editor.state)?.activeCommentId).toBe(
      null,
    );
  });

  it('nextComment 循环跳转', () => {
    applyCommentAnchorsToEditor(editor, comments);
    expect(nextComment(editor, 'next')).toBe('1');
    expect(nextComment(editor, 'next')).toBe('2');
    expect(nextComment(editor, 'next')).toBe('1');
    expect(nextComment(editor, 'prev')).toBe('2');
  });
});

describe('commentAnchorPlugin · 装饰与交互', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = buildEditorWithPlugin(SAMPLE_MD);
  });
  afterEach(() => editor.destroy());

  it('铺 mark 后 block 左缘出现 gutter 气泡', () => {
    const range = findTextRange(editor, '思元370是首款Chiplet技术AI芯片');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    const gutter = editor.view.dom.querySelector('.tmr-comment-gutter');
    expect(gutter).not.toBeNull();
    expect(gutter?.getAttribute('data-comment-ids')).toBe('1');
  });

  it('showGutter=false 不渲染 gutter', () => {
    const editorNoGutter = buildEditorWithPlugin(SAMPLE_MD, {
      showGutter: false,
    });
    const range = findTextRange(editorNoGutter, '思元370是首款Chiplet技术AI芯片');
    editorNoGutter.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    expect(
      editorNoGutter.view.dom.querySelector('.tmr-comment-gutter'),
    ).toBeNull();
    editorNoGutter.destroy();
  });

  it('active meta → 所在 block 加 active 类', () => {
    applyCommentAnchorsToEditor(editor, [
      { commentId: '1', segments: [{ exact: '寒武纪成立于2016年' }] },
    ]);
    editor.view.dispatch(
      editor.state.tr.setMeta(COMMENT_ACTIVE_META, '1'),
    );
    const activeBlock = editor.view.dom.querySelector(
      '.tmr-comment-block-active',
    );
    expect(activeBlock).not.toBeNull();
    expect(activeBlock?.textContent).toContain('寒武纪成立于2016年');
  });

  it('点击 mark → transaction meta 上报 commentIds + anchorEl', () => {
    applyCommentAnchorsToEditor(editor, [
      { commentId: '1', segments: [{ exact: '寒武纪成立于2016年' }] },
    ]);
    const clicks: CommentClickPayload[] = [];
    const onTr = ({ transaction }: { transaction: { getMeta: (k: string) => unknown } }) => {
      const click = transaction.getMeta(COMMENT_CLICK_META) as
        | CommentClickPayload
        | undefined;
      if (click) clicks.push(click);
    };
    editor.on('transaction', onTr);

    const markEl = editor.view.dom.querySelector(
      'mark.tmr-comment[data-comment-ids~="1"]',
    ) as HTMLElement | null;
    expect(markEl).not.toBeNull();
    markEl!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    // happy-dom 若未走 PM 事件链，兜底直调 handleClick props
    if (clicks.length === 0) {
      editor.view.someProp('handleClick', (fn) => {
        fn(editor.view, 1, { target: markEl } as unknown as MouseEvent);
      });
    }
    expect(clicks.length).toBeGreaterThan(0);
    expect(clicks[0].commentIds).toContain('1');
    expect(clicks[0].anchorEl).toBe(markEl);
    editor.off('transaction', onTr);
  });

  it('transformPasted 剥离评论 mark（粘贴/拖拽守卫）', () => {
    const range = findTextRange(editor, '思元370是首款Chiplet技术AI芯片');
    editor.chain().applyCommentAnchors([
      { from: range.from, to: range.to, commentIds: ['1'] },
    ]).run();
    const schema = editor.schema;
    const text = schema.text('思元370', [
      schema.marks.commentAnchor.create({ commentIds: ['1'] }),
    ]);
    const slice = new Slice(Fragment.fromArray([text]), 0, 0);
    let stripped: Slice | null = null;
    editor.view.someProp('transformPasted', (fn) => {
      stripped = fn(slice, editor.view, false);
    });
    expect(stripped).not.toBeNull();
    const node = stripped!.content.firstChild!;
    expect(
      node.marks.some((m) => m.type.name === 'commentAnchor'),
    ).toBe(false);
    expect(node.text).toBe('思元370');
  });

  it('interactive:false → 点击 mark 惰性（不设 active、不上报 click）', () => {
    const editor = buildEditorWithPlugin(SAMPLE_MD, {
      showGutter: false,
      interactive: false,
    });
    applyCommentAnchorsToEditor(editor, [
      { commentId: '1', segments: [{ exact: '寒武纪成立于2016年' }] },
    ]);
    const metas: string[] = [];
    const onTr = ({
      transaction,
    }: {
      transaction: { getMeta: (k: string) => unknown };
    }) => {
      if (transaction.getMeta(COMMENT_ACTIVE_META) !== undefined)
        metas.push('active');
      if (transaction.getMeta(COMMENT_CLICK_META) !== undefined)
        metas.push('click');
    };
    editor.on('transaction', onTr);
    const markEl = editor.view.dom.querySelector(
      'mark.tmr-comment[data-comment-ids~="1"]',
    ) as HTMLElement | null;
    expect(markEl).not.toBeNull();
    markEl!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    editor.view.someProp('handleClick', (fn) => {
      fn(editor.view, 1, { target: markEl } as unknown as MouseEvent);
    });
    expect(metas).toEqual([]);
    editor.off('transaction', onTr);
    editor.destroy();
  });
});

describe('editable:false 只读契约', () => {
  it('只读编辑器不铺评论 mark，getMarkdown 输出纯文本', () => {
    const editor = new Editor({
      extensions: [
        ...baseExtensions,
        CommentMark,
        commentAnchorExtension(),
        Markdown,
      ],
      content: SAMPLE_MD,
      contentType: 'markdown',
      editable: false,
    });
    applyCommentAnchorsToEditor(editor, [
      { commentId: '1', segments: [{ exact: '寒武纪成立于2016年' }] },
    ]);
    expect(collectCommentIds(editor)).toEqual([]);
    expect(editor.getMarkdown()).toContain('寒武纪成立于2016年');
    expect(editor.getMarkdown()).not.toContain('tmr-comment');
    editor.destroy();
  });
});
