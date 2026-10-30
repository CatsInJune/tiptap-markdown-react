import type {
  BlockDragLabels,
  CharacterCountLabels,
  ChartLabels,
  CodeBlockLabels,
  ColorPaletteLabels,
  EmojiSuggestionLabels,
  FindLabels,
  HistoryLabels,
  ImageUploadLabels,
  LinkPopoverLabels,
  ShortcutLabels,
  SlashMenuLabels,
  TocLabels,
  ToolbarLabels,
} from '../labels';

/** 库内置语言。不传时用英文。 */
export type LocaleCode = 'en' | 'zh';

/** 一份语言的全部界面文案。评论浮层内容由宿主 children 提供，不在此列。 */
export interface LocaleBundle {
  toolbar: ToolbarLabels;
  slashMenu: SlashMenuLabels;
  chart: ChartLabels;
  blockDrag: BlockDragLabels;
  shortcut: ShortcutLabels;
  characterCount: CharacterCountLabels;
  emoji: EmojiSuggestionLabels;
  link: LinkPopoverLabels;
  palette: ColorPaletteLabels;
  toc: TocLabels;
  codeBlock: CodeBlockLabels;
  find: FindLabels;
  history: HistoryLabels;
  imageUpload: ImageUploadLabels;
  /** 正文顶部文档标题的占位。 */
  titlePlaceholder: string;
}
