/** @vitest-environment happy-dom */
import type { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorHandle,
  type MarkdownWysiwygEditorProps,
} from './MarkdownWysiwygEditor';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

/**
 * 查找条的入口语义（工具栏/宿主按钮靠它驱动）。
 *
 * 条子归编辑器，但「开没开」只有编辑器知道，所以开合要上报 `onFindOpenChange`；
 * `openFind()` 要带「再按一次」的手感（聚焦 + 全选当前查询），这样工具栏那个放大镜
 * 在条子已经开着时也有反馈，而不是点了没反应。
 */
describe('MarkdownWysiwygEditor 的查找入口', () => {
  let host: HTMLDivElement;
  let root: Root | undefined;
  let handle: MarkdownWysiwygEditorHandle | null;
  let onFindOpenChange: ReturnType<typeof vi.fn>;

  const mount = async (props: Partial<MarkdownWysiwygEditorProps> = {}) => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    onFindOpenChange = vi.fn();
    await act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown="one two one"
          onFindOpenChange={onFindOpenChange}
          ref={(node: MarkdownWysiwygEditorHandle | null) => {
            handle = node;
          }}
          {...props}
        />,
      );
    });
    return host;
  };

  const searchInput = () =>
    host.querySelector<HTMLInputElement>('[data-find-field="search"]');

  const typeInto = (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host.remove();
  });

  it('挂载时不先报 false；打开报 true、关闭报 false', async () => {
    await mount();
    expect(onFindOpenChange).not.toHaveBeenCalled();
    expect(host.querySelector('[data-find-bar]')).toBeNull();

    await act(async () => {
      handle?.openFind();
    });
    expect(onFindOpenChange).toHaveBeenLastCalledWith(true);
    expect(host.querySelector('[data-find-bar]')).not.toBeNull();

    await act(async () => {
      handle?.closeFind();
    });
    expect(onFindOpenChange).toHaveBeenLastCalledWith(false);
    expect(host.querySelector('[data-find-bar]')).toBeNull();
    expect(onFindOpenChange).toHaveBeenCalledTimes(2);
  });

  it('Esc 关掉条子也上报（条子里的关闭路径不经过 handle）', async () => {
    await mount();
    await act(async () => {
      handle?.openFind();
    });

    await act(async () => {
      host
        .querySelector('[data-find-bar]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
    });
    expect(onFindOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('已经开着时再调 openFind：聚焦并全选当前查询（放大镜的「再点一次」手感）', async () => {
    vi.useFakeTimers();
    await mount();

    await act(async () => {
      handle?.openFind();
    });
    await act(async () => {
      typeInto(searchInput()!, 'two');
    });
    // 查询词有防抖（FIND_DEBOUNCE_MS），先落定再复开
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const input = searchInput()!;
    input.setSelectionRange(3, 3); // 先把光标挪开，确认下面确实重新全选了

    await act(async () => {
      handle?.openFind();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('two'.length);
    // 状态没变就不该重复上报
    expect(onFindOpenChange).toHaveBeenCalledTimes(1);
  });

  it('findReplace={false}：不注册扩展，入口点了也不会弹条子、也不上报', async () => {
    await mount({ findReplace: false });

    await act(async () => {
      handle?.openFind();
    });
    expect(host.querySelector('[data-find-bar]')).toBeNull();
    // 没有条子可亮，就不该让别处的入口按钮跟着亮
    expect(onFindOpenChange).not.toHaveBeenCalled();
  });

  it('toggleFind()：关着就开、开着就关（工具栏那个带 active 态的放大镜接它）', async () => {
    await mount();

    await act(async () => {
      handle?.toggleFind();
    });
    expect(host.querySelector('[data-find-bar]')).not.toBeNull();

    await act(async () => {
      handle?.toggleFind();
    });
    expect(host.querySelector('[data-find-bar]')).toBeNull();
    expect(onFindOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(onFindOpenChange).toHaveBeenNthCalledWith(2, false);
  });

  it('焦点在正文里按 Esc 也关（不用先点回条子）', async () => {
    await mount();
    await act(async () => {
      handle?.openFind();
    });

    const editable = host.querySelector<HTMLElement>('.ProseMirror')!;
    editable.setAttribute('tabindex', '0');
    await act(async () => {
      editable.focus();
    });
    expect(document.activeElement).toBe(editable);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(host.querySelector('[data-find-bar]')).toBeNull();
    expect(onFindOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('焦点在宿主的其它输入框里时不抢 Esc（宿主表单 / 多编辑器不被夺键）', async () => {
    await mount();
    await act(async () => {
      handle?.openFind();
    });

    const outside = document.createElement('input');
    document.body.appendChild(outside);
    await act(async () => {
      outside.focus();
    });
    expect(document.activeElement).toBe(outside);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(host.querySelector('[data-find-bar]')).not.toBeNull();

    outside.remove();
  });

  it('输入法组合中的 Esc 是「取消候选词」：不关条子', async () => {
    await mount();
    await act(async () => {
      handle?.openFind();
    });

    const editable = host.querySelector<HTMLElement>('.ProseMirror')!;
    editable.setAttribute('tabindex', '0');
    await act(async () => {
      editable.focus();
    });

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      );
    });
    expect(host.querySelector('[data-find-bar]')).not.toBeNull();
  });

  it('编辑器卸载时补发一次 false（新实例不会替上一实例撤销那个 true）', async () => {
    await mount();
    await act(async () => {
      handle?.openFind();
    });
    expect(onFindOpenChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      root?.unmount();
    });
    root = undefined;
    expect(onFindOpenChange).toHaveBeenLastCalledWith(false);
  });
});
