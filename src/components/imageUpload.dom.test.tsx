// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import {
  hasImageUpload,
  ImageUploadNode,
  type ImageUploadConfig,
} from '../imageUpload';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

let currentEditor: Editor | null = null;

/** `<MarkdownWysiwygEditor imageUpload>` 接线的最小复刻：块级 Image + 上传占位块 + markdown 管线。 */
function UploadHost({ config }: { config: ImageUploadConfig }) {
  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      Image.configure({ inline: false }),
      ImageUploadNode.configure(config),
      Markdown,
    ],
    content: '',
    contentType: 'markdown',
    immediatelyRender: false,
  });
  currentEditor = editor;
  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

/**
 * 图片上传占位块（官方 ImageUploadNode 的交互）：点工具栏插块 → 块内点选 / 拖拽 →
 * 进度就地 → 成功原地换图。这里钉住上传协议（进度 / 中止 / 上限）与 markdown 隔离。
 */
describe('ImageUploadNode', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const flush = () => act(async () => {});

  const mount = async (config: ImageUploadConfig) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<UploadHost config={config} />);
    });
    await flush();
    editor = currentEditor as unknown as Editor;
    await act(async () => {
      editor.commands.setImageUploadNode();
    });
  };

  const dropzone = () =>
    host.querySelector<HTMLElement>('[data-image-upload-dropzone]');

  const pickFiles = async (files: File[]) => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('file input not rendered');
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const dropFiles = async (files: File[]) => {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files } });
    await act(async () => {
      dropzone()?.dispatchEvent(event);
    });
  };

  const png = (name: string, bytes = 3) =>
    new File([new Uint8Array(bytes)], name, { type: 'image/png' });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    currentEditor = null;
  });

  it('插入占位块：出现拖拽区与上限文案，且不进 Markdown', async () => {
    await mount({ upload: async () => 'https://cdn/x.png' });

    expect(dropzone()).toBeTruthy();
    expect(dropzone()?.textContent).toContain('Click to upload');
    expect(dropzone()?.textContent).toContain('Maximum 1 file.');
    expect(editor.getMarkdown()).not.toContain('image-upload');
    expect(editor.getMarkdown().trim()).toBe('');
  });

  it('点拖拽区打开文件选择框', async () => {
    await mount({ upload: async () => 'https://cdn/x.png' });

    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    act(() => {
      dropzone()?.click();
    });
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('选文件 → 上传中就地显示进度 → 成功换成图片（alt 取文件名）', async () => {
    let release!: (url: string) => void;
    const upload = vi.fn(
      (_file: File, onProgress?: (e: { progress: number }) => void) =>
        new Promise<string>((resolve) => {
          onProgress?.({ progress: 42 });
          release = resolve;
        }),
    );
    await mount({ upload });

    await pickFiles([png('photo.png')]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(
      host.querySelector('[data-image-upload-item]')?.textContent,
    ).toContain('photo.png');
    expect(host.textContent).toContain('42%');
    expect(dropzone()).toBeNull();

    await act(async () => {
      release('https://cdn/photo.png');
    });
    // alt 与 title 都取文件名去扩展（对齐官方），markdown 里 title 跟在 URL 后
    expect(editor.getMarkdown()).toContain(
      '![photo](https://cdn/photo.png "photo")',
    );
    expect(host.querySelector('[data-image-upload-item]')).toBeNull();
  });

  it('拖拽文件到占位块：走同一条上传链', async () => {
    const upload = vi.fn(async () => 'https://cdn/drop.png');
    await mount({ upload });

    await dropFiles([png('dropped.png')]);
    await flush();

    expect(upload).toHaveBeenCalledTimes(1);
    expect(editor.getMarkdown()).toContain(
      '![dropped](https://cdn/drop.png "dropped")',
    );
  });

  it('超体积上限：报错、不上传、占位块保留', async () => {
    const onError = vi.fn();
    const upload = vi.fn(async () => 'https://cdn/x.png');
    await mount({ upload, maxSize: 10, onError });

    await pickFiles([png('big.png', 64)]);

    expect(upload).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(dropzone()).toBeTruthy();
  });

  it('超数量上限：一次选太多直接报错', async () => {
    const onError = vi.fn();
    const upload = vi.fn(async () => 'https://cdn/x.png');
    await mount({ upload, limit: 1, onError });

    await pickFiles([png('a.png'), png('b.png')]);

    expect(upload).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0])).toContain('Maximum 1 file');
  });

  it('limit=2：两个文件各自配对文件名与 URL，并按序插入', async () => {
    const upload = vi.fn(async (file: File) => `https://cdn/${file.name}`);
    await mount({ upload, limit: 2 });

    await pickFiles([png('one.png'), png('two.png')]);

    const md = editor.getMarkdown();
    expect(md).toContain('![one](https://cdn/one.png "one")');
    expect(md).toContain('![two](https://cdn/two.png "two")');
  });

  it('移除排队文件：abort 在飞请求，且不算失败', async () => {
    const signals: AbortSignal[] = [];
    const onError = vi.fn();
    const upload = vi.fn(
      (_file: File, _onProgress?: unknown, signal?: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          if (signal) signals.push(signal);
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await mount({ upload, onError });

    await pickFiles([png('a.png')]);
    const remove = host.querySelector<HTMLButtonElement>(
      '[data-image-upload-remove]',
    );
    expect(remove).toBeTruthy();
    await act(async () => {
      remove?.click();
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(host.querySelector('[data-image-upload-item]')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('上传失败：文件行留下错误状态，占位块不消失', async () => {
    const onError = vi.fn();
    const upload = vi.fn(async () => {
      throw new Error('network down');
    });
    await mount({ upload, onError });

    await pickFiles([png('a.png')]);
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-image-upload-item]')?.textContent).toContain(
      'Upload failed',
    );
    expect(editor.getMarkdown().trim()).toBe('');
  });
});

describe('hasImageUpload', () => {
  it('按扩展名探测：注册了才为真', () => {
    const withExt = new Editor({
      extensions: [...baseExtensions, ImageUploadNode, Markdown],
    });
    const without = new Editor({ extensions: [...baseExtensions, Markdown] });

    expect(hasImageUpload(withExt)).toBe(true);
    expect(hasImageUpload(without)).toBe(false);

    withExt.destroy();
    without.destroy();
  });
});
