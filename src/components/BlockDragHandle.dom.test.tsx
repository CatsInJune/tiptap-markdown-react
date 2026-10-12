/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MarkdownWysiwygEditor } from './MarkdownWysiwygEditor';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('块拖拽手柄', () => {
  let host: HTMLDivElement;
  let root: Root | undefined;

  async function mount(props: { editable?: boolean; blockDrag?: boolean } = {}) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown={'Alpha\n\nBeta'}
          {...props}
        />,
      );
    });
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
  });

  it('可编辑时挂上手柄，并在左侧留出空位', async () => {
    await mount();
    expect(document.querySelector('[data-block-drag]')).not.toBeNull();
    expect(document.querySelector('[data-block-drag-grip]')).not.toBeNull();
    expect(document.querySelector('[data-block-drag-slash]')).toBeNull();
    expect(host.querySelector('[data-block-drag-gutter]')).not.toBeNull();
  });

  it('只读或关掉开关时不留手柄', async () => {
    await mount({ editable: false });
    expect(document.querySelector('[data-block-drag]')).toBeNull();
    expect(host.querySelector('[data-block-drag-gutter]')).toBeNull();

    await act(async () => root?.unmount());
    host.remove();
    await mount({ blockDrag: false });
    expect(document.querySelector('[data-block-drag]')).toBeNull();
    expect(host.querySelector('[data-block-drag-gutter]')).toBeNull();
  });
});
