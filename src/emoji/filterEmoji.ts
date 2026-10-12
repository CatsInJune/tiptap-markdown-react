import type { EmojiItem } from '@tiptap/extension-emoji';
import { isEmojiComponent } from './emojiCategories';

/**
 * 单独的区域指示符是拼国旗的字母零件，系统字体画成方框字母。
 * 建议列表里不放；手打完整 `:regional_indicator_a:` 仍能变成节点。
 */
function isRegionalIndicator(item: EmojiItem): boolean {
  return item.name.startsWith('regional_indicator_');
}

/**
 * 按短码 / 名称优先、标签其次过滤表情。
 * 空查询返回全部可用表情，弹层再按分类切开。
 * 区域指示符和肤色零件不进列表。没有 Unicode 字符的自定义图也不进。
 */
export function filterEmojiItems(items: EmojiItem[], query: string): EmojiItem[] {
  const q = query.trim().toLowerCase();
  const usable = items.filter(
    (item) => !!item.emoji && !isRegionalIndicator(item) && !isEmojiComponent(item),
  );
  if (!q) return usable;

  const primary: EmojiItem[] = [];
  const secondary: EmojiItem[] = [];
  for (const item of usable) {
    const nameHit =
      item.name.toLowerCase().startsWith(q) ||
      item.shortcodes.some((code) => code.toLowerCase().startsWith(q));
    if (nameHit) primary.push(item);
    else if (item.tags.some((tag) => tag.toLowerCase().startsWith(q))) {
      secondary.push(item);
    }
  }
  return [...primary, ...secondary];
}
