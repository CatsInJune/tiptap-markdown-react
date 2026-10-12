import type { EmojiItem } from '@tiptap/extension-emoji';

/** 底部标签。顺序与官方数据的 group 一致；图标是分类代表，不依赖某一条数据还在不在。 */
export const EMOJI_CATEGORIES = [
  { id: 'smileys', group: '', label: 'Smileys', icon: '😀' },
  { id: 'people', group: 'people & body', label: 'People', icon: '👋' },
  { id: 'nature', group: 'animals & nature', label: 'Animals & nature', icon: '🐻' },
  { id: 'food', group: 'food & drink', label: 'Food & drink', icon: '🍔' },
  { id: 'travel', group: 'travel & places', label: 'Travel & places', icon: '✈️' },
  { id: 'activities', group: 'activities', label: 'Activities', icon: '⚽' },
  { id: 'objects', group: 'objects', label: 'Objects', icon: '💡' },
  { id: 'symbols', group: 'symbols', label: 'Symbols', icon: '💯' },
  { id: 'flags', group: 'flags', label: 'Flags', icon: '🏁' },
] as const;

export type EmojiCategoryId = (typeof EMOJI_CATEGORIES)[number]['id'];

/** 肤色和发型零件。官方扩展不支持肤色修饰，单独显示也不是可选表情。 */
export function isEmojiComponent(item: EmojiItem): boolean {
  return item.group === 'components';
}

export function itemsInCategory(items: EmojiItem[], id: EmojiCategoryId): EmojiItem[] {
  const category = EMOJI_CATEGORIES.find((entry) => entry.id === id);
  if (!category) return [];
  return items.filter((item) => (item.group ?? '') === category.group);
}
