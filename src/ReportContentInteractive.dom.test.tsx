/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReportContentInteractive } from './components/ReportContentInteractive';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

const citationHtml = (index: string, label: string) =>
  `<p>${label}<span class="citation-ref" data-index="${index}"><a href="#">${index}</a></span></p>`;

describe('ReportContentInteractive DOM 更新后仍可点脚注', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('替换 html 后委托仍挂在容器上', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onEnter = vi.fn();
    const onLeave = vi.fn();

    await act(async () => {
      root.render(
        <ReportContentInteractive
          html={citationHtml('1', '第一帧')}
          onCitationEnter={onEnter}
          onCitationLeave={onLeave}
        />,
      );
    });

    const first = host.querySelector('.citation-ref a') as HTMLAnchorElement;
    expect(first).not.toBeNull();
    await act(async () => {
      first.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter.mock.calls[0][0].index).toBe('1');

    await act(async () => {
      root.render(
        <ReportContentInteractive
          html={citationHtml('2', '第二帧')}
          onCitationEnter={onEnter}
          onCitationLeave={onLeave}
        />,
      );
    });
    expect(host.textContent).toContain('第二帧');
    expect(host.textContent).not.toContain('第一帧');

    const second = host.querySelector('.citation-ref a') as HTMLAnchorElement;
    await act(async () => {
      second.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });
    expect(onEnter).toHaveBeenCalledTimes(2);
    expect(onEnter.mock.calls[1][0].index).toBe('2');
  });
});
