import type { AnyExtension } from '@tiptap/core';
import { Extension, getSchema } from '@tiptap/core';
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
 * `types` 由调用方传入（baseExtensions 顶层块 + 编辑器内容块，见 extensions.ts）。
 */
export function createBlockIdUniqueId(types: string[]) {
  return UniqueID.configure({
    attributeName: BLOCK_ID_ATTR,
    types,
    generateID: () => createBlockId(),
  });
}

/** 标记「这次事务是块 ID 初始化回填」的 meta key；宿主可据此忽略。 */
export const BLOCK_ID_BACKFILL_META = 'tmrBlockIdBackfill';

/**
 * 库内接管初始回填，先于官方 UniqueID（priority 10000）的 onCreate 执行：
 *
 * 1. 顶层块（doc 直接子节点）缺 ID → 发真实 ID；
 * 2. 嵌套块（引用 / 列表 / 表格 / details 内的同名类型）→ 写空串哨兵，阻止
 *    UniqueID 按「类型名对全文档生效」再给它们发随机 ID——这些 ID 永远进不了
 *    markdown（序列化只输出顶层），下次加载又重发，纯属无意义抖动；
 * 3. 整个事务带 `preventUpdate` + {@link BLOCK_ID_BACKFILL_META}：打开文档不触发
 *    宿主的 update 调度（host autosave 正监听 update），也不进撤销历史。
 *
 * UniqueID 仍负责增量分配、粘贴剥 ID、拆分/合并语义——本扩展只接管 onCreate。
 */
export function createBlockIdBackfill(types: string[]) {
  const typeSet = new Set(types);
  return Extension.create({
    name: 'blockIdBackfill',
    // 高于官方 UniqueID 的 10000：create 事件按 priority 降序注册，我们先跑。
    priority: 10001,

    onCreate() {
      const { state, view } = this.editor;
      const { doc } = state;
      const tr = state.tr;

      // 嵌套先写成哨兵，再由顶层回填覆盖成真实 ID（后写的 setNodeMarkup 生效）。
      doc.descendants((node, pos) => {
        if (!typeSet.has(node.type.name)) return true;
        if (node.attrs[BLOCK_ID_ATTR] !== null) return true;
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          [BLOCK_ID_ATTR]: '',
        });
        return true;
      });
      // 顶层：真实 ID（含空段落；空段序列化为空串、不输出注释，但本轮不再抖动）。
      doc.forEach((node, offset) => {
        if (!typeSet.has(node.type.name)) return;
        if (node.attrs[BLOCK_ID_ATTR] !== null) return;
        tr.setNodeMarkup(offset, undefined, {
          ...node.attrs,
          [BLOCK_ID_ATTR]: createBlockId(),
        });
      });

      if (!tr.steps.length) return;
      tr.setMeta('addToHistory', false);
      tr.setMeta('preventUpdate', true);
      tr.setMeta(BLOCK_ID_BACKFILL_META, true);
      view.dispatch(tr);
    },
  });
}
