import {
  defaultBlockDragLabels,
  defaultCharacterCountLabels,
  defaultChartLabels,
  defaultCodeBlockLabels,
  defaultColorPaletteLabels,
  defaultEmojiSuggestionLabels,
  defaultFindLabels,
  defaultHistoryLabels,
  defaultImageUploadLabels,
  defaultLinkPopoverLabels,
  defaultShortcutLabels,
  defaultSlashMenuLabels,
  defaultTocLabels,
  defaultToolbarLabels,
} from '../labels';
import type { LocaleBundle, LocaleCode } from './types';
import { zh } from './zh';

export type { LocaleBundle, LocaleCode } from './types';

const en: LocaleBundle = {
  toolbar: defaultToolbarLabels,
  slashMenu: defaultSlashMenuLabels,
  chart: defaultChartLabels,
  blockDrag: defaultBlockDragLabels,
  shortcut: defaultShortcutLabels,
  characterCount: defaultCharacterCountLabels,
  emoji: defaultEmojiSuggestionLabels,
  link: defaultLinkPopoverLabels,
  palette: defaultColorPaletteLabels,
  toc: defaultTocLabels,
  codeBlock: defaultCodeBlockLabels,
  find: defaultFindLabels,
  history: defaultHistoryLabels,
  imageUpload: defaultImageUploadLabels,
  titlePlaceholder: 'Title',
};

const bundles: Record<LocaleCode, LocaleBundle> = { en, zh };

/** 取一份完整文案。未知语言回落英文。 */
export function getLocaleBundle(locale: LocaleCode = 'en'): LocaleBundle {
  return bundles[locale] ?? en;
}
