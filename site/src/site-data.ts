export type PageId = 'home' | 'components' | 'demos' | 'api';

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const TOP_NAV: { id: PageId; label: string; href: string }[] = [
  { id: 'home', label: 'Home', href: '#/' },
  { id: 'components', label: 'Components', href: '#/components' },
  { id: 'demos', label: 'Demo', href: '#/demos' },
  { id: 'api', label: 'API', href: '#/api' },
];

export const COMPONENT_NAV: NavGroup[] = [
  {
    title: 'Editing',
    items: [
      { id: 'editor', label: 'MarkdownWysiwygEditor', href: '#/components?editor' },
      { id: 'toolbar', label: 'EditorToolbar', href: '#/components?toolbar' },
      { id: 'find', label: 'Find & replace', href: '#/components?find' },
      { id: 'i18n', label: 'Internationalization', href: '#/components?i18n' },
      { id: 'equations', label: 'Equations', href: '#/components?equations' },
      { id: 'charts', label: 'Charts', href: '#/components?charts' },
      { id: 'comment-anchors', label: 'Comment Anchors', href: '#/components?comment-anchors' },
    ],
  },
  {
    title: 'Reading',
    items: [
      { id: 'preview', label: 'MarkdownPreview', href: '#/components?preview' },
      { id: 'report-content', label: 'ReportContent', href: '#/components?report-content' },
      { id: 'citations', label: 'Citations [^n]', href: '#/components?citations' },
    ],
  },
  {
    title: 'UI',
    items: [{ id: 'color-palette', label: 'ColorPalette', href: '#/components?color-palette' }],
  },
  {
    title: 'Server',
    items: [
      { id: 'render-html', label: 'renderReportHtml', href: '#/components?render-html' },
    ],
  },
];

export const DEMO_NAV: NavGroup[] = [
  {
    title: 'Editing',
    items: [
      { id: 'demo-editor', label: 'WYSIWYG Editor', href: '#/demos?demo-editor' },
      { id: 'demo-markdown-in', label: 'Paste / Drop / Import', href: '#/demos?demo-markdown-in' },
      { id: 'demo-toolbar', label: 'Toolbar + Image', href: '#/demos?demo-toolbar' },
      { id: 'demo-codeblock', label: 'Code Block', href: '#/demos?demo-codeblock' },
      { id: 'demo-shortcuts', label: 'Shortcuts', href: '#/demos?demo-shortcuts' },
      { id: 'demo-equations', label: 'Equations', href: '#/demos?demo-equations' },
      { id: 'demo-charts', label: 'Charts', href: '#/demos?demo-charts' },
    ],
  },
  {
    title: 'Reading',
    items: [
      { id: 'demo-preview', label: 'Client Preview', href: '#/demos?demo-preview' },
      { id: 'demo-equations-ssr', label: 'SSR equations', href: '#/demos?demo-equations-ssr' },
      { id: 'demo-charts-ssr', label: 'SSR charts', href: '#/demos?demo-charts-ssr' },
      { id: 'demo-citations', label: 'Citation pills', href: '#/demos?demo-citations' },
      { id: 'demo-citations-ssr', label: 'SSR + citations', href: '#/demos?demo-citations-ssr' },
      { id: 'demo-markdown-out', label: 'Markdown Output', href: '#/demos?demo-markdown-out' },
    ],
  },
  {
    title: 'Navigation',
    items: [{ id: 'demo-toc', label: 'Table of Contents', href: '#/demos?demo-toc' }],
  },
  {
    title: 'Theming',
    items: [{ id: 'demo-theme', label: 'CSS Variables', href: '#/demos?demo-theme' }],
  },
];

export interface ApiRow {
  name: string;
  desc: string;
  type: string;
  defaultVal?: string;
}

