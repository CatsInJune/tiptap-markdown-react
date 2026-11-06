/**
 * 工具栏显隐：只有一份清单。
 *
 * 不传 `groups` 时用 {@link defaultToolbarGroups}，`hidden` 从里面划掉内置 id。
 * 传了 `groups` 就整栏换成这份清单，不再读 `hidden`。
 * 图片 / 搜索 / 历史默认不在清单里；写进去就渲染，有没有上传或回调不决定显隐。
 */

export const TOOLBAR_ITEM_IDS = [
  'undo',
  'redo',
  'formatPainter',
  'clearFormatting',
  'style',
  'fontSize',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'textColor',
  'highlight',
  'script',
  'link',
  'image',
  'import',
  'blockquote',
  'details',
  'align',
  'indent',
  'lineHeight',
  'bulletList',
  'orderedList',
  'taskList',
  'search',
  'history',
  'codeBlock',
  'inlineMath',
  'blockMath',
  'hr',
  'table',
  'fullscreen',
] as const;

export type ToolbarItemId = (typeof TOOLBAR_ITEM_IDS)[number];

/** 点开还会再弹出一层，不能放进「更多」。 */
export const TOOLBAR_MORE_REJECTED = [
  'style',
  'fontSize',
  'script',
  'textColor',
  'highlight',
  'align',
  'indent',
  'lineHeight',
  'import',
  'orderedList',
] as const satisfies readonly ToolbarItemId[];

export type ToolbarMoreSlot = { more: readonly string[] };
export type ToolbarSlot = string | ToolbarMoreSlot;
export type ToolbarGroup = readonly ToolbarSlot[];

const BUILTIN = new Set<string>(TOOLBAR_ITEM_IDS);
const MORE_REJECTED = new Set<string>(TOOLBAR_MORE_REJECTED);

export function isToolbarMoreSlot(slot: ToolbarSlot): slot is ToolbarMoreSlot {
  return typeof slot === 'object' && slot !== null && Array.isArray(slot.more);
}

export const defaultToolbarGroups: readonly ToolbarGroup[] = [
  ['undo', 'redo', 'formatPainter', 'clearFormatting'],
  ['style', 'fontSize'],
  [
    'bold',
    'italic',
    'underline',
    'strike',
    'code',
    'textColor',
    'highlight',
    'script',
  ],
  ['link', 'import', 'blockquote', 'details'],
  ['align', 'indent', 'lineHeight'],
  ['bulletList', 'orderedList', 'taskList'],
  [
    {
      more: ['codeBlock', 'inlineMath', 'blockMath', 'hr', 'table', 'fullscreen'],
    },
  ],
];

export interface ResolvedToolbarControl {
  type: 'control';
  id: string;
}

export interface ResolvedToolbarMore {
  type: 'more';
  ids: string[];
}

export type ResolvedToolbarItem = ResolvedToolbarControl | ResolvedToolbarMore;

export interface ResolvedToolbarGroup {
  items: ResolvedToolbarItem[];
}

export interface ResolveToolbarLayoutInput {
  /** 传入（含空数组）即自定义布局，不再读 `hidden`。 */
  groups?: readonly ToolbarGroup[] | null;
  hidden?: readonly string[] | null;
  /** `extraToolbarItems` 的 key。不传 `groups` 时追加到默认「更多」末尾。 */
  extraKeys?: readonly string[] | null;
}

export interface ResolveToolbarLayoutResult {
  groups: ResolvedToolbarGroup[];
  warnings: string[];
  hasImage: boolean;
  hasImport: boolean;
  hasFullscreen: boolean;
}

export function resolveToolbarLayout(
  input: ResolveToolbarLayoutInput,
): ResolveToolbarLayoutResult {
  const warnings: string[] = [];
  const extraKeys = input.extraKeys ?? [];
  const extraSet = new Set(extraKeys);
  const custom = input.groups != null;
  const hidden = new Set<string>();

  if (custom) {
    if (input.hidden && input.hidden.length > 0) {
      warnings.push('Both groups and hidden were passed; hidden is ignored.');
    }
  } else {
    for (const id of input.hidden ?? []) {
      if (typeof id !== 'string' || !BUILTIN.has(id)) {
        if (!extraSet.has(id)) {
          warnings.push(`Unknown toolbar item "${String(id)}".`);
        }
        continue;
      }
      hidden.add(id);
    }
  }

  const source = custom ? input.groups! : defaultToolbarGroups;
  const seen = new Set<string>();
  let moreUsed = false;
  let appendedExtras = false;
  const groups: ResolvedToolbarGroup[] = [];

  const known = (id: string) => BUILTIN.has(id) || extraSet.has(id);

  const claim = (id: string, where: 'bar' | 'more'): boolean => {
    if (typeof id !== 'string' || id.length === 0 || !known(id)) {
      warnings.push(`Unknown toolbar item "${String(id)}".`);
      return false;
    }
    if (where === 'more' && MORE_REJECTED.has(id)) {
      warnings.push(`"${id}" cannot be placed inside the More menu.`);
      return false;
    }
    if (!custom && where === 'bar' && hidden.has(id)) return false;
    if (!custom && where === 'more' && hidden.has(id) && BUILTIN.has(id)) {
      return false;
    }
    if (seen.has(id)) {
      warnings.push(`Duplicate toolbar item "${id}"; keeping the first one.`);
      return false;
    }
    seen.add(id);
    return true;
  };

  for (const group of source) {
    const items: ResolvedToolbarItem[] = [];
    for (const slot of group) {
      if (isToolbarMoreSlot(slot)) {
        if (moreUsed) {
          warnings.push('Only one More menu is allowed; extra More slots are ignored.');
          continue;
        }
        moreUsed = true;
        const ids: string[] = [];
        for (const id of slot.more) {
          if (claim(id, 'more')) ids.push(id);
        }
        if (!custom && !appendedExtras) {
          appendedExtras = true;
          for (const key of extraKeys) {
            if (claim(key, 'more')) ids.push(key);
          }
        }
        if (ids.length > 0) items.push({ type: 'more', ids });
        continue;
      }
      if (typeof slot !== 'string') {
        warnings.push('Unknown toolbar item.');
        continue;
      }
      if (claim(slot, 'bar')) items.push({ type: 'control', id: slot });
    }
    if (items.length > 0) groups.push({ items });
  }

  if (!custom && !appendedExtras && extraKeys.length > 0) {
    const ids: string[] = [];
    for (const key of extraKeys) {
      if (claim(key, 'more')) ids.push(key);
    }
    if (ids.length > 0) groups.push({ items: [{ type: 'more', ids }] });
  }

  const present = new Set<string>();
  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'control') present.add(item.id);
      else for (const id of item.ids) present.add(id);
    }
  }

  return {
    groups,
    warnings,
    hasImage: present.has('image'),
    hasImport: present.has('import'),
    hasFullscreen: present.has('fullscreen'),
  };
}
