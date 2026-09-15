import { describe, expect, it } from 'vitest';
import { resolveImportMenuItems } from './importMenu';
import { defaultToolbarLabels } from './labels';

describe('resolveImportMenuItems', () => {
  it('默认只有 Markdown', () => {
    const items = resolveImportMenuItems({ labels: defaultToolbarLabels });
    expect(items).toEqual([
      {
        key: 'markdown',
        label: defaultToolbarLabels.importMarkdown,
        accept: '.md,.markdown,text/markdown',
      },
    ]);
  });

  it('有回调和 importAccept 时追加 Document', () => {
    const items = resolveImportMenuItems({
      labels: defaultToolbarLabels,
      onImportDocument: () => Promise.resolve(''),
      importAccept: '.pdf',
    });
    expect(items.map((item) => item.key)).toEqual(['markdown', 'document']);
    expect(items[1]?.accept).toBe('.pdf');
  });

  it('宿主传入的菜单优先', () => {
    const custom = [
      { key: 'md', label: 'Markdown', accept: '.md' },
      { key: 'pdf', label: 'PDF', accept: '.pdf' },
    ];
    expect(
      resolveImportMenuItems({
        labels: defaultToolbarLabels,
        importMenuItems: custom,
      }),
    ).toBe(custom);
  });
});