export const EDITOR_API: ApiRow[] = [
  { name: 'initialMarkdown', desc: 'Initial markdown content', type: 'string', defaultVal: "''" },
  { name: 'editable', desc: 'Read-only mode: same extensions/NodeViews/styles as editing; interactive controls collapse. Comments ignored when false', type: 'boolean', defaultVal: 'true' },
  { name: 'locale', desc: 'Built-in UI language. en or zh. Toolbar and other sibling components take the same prop; the outline follows the editor', type: "'en' | 'zh'", defaultVal: 'en' },
  { name: 'sources', desc: 'Initial citation sources for [^n] (url/title on citationRef). Init-only', type: 'SourceRef[]', defaultVal: '—' },
  { name: 'renderCitation', desc: 'NodeView slot to wrap citation pills (Popover etc.). Init-only', type: 'RenderCitation', defaultVal: '—' },
  { name: 'placeholder', desc: 'Empty-state placeholder', type: 'string', defaultVal: '—' },
  { name: 'onEditorReady', desc: 'Called when editor is ready / destroyed', type: '(editor: Editor | null) => void', defaultVal: '—' },
  { name: 'onTocChange', desc: 'Optional. Fires when the heading list changes. The editor draws the outline itself', type: '(items: TocItem[]) => void', defaultVal: '—' },
  { name: 'toc', desc: 'Built-in left outline. Ticks when there are headings; hover expands titles and click scrolls. Hidden under 768px', type: 'boolean', defaultVal: 'false' },
  { name: 'markdownPaste', desc: 'Auto-convert pasted markdown text (Shift+paste keeps plain text). Init-only', type: 'boolean', defaultVal: 'true' },
  { name: 'markdownFileDrop', desc: 'Drop / paste .md files to insert parsed content. Init-only', type: 'boolean', defaultVal: 'true' },
  { name: 'imageUpload', desc: 'Official ImageUploadNode-style upload: the toolbar image button inserts a drop/click placeholder block; progress shows in place and the block is replaced by the image when done. upload is required. Init-only', type: 'ImageUploadConfig', defaultVal: '—' },
  { name: 'imageResize', desc: 'Resizable images (official extension-image resize): hover the image, drag a side handle (80px min; max follows the content width by default). Size lands in width/height attrs and round-trips as <img …> in markdown. false disables; object passes official config. Init-only', type: 'boolean | ImageResizeOptions', defaultVal: 'true' },
  { name: 'extraExtensions', desc: 'Additional Tiptap extensions', type: 'AnyExtension[]', defaultVal: '—' },
  { name: 'findReplace', desc: 'Find & replace: registers @tiptap/extension-find-and-replace and renders the floating bar', type: 'boolean', defaultVal: 'true' },
  { name: 'findBar', desc: 'Render the bar inside the editor; false hands placement to the host (render <FindReplaceBar> yourself)', type: 'boolean', defaultVal: '= findReplace' },
  { name: 'findBarContainer', desc: 'Mount the bar into a container you own (popup-container pattern); null falls back to the in-editor bar', type: 'HTMLElement | (() => HTMLElement | null)', defaultVal: '—' },
  { name: 'findBarOffset', desc: 'Where the library-rendered bar sits in its context (editor, or your container)', type: '{ top?; right?; bottom?; left? }', defaultVal: '{ top: 4, right: 4 }' },
  { name: 'findShortcut', desc: 'Take over Cmd/Ctrl+F while the editor has focus; false keeps native find (use handle.openFind())', type: 'boolean', defaultVal: 'true' },
  { name: 'onFindOpenChange', desc: 'Fired when the bar actually shows or hides — drives an external entry such as the toolbar magnifier', type: '(open: boolean) => void', defaultVal: '—' },
  { name: 'slashMenu', desc: 'Type / (line start or after whitespace) to open the block-insert menu. Table cells included, code blocks excluded; inert read-only', type: 'boolean', defaultVal: 'true' },
  { name: 'typography', desc: 'Official Typography (MIT, not Pro): smart quotes, em dashes, ellipses and its other input rules. Skipped inside code. --- still inserts a divider. Init-only', type: 'boolean', defaultVal: 'true' },
  { name: 'emojiSuggestion', desc: 'Type : (line start or after whitespace) to open the emoji list. Nodes round-trip as :shortcode:. false hides the list; a full shortcode still inserts. Inert read-only. Init-only', type: 'boolean', defaultVal: 'true' },
  { name: 'blockDrag', desc: 'Hover a block for a left handle: drag to reorder, click for turn-into / copy / duplicate / delete. A + inserts / to open the slash menu. Hidden when read-only or under 768px; reserves a left gutter', type: 'boolean', defaultVal: 'true' },
  { name: 'characterCount', desc: 'Live full-document character and word count via MIT CharacterCount (@tiptap/extensions, not a Pro extension). The status UI is ours. Each CJK ideograph counts as one word. Read editor.storage.characterCount too. Init-only', type: 'boolean', defaultVal: 'false' },
  { name: 'shortcutPanel', desc: 'Keyboard FAB bottom-right opens the shortcuts drawer (Format / Shortcut / Markdown). Hidden read-only', type: 'boolean', defaultVal: 'true' },
  { name: 'shortcutFabContainer', desc: 'Mount the keyboard FAB into a container you own (popup-container pattern); positioning becomes yours — e.g. stack it above a back-to-top button. null falls back to the in-editor FAB', type: 'HTMLElement | (() => HTMLElement | null)', defaultVal: 'in-editor FAB' },
  { name: 'className', desc: 'Extra class on scroll container', type: 'string', defaultVal: '—' },
];

