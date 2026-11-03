// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { BlockIdMarkdown } from './BlockIdMarkdown';
import {
  baseExtensions,
  blockIdBackfill,
  blockIdExtension,
} from '../extensions';

const BLOCK_ID = /^b_[A-Za-z0-9_]{10}$/;

async function createEditor(paragraphs: string[]): Promise<Editor> {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      ...baseExtensions,
      blockIdExtension,
      blockIdBackfill,
      BlockIdMarkdown,
    ],
    content: {
      type: 'doc',
      content: paragraphs.map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
    },
  });
  // create 事件里由 blockIdBackfill 回填 ID（JSON 初始内容不走 markdown parse）。
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

describe('块 ID 行为验证：初始回填（onCreate）', () => {
  it('打开文档不触发 update；嵌套块不拿真实 ID', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        ...baseExtensions,
        blockIdExtension,
        blockIdBackfill,
        BlockIdMarkdown,
      ],
      content: '> 引用内容\n\n- 列表项\n\n正文',
      contentType: 'markdown',
    });
    let updates = 0;
    editor.on('update', () => {
      updates += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 回填事务带 preventUpdate + 专属 meta，宿主的 update 调度不被触发
    expect(updates).toBe(0);

    const content = editor.getJSON().content ?? [];
    expect(content[0]?.attrs?.blockId).toMatch(BLOCK_ID); // blockquote
    expect(content[1]?.attrs?.blockId).toMatch(BLOCK_ID); // bulletList
    expect(content[2]?.attrs?.blockId).toMatch(BLOCK_ID); // paragraph

    // 嵌套段落写空串哨兵：不进 markdown，也不参与后续 UniqueID 随机分配
    const nestedInQuote = (content[0]?.content as any[] | undefined)?.[0];
    expect(nestedInQuote?.attrs?.blockId ?? '').toBe('');
    const listItem = (content[1]?.content as any[] | undefined)?.[0];
    const nestedInList = (listItem?.content as any[] | undefined)?.[0];
    expect(nestedInList?.attrs?.blockId ?? '').toBe('');

    editor.destroy();
  });
});
