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
      { id: 'editor', label: 'MarkdownWysiwygEditor', href: '#editor' },
      { id: 'toolbar', label: 'EditorToolbar', href: '#toolbar' },
      { id: 'equations', label: 'Equations', href: '#equations' },
      { id: 'comment-anchors', label: 'Comment Anchors', href: '#comment-anchors' },
    ],
  },
  {
    title: 'Reading',
    items: [
      { id: 'preview', label: 'MarkdownPreview', href: '#preview' },
      { id: 'report-content', label: 'ReportContent', href: '#report-content' },
      { id: 'citations', label: 'Citations [^n]', href: '#citations' },
    ],
  },
  {
    title: 'Navigation',
    items: [{ id: 'toc', label: 'TocPanel', href: '#toc' }],
  },
  {
    title: 'UI',
    items: [{ id: 'color-palette', label: 'ColorPalette', href: '#color-palette' }],
  },
  {
    title: 'Server',
    items: [
      { id: 'render-html', label: 'renderReportHtml', href: '#render-html' },
    ],
  },
];

export const DEMO_NAV: NavGroup[] = [
  {
    title: 'Editing',
    items: [
      { id: 'demo-editor', label: 'WYSIWYG Editor', href: '#demo-editor' },
      { id: 'demo-markdown-in', label: 'Paste / Drop / Import', href: '#demo-markdown-in' },
      { id: 'demo-toolbar', label: 'Toolbar + Image', href: '#demo-toolbar' },
      { id: 'demo-codeblock', label: 'Code Block', href: '#demo-codeblock' },
      { id: 'demo-equations', label: 'Equations', href: '#demo-equations' },
    ],
  },
  {
    title: 'Reading',
    items: [
      { id: 'demo-preview', label: 'Client Preview', href: '#demo-preview' },
      { id: 'demo-equations-ssr', label: 'SSR equations', href: '#demo-equations-ssr' },
      { id: 'demo-citations', label: 'Citation pills', href: '#demo-citations' },
      { id: 'demo-citations-ssr', label: 'SSR + citations', href: '#demo-citations-ssr' },
      { id: 'demo-markdown-out', label: 'Markdown Output', href: '#demo-markdown-out' },
    ],
  },
  {
    title: 'Navigation',
    items: [{ id: 'demo-toc', label: 'Table of Contents', href: '#demo-toc' }],
  },
  {
    title: 'Theming',
    items: [{ id: 'demo-theme', label: 'CSS Variables', href: '#demo-theme' }],
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
  { name: 'sources', desc: 'Initial citation sources for [^n] (url/title on citationRef). Init-only', type: 'SourceRef[]', defaultVal: '—' },
  { name: 'renderCitation', desc: 'NodeView slot to wrap citation pills (Popover etc.). Init-only', type: 'RenderCitation', defaultVal: '—' },
  { name: 'placeholder', desc: 'Empty-state placeholder', type: 'string', defaultVal: '—' },
  { name: 'onEditorReady', desc: 'Called when editor is ready / destroyed', type: '(editor: Editor | null) => void', defaultVal: '—' },
  { name: 'onTocChange', desc: 'TOC updates when headings change', type: '(items: TocItem[]) => void', defaultVal: '—' },
  { name: 'markdownPaste', desc: 'Auto-convert pasted markdown text (Shift+paste keeps plain text). Init-only', type: 'boolean', defaultVal: 'true' },
  { name: 'markdownFileDrop', desc: 'Drop / paste .md files to insert parsed content. Init-only', type: 'boolean', defaultVal: 'true' },
  { name: 'extraExtensions', desc: 'Additional Tiptap extensions', type: 'AnyExtension[]', defaultVal: '—' },
  { name: 'codeBlockLabels', desc: 'Code block NodeView labels', type: 'Partial<CodeBlockLabels>', defaultVal: '—' },
  { name: 'className', desc: 'Extra class on scroll container', type: 'string', defaultVal: '—' },
];

export const EDITOR_REF_API: ApiRow[] = [
  { name: 'getMarkdown()', desc: 'Export current content as markdown', type: '() => string' },
  { name: 'getHTML()', desc: 'Export current content as HTML', type: '() => string' },
  { name: 'getJSON()', desc: 'Export Tiptap JSON document', type: '() => Record<string, unknown>' },
  { name: 'getEditor()', desc: 'Underlying Tiptap Editor instance', type: '() => Editor | null' },
];

export const TOOLBAR_API: ApiRow[] = [
  { name: 'editor', desc: 'Tiptap Editor instance (required)', type: 'Editor' },
  { name: 'onImageUpload', desc: 'Upload handler; hides image button if omitted', type: '(file: File) => Promise<string>', defaultVal: '—' },
  { name: 'onError', desc: 'Side-effect error callback', type: '(err: unknown) => void', defaultVal: '—' },
  { name: 'labels', desc: 'Toolbar label overrides', type: 'Partial<ToolbarLabels>', defaultVal: '—' },
  { name: 'extraToolbarItems', desc: 'Custom items in More menu', type: 'ExtraToolbarItem[]', defaultVal: '—' },
  { name: 'className', desc: 'Extra root class', type: 'string', defaultVal: '—' },
];

export const PREVIEW_API: ApiRow[] = [
  { name: 'markdown', desc: 'Markdown string to render', type: 'string' },
  { name: 'sources', desc: 'Optional: attach url/title onto [^n] nodes by index', type: 'SourceRef[]', defaultVal: '—' },
  { name: 'renderCitation', desc: 'NodeView slot: wrap the pill (e.g. host Popover). Data lookup is host-owned', type: 'RenderCitation', defaultVal: '—' },
  { name: 'className', desc: 'Extra class on scroll container', type: 'string', defaultVal: '—' },
];

export const TOC_API: ApiRow[] = [
  { name: 'items', desc: 'TOC entries from extractToc / onTocChange', type: 'TocItem[]' },
  { name: 'activeId', desc: 'Currently highlighted anchor id', type: 'string', defaultVal: '—' },
  { name: 'onItemClick', desc: 'Click handler (locked items ignored)', type: '(item: TocItem) => void', defaultVal: '—' },
  { name: 'labels', desc: 'Panel label overrides', type: 'Partial<TocLabels>', defaultVal: '—' },
];

export const REPORT_CONTENT_API: ApiRow[] = [
  { name: 'html', desc: 'HTML from renderReportHtml(...).html', type: 'string' },
  { name: 'className', desc: 'Extra class merged with editorContent', type: 'string', defaultVal: '—' },
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
  { name: 'ReportContentInteractive', desc: 'Convenience: ReportContent + CitationInteractive', type: 'Component' },
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
  { name: 'edit', desc: 'Click a rendered formula to edit LaTeX with live KaTeX preview', type: 'onClick popover' },
  { name: 'inline markdown', desc: 'Single-line $$latex$$ serializes as inlineMath', type: '$$E = mc^2$$' },
  { name: 'block markdown', desc: 'Newline-wrapped $$ is blockMath', type: '$$\\nlatex\\n$$' },
  { name: 'dollar amounts', desc: 'Single $ is never math — $24.4B, US$, even $24.4B$ stay text', type: 'text' },
  { name: 'commands', desc: 'editor.commands.insertInlineMath / insertBlockMath / updateInlineMath / updateBlockMath', type: '{ latex: string }' },
  { name: 'SSR', desc: 'renderReportHtml emits KaTeX HTML (.katex) so /p works without NodeView', type: 'renderToString' },
];

export const MATH_LABELS_API: ApiRow[] = [
  { name: 'inlineMath', desc: 'More menu: insert inline equation', type: 'string', defaultVal: 'Inline equation' },
  { name: 'blockMath', desc: 'More menu: insert block equation', type: 'string', defaultVal: 'Block equation' },
  { name: 'mathPlaceholder', desc: 'LaTeX textarea placeholder', type: 'string', defaultVal: 'E = mc^2' },
  { name: 'mathDone', desc: 'Confirm button', type: 'string', defaultVal: 'Done' },
  { name: 'mathCancel', desc: 'Cancel button', type: 'string', defaultVal: 'Cancel' },
];

export const PACKAGE_FEATURES = [
  { icon: '📝', title: 'Markdown in/out', body: 'Author and export as Markdown. getHTML() and getJSON() available too.' },
  { icon: '🎨', title: 'Opinionated UI', body: 'Toolbar, color palette, code blocks, TOC — styled out of the box, zero Ant Design.' },
  { icon: '👁', title: 'Editor + Preview + SSR', body: 'Client editor, live preview, and server-side renderReportHtml for SEO pages.' },
  { icon: '🔗', title: 'Stable TOC anchors', body: 'Shared slug logic between editor, preview, and published reader.' },
  { icon: '🎯', title: 'Themeable', body: 'All colors and fonts exposed as --tmr-* CSS variables.' },
  { icon: '📎', title: 'Citation pills', body: 'Parse [^n] into mid-line circular markers; hosts supply sources + optional Popover.' },
  { icon: '∑', title: 'KaTeX equations', body: 'Toolbar insert for inline / block math. Markdown uses $$; single $ is always a dollar sign.' },
];

export const DEMO_MD = `# Meet the editor

This panel is **tiptap-markdown-react** running live. Everything is stored and exported as _Markdown_.

## Rich, but markdown-native

- Bullet, ordered, and task lists
- Inline \`code\`, [links](https://tiptap.dev), highlights and colors
- Tables, blockquotes, dividers

> Right-click inside a table to add or remove rows and columns.

Inline math: revenue is $$R = P \times Q$$. Block math:

$$
\sum_{i=1}^{n} x_i = X
$$

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

| Feature      | Editor | Reader |
| ------------ | :----: | :----: |
| Markdown I/O |   ✅   |   ✅   |
| SSR render   |   —    |   ✅   |
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

Insert from **More → Inline equation / Block equation**. Click a formula to edit LaTeX.

Revenue is $$R = P \\times Q$$. Dollar amounts stay text: Temu GMV is $24.4B, not a formula.

$$
\\sum_{i=1}^{n} x_i = X
$$

Typing \`$24.4B\` or even \`$24.4B$\` never becomes math. Importing markdown that already uses \`$$…$$\` still renders.
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

export const SAMPLE_TOC = [
  { id: 'intro', level: 1, text: 'Introduction', locked: false },
  { id: 'getting-started', level: 2, text: 'Getting Started', locked: false },
  { id: 'api-reference', level: 2, text: 'API Reference', locked: false },
  { id: 'advanced', level: 2, text: 'Advanced Usage', locked: true },
  { id: 'changelog', level: 2, text: 'Changelog', locked: false },
];