export const EDITOR_REF_API: ApiRow[] = [
  { name: 'getMarkdown()', desc: 'Export current content as markdown', type: '() => string' },
  { name: 'getHTML()', desc: 'Export current content as HTML', type: '() => string' },
  { name: 'getJSON()', desc: 'Export Tiptap JSON document', type: '() => Record<string, unknown>' },
  { name: 'getEditor()', desc: 'Underlying Tiptap Editor instance', type: '() => Editor | null' },
  { name: 'openFind()', desc: 'Open the bar; calling it while open refocuses and selects the query', type: '() => void' },
  { name: 'closeFind()', desc: 'Close the bar, clear highlights and refocus the editor', type: '() => void' },
  { name: 'toggleFind()', desc: 'Flip the bar — open when closed, close when open (pair it with a toolbar entry that shows an active state)', type: '() => void' },
];

export const TOOLBAR_API: ApiRow[] = [
  { name: 'editor', desc: 'Tiptap Editor instance (required)', type: 'Editor' },
  { name: 'onImageUpload', desc: 'Legacy direct-upload path: picking a file inserts the returned URL. Ignored when the editor registers the imageUpload extension', type: '(file: File) => Promise<string>', defaultVal: '—' },
  { name: 'onError', desc: 'Side-effect error callback', type: "(err: unknown, source?: 'image' | 'markdown' | 'import') => void", defaultVal: '—' },
  { name: 'onImportDocument', desc: 'Convert a non-Markdown file to Markdown. Omit and Import only takes .md', type: '(file: File, ctx: ImportDocumentContext) => Promise<ImportDocumentResult | string>', defaultVal: '—' },
  { name: 'importAccept', desc: 'Extra accept for the default Document menu item when importMenuItems is omitted', type: 'string', defaultVal: '—' },
  { name: 'importMenuItems', desc: 'Import dropdown options (label + accept). Hosts split Markdown / Word / PDF here', type: 'ImportMenuItem[]', defaultVal: '—' },
  { name: 'showImport', desc: 'Show the Import dropdown', type: 'boolean', defaultVal: 'true' },
  { name: 'locale', desc: 'Built-in UI language', type: "'en' | 'zh'", defaultVal: 'en' },
  { name: 'onSearch', desc: 'Search entry (magnifier) left of the More menu; wire it to handle.toggleFind() — omit and no button renders', type: '() => void', defaultVal: '—' },
  { name: 'searchActive', desc: 'Whether the bar is open; drives aria-pressed on the search entry', type: 'boolean', defaultVal: 'false' },
  { name: 'extraToolbarItems', desc: 'Custom items in More menu', type: 'ExtraToolbarItem[]', defaultVal: '—' },
  { name: 'className', desc: 'Extra root class', type: 'string', defaultVal: '—' },
];

