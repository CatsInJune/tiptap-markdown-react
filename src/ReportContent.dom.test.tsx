/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ReportContent } from './ReportContent';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

describe('ReportContent DOM 更新', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('html 变化时整篇替换，旧节点离开 DOM', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(<ReportContent html="<p>第一帧</p>" />);
    });
    expect(host.querySelector('p')?.textContent).toBe('第一帧');

    await act(async () => {
      root.render(<ReportContent html="<h2>第二帧</h2><p>后文</p>" />);
    });
    expect(host.textContent).toContain('第二帧');
    expect(host.textContent).toContain('后文');
    expect(host.textContent).not.toContain('第一帧');
    expect(host.querySelector('h2')).not.toBeNull();
  });
});
