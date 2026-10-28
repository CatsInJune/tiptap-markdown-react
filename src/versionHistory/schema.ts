import { Mark, Node, getSchema, mergeAttributes } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import type { Schema } from '@tiptap/pm/model';
import { CitationRef } from '../CitationRef';
import { prepareChartMarkdown } from '../chart/prepareChartMarkdown';
import {
  enrichMarkdownCitations,
  type SourceRef,
} from '../citationUtils';
import { baseExtensions, pureChart, pureCodeBlock, pureImage } from '../extensions';

/**
 * 只存在于历史对比预览里的标记和包裹节点。主编辑器不注册它们，
 * `getMarkdown()` 也看不到。
 */
export const DiffInsert = Mark.create({
  name: 'diffInsert',
  excludes: '',
  parseHTML: () => [{ tag: 'span[data-diff="insert"]' }],
  renderHTML: () => ['span', { 'data-diff': 'insert' }, 0],
});

export const DiffDelete = Mark.create({
  name: 'diffDelete',
  excludes: '',
  parseHTML: () => [{ tag: 'span[data-diff="delete"]' }],
  renderHTML: () => ['span', { 'data-diff': 'delete' }, 0],
});

export const DiffFormat = Mark.create({
  name: 'diffFormat',
  excludes: '',
  parseHTML: () => [{ tag: 'span[data-diff="format"]' }],
  renderHTML: () => ['span', { 'data-diff': 'format' }, 0],
});

/** 整块插入或删除（代码块、表格、图表、公式、图片、列表、引用）。 */
export const DiffRegion = Node.create({
  name: 'diffRegion',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      diff: {
        default: 'insert',
        parseHTML: (element) => element.getAttribute('data-diff'),
        renderHTML: (attributes) => ({ 'data-diff': attributes.diff }),
      },
    };
  },
  parseHTML: () => [{ tag: 'div[data-diff-region]' }],
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-diff-region': '' }), 0];
  },
});

/** 和 normalizeMarkdown 同一套节点，再加对比标记。 */
export function versionExtensions() {
  return [
    ...baseExtensions,
    pureCodeBlock,
    pureImage,
    pureChart,
    CitationRef,
    DiffInsert,
    DiffDelete,
    DiffFormat,
    DiffRegion,
  ];
}

let sharedSchema: Schema | null = null;

export function getVersionSchema(): Schema {
  sharedSchema ??= getSchema(versionExtensions());
  return sharedSchema;
}

// 解析用的 manager 不含对比标记：那些标记没有 markdown 语法。
// 模块级复用，避免每次 new MarkdownManager 都往 marked 上堆 tokenizer。
let sharedManager: MarkdownManager | null = null;

function getManager(): MarkdownManager {
  sharedManager ??= new MarkdownManager({
    extensions: [...baseExtensions, pureCodeBlock, pureImage, pureChart, CitationRef],
  });
  return sharedManager;
}

/** 把 markdown 解析成对比 schema 上的文档。表格空格、图表注释空格在这一步被抹平。 */
export function parseVersionDoc(markdown: string, sources?: SourceRef[]) {
  const prepared = prepareChartMarkdown(
    enrichMarkdownCitations(markdown ?? '', sources ?? []),
  );
  const parsed = getManager().parse(prepared);
  return getVersionSchema().nodeFromJSON(parsed);
}