export const LINK_API: ApiRow[] = [
  { name: 'editor', desc: 'Tiptap Editor instance (required)', type: 'Editor' },
  { name: 'trigger', desc: 'Your own trigger element — Radix asChild takes over its click / ref / aria', type: 'ReactNode' },
  { name: 'locale', desc: 'Built-in UI language', type: "'en' | 'zh'", defaultVal: 'en' },
  { name: 'className / style', desc: 'Extra class / inline style on the panel (placement stays with Radix)', type: 'string / CSSProperties', defaultVal: '—' },
  { name: 'applyLink(editor, raw)', desc: 'Normalise and apply an address over the whole link / selection. false = the editor rejected it', type: '(editor, raw: string) => boolean' },
  { name: 'removeLink(editor)', desc: 'Strip the link from the whole range without letting autolink add it back', type: '(editor) => boolean' },
  { name: 'normalizeLinkHref(editor, raw)', desc: 'Bare domains and host:port take the configured protocol; site-relative, #anchor and mailto: stay as typed', type: '(editor, raw) => string' },
  { name: 'sanitizeLinkUrl(input, baseUrl)', desc: 'Absolute URL, or "#" when the protocol is not openable (javascript:, data:, …)', type: '(input, baseUrl) => string' },
  { name: 'data-link-popover / -field / -action / -invalid', desc: 'Stable selectors for host CSS (internals are hashed CSS-module classes)', type: 'data attributes', defaultVal: '—' },
];

export const PREVIEW_API: ApiRow[] = [
  { name: 'markdown', desc: 'Markdown string to render', type: 'string' },
  { name: 'sources', desc: 'Optional: attach url/title onto [^n] nodes by index', type: 'SourceRef[]', defaultVal: '—' },
  { name: 'renderCitation', desc: 'NodeView slot: wrap the pill (e.g. host Popover). Data lookup is host-owned', type: 'RenderCitation', defaultVal: '—' },
  { name: 'className', desc: 'Extra class on scroll container', type: 'string', defaultVal: '—' },
  { name: 'locale', desc: 'Built-in UI language for the read-only code block, charts, and outline', type: "'en' | 'zh'", defaultVal: 'en' },
  { name: 'toc', desc: 'Built-in left outline. Ticks when there are headings; hover expands titles and click scrolls. Hidden under 768px', type: 'boolean', defaultVal: 'false' },
];

export const REPORT_CONTENT_API: ApiRow[] = [
  { name: 'html', desc: 'HTML from renderReportHtml(...).html', type: 'string' },
  { name: 'className', desc: 'Extra class merged with editorContent', type: 'string', defaultVal: '—' },
  { name: 'toc', desc: 'On the ./reader export: built-in left outline. The ./server export ignores this and stays static HTML', type: 'boolean', defaultVal: 'false' },
  { name: 'locale', desc: 'Outline accessible name on the ./reader export', type: "'en' | 'zh'", defaultVal: 'en' },
];

export const RENDER_HTML_API: ApiRow[] = [
  { name: 'markdown', desc: 'Input markdown string', type: 'string' },
  { name: 'lockedTitles / options.lockedTitles', desc: 'Paywalled section titles (TOC locked)', type: 'string[]', defaultVal: '[]' },
  { name: 'options.sources', desc: 'Citation sources aligned by index to [^n]', type: 'SourceRef[]', defaultVal: '—' },
  { name: 'returns.html', desc: 'Rendered HTML string', type: 'string' },
  { name: 'returns.toc', desc: 'Extracted table of contents', type: 'TocItem[]' },
];

export const INSERT_MARKDOWN_API: ApiRow[] = [
  { name: 'editor', desc: 'Tiptap Editor instance', type: 'Editor' },
  { name: 'markdown', desc: 'Markdown string to insert at cursor position', type: 'string' },
  { name: 'sources', desc: 'Optional citation sources; enriches [^n] before insert', type: 'SourceRef[]', defaultVal: '[]' },
];

