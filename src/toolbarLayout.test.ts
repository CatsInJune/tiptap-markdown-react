import { describe, expect, it } from 'vitest';
import {
  defaultToolbarGroups,
  resolveToolbarLayout,
} from './toolbarLayout';

const ids = (result: ReturnType<typeof resolveToolbarLayout>) =>
  result.groups.map((group) =>
    group.items.map((item) => (item.type === 'more' ? { more: item.ids } : item.id)),
  );

describe('resolveToolbarLayout', () => {
  it('默认清单不含图片、搜索、历史', () => {
    const flat = defaultToolbarGroups.flatMap((group) =>
      group.flatMap((slot) => (typeof slot === 'string' ? [slot] : slot.more)),
    );
    expect(flat).not.toContain('image');
    expect(flat).not.toContain('search');
    expect(flat).not.toContain('history');
    expect(ids(resolveToolbarLayout({}))).toEqual(ids(resolveToolbarLayout({ groups: null })));
  });

  it('hidden 从默认清单划掉内置项，空组不留', () => {
    const result = resolveToolbarLayout({
      hidden: ['bold', 'italic', 'underline', 'strike', 'code', 'textColor', 'highlight', 'script'],
    });
    const flat = ids(result).flat();
    expect(flat).not.toContain('bold');
    expect(flat).not.toContain('script');
    expect(result.groups.some((group) => group.items.length === 0)).toBe(false);
  });

  it('hidden 能划掉更多里的全屏；划空且没有自定义项时不留更多按钮', () => {
    const result = resolveToolbarLayout({
      hidden: ['codeBlock', 'inlineMath', 'blockMath', 'hr', 'table', 'fullscreen'],
    });
    expect(result.hasFullscreen).toBe(false);
    expect(result.groups.some((group) => group.items.some((item) => item.type === 'more'))).toBe(
      false,
    );
  });

  it('不传 groups 时自定义项追加到更多末尾，hidden 不作用于自定义 key', () => {
    const result = resolveToolbarLayout({
      hidden: ['report', 'fullscreen'],
      extraKeys: ['report'],
    });
    const more = result.groups
      .flatMap((group) => group.items)
      .find((item) => item.type === 'more');
    expect(more && more.type === 'more' && more.ids.at(-1)).toBe('report');
    expect(more && more.type === 'more' && more.ids).not.toContain('fullscreen');
    expect(result.warnings).toEqual([]);
  });

  it('传了 groups 就整栏替换，hidden 被忽略并警告', () => {
    const result = resolveToolbarLayout({
      groups: [['bold', 'image'], [{ more: ['table'] }]],
      hidden: ['bold'],
      extraKeys: ['report'],
    });
    expect(ids(result)).toEqual([['bold', 'image'], [{ more: ['table'] }]]);
    expect(result.warnings).toContain(
      'Both groups and hidden were passed; hidden is ignored.',
    );
  });

  it('同一个 id 只保留第一次，第二颗更多被忽略', () => {
    const result = resolveToolbarLayout({
      groups: [
        ['bold', { more: ['italic', 'bold'] }],
        [{ more: ['table'] }, 'italic'],
      ],
    });
    expect(ids(result)).toEqual([['bold', { more: ['italic'] }]]);
    expect(result.warnings).toEqual([
      'Duplicate toolbar item "bold"; keeping the first one.',
      'Only one More menu is allowed; extra More slots are ignored.',
      'Duplicate toolbar item "italic"; keeping the first one.',
    ]);
  });

  it('会再弹出一层的控件不能进更多', () => {
    const result = resolveToolbarLayout({
      groups: [[{ more: ['style', 'codeBlock'] }]],
    });
    expect(ids(result)).toEqual([[{ more: ['codeBlock'] }]]);
    expect(result.warnings).toContain('"style" cannot be placed inside the More menu.');
  });

  it('不认识的 id 警告并跳过', () => {
    const result = resolveToolbarLayout({ groups: [['nope', 'bold']] });
    expect(ids(result)).toEqual([['bold']]);
    expect(result.warnings).toContain('Unknown toolbar item "nope".');
  });
});
