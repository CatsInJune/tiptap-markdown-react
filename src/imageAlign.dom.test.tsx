// @vitest-environment happy-dom
import type { JSONContent } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { ImageWithConfirmDelete } from './components/MarkdownWysiwygEditor';
import { ImageAlignTools } from './components/ImageAlignTools';
import { isImageAlignActive, setImageAlign, setImageAlignAt } from './imageAlign';
import { setImageCaption } from './imageCaption';
import { defaultToolbarLabels } from './labels';
import { renderReportHtml } from './renderReportHtml';

const IMG_MD = '![a](https://x/a.png)';
const CENTER_MD = '<img src="https://x/a.png" alt="a" data-align="center">';

function build(content = '') {
  return new Editor({
    extensions: [
      ...baseExtensions,
      ImageWithConfirmDelete.configure({ inline: false }),
      Markdown,
    ],
    content,
    contentType: 'markdown',
  });
}

function imageAttrs(json: JSONContent): Record<string, unknown> | undefined {
  const img = (json.content ?? []).find((n) => n.type === 'image');
  return img?.attrs as Record<string, unknown> | undefined;
}

/**
 * 图片对齐（`data-align`，与官方 image-align-button 同属性名）：markdown 走尺寸那条
 * `<img …>` 班车、工具函数对 selection / DOM 两条路径、悬停工具条就地浮现。
 */
describe('图片对齐的 markdown 往返', () => {
  it('序列化：对齐走 HTML 形式（data-align），其余保持标准语法', () => {
    const editor = build(IMG_MD);
    // 未对齐：标准语法
    expect(editor.getMarkdown()).toContain('![a](https://x/a.png)');

    editor.commands.setNodeSelection(0);
    setImageAlign(editor, 'center');
    expect(editor.getMarkdown()).toContain(
      '<img src="https://x/a.png" alt="a" data-align="center">',
    );
    editor.destroy();
  });

  it('标准语法 ![alt](src) 的解析（marked image token 走 href/text）', () => {
    const editor = build(IMG_MD);
    expect(imageAttrs(editor.getJSON())).toMatchObject({
      src: 'https://x/a.png',
      alt: 'a',
    });
    editor.destroy();
  });

  it('解析：data-align 还原成 align attr，脏值忽略', () => {
    const editor = build(CENTER_MD);
    expect(imageAttrs(editor.getJSON())?.align).toBe('center');
    editor.destroy();

    const dirty = build('<img src="https://x/a.png" alt="a" data-align="top">');
    expect(imageAttrs(dirty.getJSON())?.align).toBe(null);
    dirty.destroy();
  });

  it('往返幂等，且与尺寸共存', () => {
    const md =
      '<img src="https://x/a.png" alt="a" width="300" height="200" data-align="right">';
    const editor = build(md);
    expect(editor.getMarkdown().trim()).toBe(md);
    editor.destroy();
  });

  it('server 端（renderReportHtml）同样带上 data-align', () => {
    const rendered = renderReportHtml(CENTER_MD);
    expect(rendered.html).toContain('data-align="center"');
  });
});

describe('setImageAlign / isImageAlignActive / setImageAlignAt', () => {
  it('选中图片后可对齐、可查 active、并进 markdown（同值幂等）', () => {
    const editor = build(IMG_MD);
    editor.commands.setNodeSelection(0);
    expect(isImageAlignActive(editor, 'center')).toBe(false);

    expect(setImageAlign(editor, 'center')).toBe(true);
    expect(isImageAlignActive(editor, 'center')).toBe(true);
    expect(isImageAlignActive(editor, 'right')).toBe(false);
    expect(editor.getMarkdown()).toContain('data-align="center"');

    // 同值再设：成功语义、但不写空事务
    expect(setImageAlign(editor, 'center')).toBe(true);
    editor.destroy();
  });

  it('光标不在图片旁时返回 false', () => {
    const editor = build('just text');
    editor.commands.setTextSelection(2);
    expect(setImageAlign(editor, 'left')).toBe(false);
    editor.destroy();
  });

  it('setImageAlignAt：按 DOM 对齐、不动选区', () => {
    const editor = build(IMG_MD);
    document.body.appendChild(editor.view.dom);
    const img = editor.view.dom.querySelector('img');
    if (!img) throw new Error('no img');
    const before = editor.state.selection.from;

    expect(setImageAlignAt(editor, img, 'right')).toBe(true);
    expect(imageAttrs(editor.getJSON())?.align).toBe('right');
    expect(editor.state.selection.from).toBe(before);
    editor.destroy();
  });
});