export const CITATION_API: ApiRow[] = [
  { name: 'renderCitation', desc: 'Editor/Preview NodeView slot: ({ index, attrs, defaultDom }) => ReactNode', type: 'RenderCitation' },
  { name: 'CitationInteractive', desc: 'SSR reader: event-delegates .citation-ref; emits onCitationEnter / onCitationLeave (no open state)', type: 'Component' },
  { name: 'ReportContentInteractive', desc: 'Convenience: ReportContent + CitationInteractive. Reading pages: import from tiptap-markdown-react/reader', type: 'Component' },
  { name: 'onCitationEnter / onCitationLeave', desc: 'Host-owned open/close; ctx has index + anchorEl', type: 'callbacks' },
  { name: 'createCitationRef({ renderCitation })', desc: 'Client CitationRef + NodeView', type: '() => Extension' },
  { name: 'CitationRef', desc: 'Pure schema node for SSR HTML (no React)', type: 'Node' },
  { name: 'findCitationRefElement / readCitationAttrs', desc: 'DOM helpers for custom delegation', type: 'function' },
  { name: 'enrichMarkdownCitations / applyCitationSources', desc: 'Optional helpers to attach url/title by index', type: 'function' },
];

export const CITATION_INTERACTIVE_API: ApiRow[] = [
  { name: 'containerRef', desc: 'Ref to the element wrapping ReportContent HTML', type: 'RefObject<HTMLElement | null>' },
  { name: 'onCitationEnter', desc: 'Pill clicked; host opens Popover', type: 'OnCitationEnter' },
  { name: 'onCitationLeave', desc: 'Click outside / same pill again / Escape; host closes', type: 'OnCitationLeave' },
];

export const THEME_VARS: ApiRow[] = [
  { name: '--tmr-accent', desc: 'Accent color (selection, links, TOC active)', type: 'color', defaultVal: '#ff6719' },
  { name: '--tmr-selection', desc: 'Blurred text-selection highlight. Defaults to a 28% mix of the accent', type: 'color', defaultVal: 'accent 28%' },
  { name: '--tmr-text', desc: 'Body text color', type: 'color', defaultVal: '#1b1b1b' },
  { name: '--tmr-muted', desc: 'Secondary text', type: 'color', defaultVal: '#6b6b6b' },
  { name: '--tmr-border', desc: 'Borders and dividers', type: 'color', defaultVal: '#eaeaea' },
  { name: '--tmr-body-font', desc: 'Body font family', type: 'font-family' },
  { name: '--tmr-font-size', desc: 'Base font size', type: 'length', defaultVal: '16px' },
  { name: '--tmr-line-height', desc: 'Body line height', type: 'number', defaultVal: '1.7' },
  { name: '--tmr-citation-bg', desc: 'Citation pill background (default matches toolbar active wash)', type: 'color', defaultVal: '#fff3ec' },
  { name: '--tmr-citation-fg', desc: 'Citation pill text / number', type: 'color', defaultVal: '#ff6719' },
  { name: '--tmr-citation-border', desc: 'Citation pill border', type: 'color', defaultVal: '#ffd4b8' },
  { name: '--tmr-citation-bg-hover', desc: 'Citation pill hover background', type: 'color', defaultVal: '#ff6719' },
  { name: '--tmr-citation-fg-hover', desc: 'Citation pill hover text', type: 'color', defaultVal: '#ffffff' },
];

export const SCROLL_TO_TOC_HEADING_API: ApiRow[] = [
  { name: 'headingId', desc: 'TOC item id, matches the data-toc-id attribute on the target heading', type: 'string' },
  { name: 'scrollContainer', desc: 'The overflow:auto container element to animate', type: 'HTMLElement' },
  { name: 'options.duration', desc: 'Animation duration in ms (default 400)', type: 'number', defaultVal: '400' },
];

export const TOC_UTIL_API: ApiRow[] = [
  { name: 'extractToc(doc)', desc: 'Extract TocItem[] from Tiptap JSONContent', type: '(doc: JSONContent) => TocItem[]' },
  { name: 'makeTocGetId(headings)', desc: 'Returns (text, level) => slug; shared anchor logic for SSR + client', type: '(headings: HeadingInfo[]) => (text: string, level: number) => string' },
  { name: 'looksLikeMarkdown(text)', desc: 'Heuristic: does plain-text contain markdown patterns?', type: '(text: string) => boolean' },
];

