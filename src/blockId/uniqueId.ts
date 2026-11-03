import type { AnyExtension } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import UniqueID from '@tiptap/extension-unique-id';
import { BLOCK_ID_ATTR, createBlockId } from './id';

/**
 * 从给定扩展集里收集「能作为 doc 直接子节点」的块类型名。
 *
 * RFC §7.1 的 `types = baseExtensions 全部顶层块类型`：用 schema 的 doc content
 * 表达式判定，而不是手工点名单（`listItem` / `tableCell` / `detailsContent`
 * 这些只能在容器里的类型不会被误收）。
 */
export function collectTopLevelBlockTypes(
  extensions: AnyExtension[],
): string[] {
  const schema = getSchema(extensions);
  const doc = schema.nodes.doc;
  if (!doc) return [];
  return Object.values(schema.nodes)
    .filter((type) => type.name !== 'doc' && type.name !== 'text')
    .filter((type) => doc.contentMatch.matchType(type) !== null)
    .map((type) => type.name);
}

/**
 * 官方 UniqueID 的库内配置：属性名 `blockId`，短 ID 生成。
 * `types` 由调用方传入（baseExtensions 的顶层块类型）。
 */
export function createBlockIdUniqueId(types: string[]) {
  return UniqueID.configure({
    attributeName: BLOCK_ID_ATTR,
    types,
    generateID: () => createBlockId(),
  });
}