describe('ImageAlignTools（悬停工具条）', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  function ToolsHost({ onEditor }: { onEditor: (ed: Editor) => void }) {
    const ed = useEditor({
      extensions: [
        ...baseExtensions,
        // 与真实接线一致：开缩放（图片有 NodeView）。对齐工具条的重测路径必须
        // 兼容 nodeDOM 返回容器（[data-resize-container]）而不是裸 img 的场景。
        ImageWithConfirmDelete.configure({
          inline: false,
          resize: {
            enabled: true,
            alwaysPreserveAspectRatio: true,
            directions: ['left', 'right'],
            minWidth: 80,
            minHeight: 80,
          },
        }),
        Markdown,
      ],
      content: IMG_MD,
      contentType: 'markdown',
      immediatelyRender: false,
    });
    if (ed) onEditor(ed);
    return ed ? (
      <>
        <EditorContent editor={ed} />
        <ImageAlignTools editor={ed} labels={defaultToolbarLabels} />
      </>
    ) : null;
  }

  const mount = async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <ToolsHost
          onEditor={(ed) => {
            editor = ed;
          }}
        />,
      );
    });
    await act(async () => {});
    // 视图 DOM 就在 host（已在 body 里）——EditorContent 负责挂载，
    // 不要再 appendChild 挪走它（会破坏 React 的父子关系）。
    return host;
  };

  const hoverImage = async () => {
    const img = editor.view.dom.querySelector('img');
    if (!img) throw new Error('no img');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
  };

  const bar = () => document.querySelector('[data-image-align]');

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor?.destroy();
  });

  it('悬浮图片浮出按钮组（三对齐 + 描述）；移开后收起（宽限 160ms）', async () => {
    await mount();
    expect(bar()).toBeNull();

    await hoverImage();
    expect(bar()).not.toBeNull();
    expect(bar()?.querySelectorAll('button').length).toBe(4);

    // 移到图片外：宽限后收起
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 240));
    });
    expect(bar()).toBeNull();
  });

  it('点按钮即对齐（不改选区），active 态跟着属性刷新', async () => {
    await mount();
    await hoverImage();
    const before = editor.state.selection.from;

    const center = document.querySelector<HTMLButtonElement>(
      '[data-image-align-action="center"]',
    );
    if (!center) throw new Error('no center button');
    await act(async () => {
      center.click();
    });

    expect(imageAttrs(editor.getJSON())?.align).toBe('center');
    expect(editor.getMarkdown()).toContain('data-align="center"');
    expect(editor.state.selection.from).toBe(before);
    // DOM 属性应该同步渲染（active 态就是从它读的）
    expect(
      editor.view.dom
        .querySelector('img')
        ?.getAttribute('data-align'),
    ).toBe('center');
    expect(
      document
        .querySelector('[data-image-align-action="center"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('描述按钮：输入后 Enter 提交，写入 caption 并进 markdown', async () => {
    await mount();
    await hoverImage();

    const capBtn = document.querySelector<HTMLButtonElement>(
      '[data-image-align-action="caption"]',
    );
    if (!capBtn) throw new Error('no caption button');
    await act(async () => {
      capBtn.click();
    });

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Add a caption…"]',
    );
    expect(input).not.toBeNull();

    // React 受控输入：原生 setter + input 事件
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    await act(async () => {
      setter?.call(input, '图 1：营收趋势');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(imageAttrs(editor.getJSON())?.caption).toBe('图 1：营收趋势');
    expect(editor.getMarkdown()).toContain(
      '<figcaption>图 1：营收趋势</figcaption>',
    );
  });
});

describe('图片描述（图注）', () => {
  it('序列化为 <figure> 形式，解析还原', () => {
    const editor = build(IMG_MD);
    editor.commands.setNodeSelection(0);
    expect(setImageCaption(editor, '图 1：营收趋势')).toBe(true);

    const md = editor.getMarkdown();
    expect(md).toContain('<figure>');
    expect(md).toContain('<img src="https://x/a.png" alt="a">');
    expect(md).toContain('<figcaption>图 1：营收趋势</figcaption>');
    editor.destroy();

    const back = build(md);
    expect(imageAttrs(back.getJSON())?.caption).toBe('图 1：营收趋势');
    back.destroy();
  });

  it('往返幂等（含实体转义）', () => {
    const md =
      '<figure>\n<img src="https://x/a.png" alt="a">\n<figcaption>图 1 &lt;说明&gt; &amp; 注</figcaption>\n</figure>';
    const editor = build(md);
    expect(editor.getMarkdown().trim()).toBe(md);
    editor.destroy();
  });

  it('空白描述视为清除，回到标准语法', () => {
    const editor = build(IMG_MD);
    editor.commands.setNodeSelection(0);
    setImageCaption(editor, '图 1');
    expect(editor.getMarkdown()).toContain('<figcaption>');

    setImageCaption(editor, '   ');
    expect(editor.getMarkdown()).toContain('![a](https://x/a.png)');
    expect(editor.getMarkdown()).not.toContain('figure');
    editor.destroy();
  });

  it('server 端渲染 figure + figcaption', () => {
    const rendered = renderReportHtml(
      '<figure>\n<img src="https://x/a.png" alt="a">\n<figcaption>图 1</figcaption>\n</figure>',
    );
    expect(rendered.html).toContain('<figure');
    expect(rendered.html).toContain('<figcaption');
    expect(rendered.html).toContain('图 1');
  });
});