export const MATH_API: ApiRow[] = [
  { name: 'insert', desc: 'Toolbar More → Inline equation / Block equation. No keyboard shortcut; typing $ / $$ stays text', type: 'toolbar' },
  { name: 'edit', desc: 'Click a formula: KaTeX stays in the document (highlighted); pill input anchors below and updates it in place; Done / Enter (⌘Enter for block)', type: 'anchored popover' },
  { name: 'inline markdown', desc: 'Single-line $$latex$$ serializes as inlineMath', type: '$$E = mc^2$$' },
  { name: 'block markdown', desc: 'Newline-wrapped $$ is blockMath', type: '$$\\nlatex\\n$$' },
  { name: 'dollar amounts', desc: 'Single $ is never math — $24.4B, US$, even $24.4B$ stay text', type: 'text' },
  { name: 'commands', desc: 'editor.commands.insertInlineMath / insertBlockMath / updateInlineMath / updateBlockMath', type: '{ latex: string }' },
  { name: 'SSR', desc: 'renderReportHtml emits KaTeX HTML (.katex) so /p works without NodeView', type: 'renderToString' },
];

export const MATH_LABELS_API: ApiRow[] = [
  { name: 'inlineMath', desc: 'More menu: insert inline equation', type: 'string', defaultVal: 'Inline equation' },
  { name: 'blockMath', desc: 'More menu: insert block equation', type: 'string', defaultVal: 'Block equation' },
  { name: 'mathPlaceholder', desc: 'LaTeX input placeholder', type: 'string', defaultVal: 'E = mc^2' },
  { name: 'mathDone', desc: 'Confirm button', type: 'string', defaultVal: 'Done' },
  { name: 'mathCancel', desc: 'Unused in UI (Escape / click outside still cancels)', type: 'string', defaultVal: 'Cancel' },
  { name: 'mathNewInline', desc: 'Empty inline insert chip (before the first LaTeX character)', type: 'string', defaultVal: 'New equation' },
  { name: 'mathNewBlock', desc: 'Empty block insert hint bar (before the first LaTeX character)', type: 'string', defaultVal: 'Add a TeX equation' },
];

export const PACKAGE_FEATURES = [
  { icon: '📝', title: 'Markdown in/out', body: 'Author and export as Markdown. getHTML() and getJSON() available too.' },
  { icon: '🎨', title: 'Opinionated UI', body: 'Toolbar, color palette, code blocks, TOC — styled out of the box, zero UI framework.' },
  { icon: '👁', title: 'Editor + Preview + SSR', body: 'Client editor, live preview, and server-side renderReportHtml for SEO pages.' },
  { icon: '🔗', title: 'Stable TOC anchors', body: 'Shared slug logic between editor, preview, and published reader.' },
  { icon: '🎯', title: 'Themeable', body: 'All colors and fonts exposed as --tmr-* CSS variables.' },
  { icon: '📎', title: 'Citation pills', body: 'Parse [^n] into mid-line circular markers; hosts supply sources + optional Popover.' },
  { icon: '∑', title: 'KaTeX equations', body: 'Toolbar insert; click to edit in place. Markdown uses $$; single $ is always a dollar sign.' },
  { icon: '📊', title: 'Charts', body: 'Chart.js via HTML comment + GFM table. SSR placeholder + client hydrate.' },
];

/** 首页示例用的脚注。编辑器、预览、服务端渲染共用，圆标才对得上。 */
export const DEMO_SOURCES = [
  {
    index: '1',
    url: 'https://tiptap.dev',
    title: 'Tiptap',
    excerpt: '编辑器与阅读页共用同一份 Markdown。',
  },
];

/**
 * 首页预置稿：覆盖工具栏能写进 Markdown 的操作。
 * 预览（MarkdownPreview）和服务端渲染（renderReportHtml）读的是同一串。
 */
