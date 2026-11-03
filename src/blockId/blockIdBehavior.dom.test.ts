// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { BlockIdMarkdown } from './BlockIdMarkdown';
import { baseExtensions, blockIdExtension } from '../extensions';

const BLOCK_ID = /^b_[A-Za-z0-9_]{10}$/;

async function createEditor(paragraphs: string[]): Promise<Editor> {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...baseExtensions, blockIdExtension, BlockIdMarkdown],
    content: {
      type: 'doc',
      content: paragraphs.map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
    },
  });
  // UniqueID 的 onCreate 在 create 事件里回填 ID，create 由 setTimeout(0) 触发。
  await new Promise((resolve) => setTimeout(resolve, 0));
  return editor;
}

function blocks(editor: Editor) {
  return editor.getJSON().content ?? [];
}

describe('块 ID 行为验证：段中拆分（RFC §7.1 / 12.10）', () => {
  it('段中回车：前半保原 ID，后半拿新 ID', async () => {
    const editor = await createEditor(['abcdef']);
    const originalId = blocks(editor)[0].attrs?.blockId as string;
    expect(originalId).toMatch(BLOCK_ID);

    // 段落内容从 doc 位置 1 开始，在 "abc" 之后拆
    editor.view.dispatch(editor.state.tr.split(4));

    const [first, second] = blocks(editor);
    expect(first?.type).toBe('paragraph');
    expect((first?.content as any[] | undefined)?.[0]?.text).toBe('abc');
    expect(second?.type).toBe('paragraph');
    expect((second?.content as any[] | undefined)?.[0]?.text).toBe('def');
    expect(first?.attrs?.blockId).toBe(originalId);
    expect(second?.attrs?.blockId).toMatch(BLOCK_ID);
    expect(second?.attrs?.blockId).not.toBe(originalId);
    editor.destroy();
  });
});

describe('块 ID 行为验证：块合并', () => {
  it('两段合并：保留前块 ID，被合并块的 ID 消失', async () => {
    const editor = await createEditor(['aaa', 'bbb']);
    const [firstBefore, secondBefore] = blocks(editor);
    const firstId = firstBefore.attrs?.blockId as string;
    const secondId = secondBefore.attrs?.blockId as string;
    expect(firstId).toMatch(BLOCK_ID);
    expect(secondId).toMatch(BLOCK_ID);
    expect(firstId).not.toBe(secondId);

    const joinPos = editor.state.doc.child(0).nodeSize;
    editor.view.dispatch(editor.state.tr.join(joinPos));

    const content = blocks(editor);
    expect(content).toHaveLength(1);
    expect(content[0]?.attrs?.blockId).toBe(firstId);
    expect(
      (content[0]?.content as any[] | undefined)?.[0]?.text,
    ).toBe('aaabbb');
    editor.destroy();
  });
});
