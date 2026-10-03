/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { defaultShortcutLabels, type ShortcutLabels } from '../labels';
import { buildShortcutGroups } from './types';
import { ShortcutPanel } from './ShortcutPanel';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

describe('快捷键注册表', () => {
  const groups = buildShortcutGroups(defaultShortcutLabels);

  it('三个分组且每条目有键位或 markdown 之一', () => {
    expect(groups.map((g) => g.id)).toEqual(['format', 'insert', 'edit']);
    for (const g of groups) {
      expect(g.entries.length).toBeGreaterThan(0);
      for (const e of g.entries) {
        expect(e.keys || e.markdown).toBeTruthy();
      }
    }
  });

  it('id 全局唯一', () => {
    const ids = groups.flatMap((g) => g.entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('键位与源码核实值一致（抽查）', () => {
    const all = groups.flatMap((g) => g.entries);
    const byId = Object.fromEntries(all.map((e) => [e.id, e]));
    expect(byId['bold'].keys).toEqual(['Mod', 'b']);
    expect(byId['strike'].keys).toEqual(['Mod', 'Shift', 's']);
    expect(byId['heading-3'].keys).toEqual(['Mod', 'Alt', '3']);
    expect(byId['heading-3'].markdown).toEqual({ marker: '###', terminator: 'Space' });
    expect(byId['blockquote'].keys).toEqual(['Mod', 'Shift', 'b']);
    expect(byId['task-list'].keys).toBeUndefined();
    expect(byId['task-list'].markdown).toEqual({ marker: '[]', terminator: 'Space' });
    expect(byId['find-replace'].keys).toEqual(['Mod', 'f']);
    // 本库无 input rule / 无默认键位的项不得编造
    expect(byId['underline'].markdown).toBeUndefined();
  });
});

describe('ShortcutPanel 渲染', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    // 面板里的键帽按平台渲染；测试环境固定为非 mac，断言 Ctrl
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    host?.remove();
  });

  it('open=false 渲染 null', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(<ShortcutPanel open={false} onClose={() => {}} />);
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('打开后渲染三列表头、分组与键帽', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(<ShortcutPanel open onClose={() => {}} />);
    });
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Shortcuts');
    const headers = [...host.querySelectorAll('kbd') && host.querySelectorAll('[class*="head"] > *')].map((e) => e.textContent);
    expect(headers).toEqual(['Format', 'Shortcut', 'Markdown']);
    expect(host.querySelectorAll('section')).toHaveLength(3);
    // Mod 在非 mac 平台显示 Ctrl
    const keycaps = [...host.querySelectorAll('kbd')].map((k) => k.textContent);
    expect(keycaps).toContain('Ctrl');
    expect(keycaps).toContain('B');
    expect(keycaps).toContain('###');
    expect(keycaps).toContain('Space');
  });

  it('中文标签覆盖生效', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const labels: Partial<ShortcutLabels> = {
      panelTitle: '快捷键',
      colFormat: '格式',
      colShortcut: '快捷键',
      colMarkdown: 'Markdown',
      formatGroup: '格式',
      bold: '加粗',
    };
    act(() => {
      root.render(<ShortcutPanel open onClose={() => {}} labels={labels} />);
    });
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('快捷键');
    const headers = [...host.querySelectorAll('[class*="head"] > *')].map((e) => e.textContent);
    expect(headers).toEqual(['格式', '快捷键', 'Markdown']);
    expect(host.textContent).toContain('加粗');
    expect(host.textContent).toContain('格式');
  });
});