export const DEMO_MD = `# 编辑器能力

这一段把行内操作放在一起：**加粗**、*斜体*、++下划线++、~~删除线~~、\`行内代码\`，以及 [链接](https://tiptap.dev)。

<span style="font-size:24px">**启示一：IP的价值不在产品，而在意义**</span>

<span style="color:#ff6719">主题色文字</span>，==高亮==，水的化学式是 H<sub>2</sub>O，平方写作 x<sup>2</sup>。

金额 $24.4B 不会变成公式。表情 :smile:。出处见文档[^1]。

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

<p style="text-align: center">这一段居中</p>

<p style="text-align: right">这一段右对齐</p>

<p style="text-align: justify">两端对齐需要足够长的一行文字，这样阅读页才会把词距拉开。这里再补几个字，避免短句看不出效果。</p>

<p style="margin-left: 2em">这一段缩进一级</p>

<p style="line-height: 2">这一段行高是 2。换行之后仍能看出行距变大，第二行就在这里。</p>

## 列表

- 无序第一项
  - 嵌套的无序项
- 无序第二项

1. 有序甲
2. 有序乙
   1. 嵌套的有序项

- [ ] 未完成的待办
- [x] 已完成的待办

<ol data-numbering-format="upper-alpha">

1. 字母编号甲
2. 字母编号乙

</ol>

## 引用、折叠与分隔

> 这是一段引用。

<details open>
<summary>展开的折叠块</summary>

折叠块里可以继续写 **加粗**。

</details>

<details>
<summary>收起的折叠块</summary>

这段默认折叠，预览和阅读页都不展开。

</details>

---

## 代码与公式

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

行内公式 $$E = mc^2$$。块级公式：

$$
\\sum_{i=1}^{n} x_i = X
$$

## 表格

| 功能 | 编辑器 | 阅读页 |
| --- | :---: | ---: |
| Markdown | 支持 | 支持 |
| 服务端渲染 | — | 支持 |

## 图片

<figure>
<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='160'%3E%3Crect width='640' height='160' rx='16' fill='%23fff4ec'/%3E%3Crect x='28' y='48' width='84' height='64' rx='8' fill='%23ff6719'/%3E%3C/svg%3E" alt="示意图" width="480" data-align="center">
<figcaption>居中的图片，带描述</figcaption>
</figure>

## 图表

<!-- {"chartType": "column", "x": "季度", "y": "营收", "title": "季度营收"} -->
| 季度 | 营收 |
| --- | --- |
| Q1 | 12 |
| Q2 | 18 |
| Q3 | 15 |
| Q4 | 21 |
`;

export const INGEST_MD = `# Markdown in: three ways

1. **Paste** markdown text — auto-detected and converted (Shift+paste keeps it plain)
2. **Drag & drop** a \`.md\` file anywhere in this editor
3. Toolbar **More → Import Markdown** opens a file picker

Try it now: select and copy the source inside the code block below (it is plain text there), then paste it under this line.

\`\`\`md
## Pasted section

- converted **rich** item
- [a link](https://tiptap.dev)

> a blockquote from pasted markdown
\`\`\`
`;

export const CODEBLOCK_MD = `## Code block demo

Try the language dropdown and keyboard navigation around the block.

\`\`\`python
def fibonacci(n: int) -> list[int]:
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result
\`\`\`

Press Backspace below the block to select it first (orange border), then delete.
`;

export const MATH_MD = `## Equations

Insert from **More → Inline equation / Block equation**. Click a formula to edit LaTeX in place.

Revenue is $$R = P \\times Q$$. Dollar amounts stay text: Temu GMV is $24.4B, not a formula.

$$
\\sum_{i=1}^{n} x_i = X
$$

Typing \`$24.4B\` or even \`$24.4B$\` never becomes math. Importing markdown that already uses \`$$…$$\` still renders.
`;

export const CHART_MD = `## Charts

LLM / backend style: HTML comment config + GFM table. Click a chart to edit JSON + table.

<!-- {"chartType": "line", "x": "date", "y": "close", "title": "历史价格走势", "dataTime": "2024-01-02"} -->
| date | close |
|------|------|
| 2024-01-01 | 100 |
| 2024-01-02 | 110 |
| 2024-01-03 | 105 |

<!-- [{"chartType":"bar","title":"按业务","x":"业务","y":"销量"},{"chartType":"pie","title":"占比","x":"业务","y":"销量"}] -->
| 业务 | 销量 |
| ---- | ---- |
| 收入 | 40 |
| 成本 | 25 |
| 利润 | 15 |

<!-- {"chartType": "pie"} -->
| type | value |
| ---- | ----- |
| A | 27 |
| B | 25 |
| C | 18 |
`;

export const PREVIEW_MD = `# Published article preview

This is how **MarkdownPreview** renders the same markdown as the editor — same extensions, same styles.

## Syntax highlighting

\`\`\`javascript
const sum = (a, b) => a + b;
console.log(sum(2, 3));
\`\`\`

## Table support

| Column | Value |
| ------ | ----- |
| Alpha  | 1     |
| Beta   | 2     |

Inline math $$a^2 + b^2 = c^2$$ and a dollar amount $24.4B stay distinct.
`;

export const CITATION_MD = `## Revenue growth

- 2023Q4: 889亿美元[^3]
- 2024Q4: 1,106亿美元[^4]
- 2025Q3: 1,083亿美元[^5]

FY2025 营收同比 -1.21%[^1]，生意模式底层结构未变[^3]。
`;

export const CITATION_SOURCES = [
  {
    index: '1',
    url: 'https://example.com/fy2025-report#kpi',
    title: 'FY2025 年报',
    excerpt: '营业收入同比 -1.21%；归母净利润同比 -4.53%。',
  },
  {
    index: '3',
    url: 'https://example.com/fy2023q4',
    title: '2023Q4 财报',
    excerpt: '营业收入：88,881,036,000.0美元',
  },
  {
    index: '4',
    url: 'https://example.com/fy2024q4',
    title: '2024Q4 财报',
    excerpt: '营业收入：110,600,000,000美元',
  },
  {
    index: '5',
    url: 'https://example.com/fy2025q3',
    title: '2025Q3 财报',
    excerpt: '营业收入：108,300,000,000美元',
  },
];

export const FIND_API: ApiRow[] = [
  { name: 'findReplace', desc: 'Register the official find extension and render the floating bar', type: 'boolean', defaultVal: 'true' },
  { name: 'findBar', desc: 'Let the editor render the bar; false = host places <FindReplaceBar> itself', type: 'boolean', defaultVal: '= findReplace' },
  { name: 'findBarContainer', desc: 'Where the library-rendered bar mounts (open state + shortcut stay in the library)', type: 'HTMLElement | (() => HTMLElement | null)', defaultVal: 'in-editor bar' },
  { name: 'findShortcut', desc: 'Take over Cmd/Ctrl+F while the editor has focus (only when the editor owns a bar)', type: 'boolean', defaultVal: 'true' },
  { name: 'locale', desc: 'Built-in UI language for the bar', type: "'en' | 'zh'", defaultVal: 'en' },
  { name: 'onFindOpenChange', desc: 'Bar open/close notification (fires only when the bar actually shows or hides, plus once on unmount)', type: '(open: boolean) => void', defaultVal: '—' },
  { name: 'Esc / × / toggleFind', desc: 'Ways out of the bar. Esc works from anywhere that belongs to the editor and is consumed; clicking into the document or another input deliberately does not close it', type: 'keyboard / handle', defaultVal: '—' },
  { name: 'EditorToolbar onSearch / searchActive', desc: 'Toolbar magnifier entry: onSearch wires to handle.openFind(), searchActive drives its aria-pressed', type: '() => void / boolean', defaultVal: '—' },
  { name: 'data-find-bar / -field / -counter / -option / -action', desc: 'Stable selectors for host CSS (the bar internals use hashed CSS-module classes)', type: 'data attributes', defaultVal: '—' },
  { name: 'FindReplaceBar', desc: 'The bar itself, if you place it yourself', type: 'Component', defaultVal: '—' },
  { name: 'FindAndReplace', desc: 'Re-exported official extension for hand-built pipelines', type: 'Extension', defaultVal: '—' },
  { name: 'runFindCommand', desc: 'Guard for the Tiptap 3.31.3 trailing-node transaction mismatch', type: '(run: () => void) => void', defaultVal: '—' },
];

export const I18N_API: ApiRow[] = [
  { name: 'locale', desc: 'Built-in language on each visible component: editor, toolbar, TOC, palette, find bar, link popover, preview', type: "'en' | 'zh'", defaultVal: 'en' },
  { name: 'LocaleCode', desc: 'Exported union of the built-in languages', type: "'en' | 'zh'", defaultVal: '—' },
];
