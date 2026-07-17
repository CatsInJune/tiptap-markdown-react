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
    ],
  },
  {
    title: 'Reading',
    items: [
      { id: 'preview', label: 'MarkdownPreview', href: '#preview' },
      { id: 'report-content', label: 'ReportContent', href: '#report-content' },
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
    ],
  },
  {
    title: 'Reading',
    items: [
      { id: 'demo-preview', label: 'Client Preview', href: '#demo-preview' },
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
  { name: 'returns.html', desc: 'Rendered HTML string', type: 'string' },
  { name: 'returns.toc', desc: 'Extracted table of contents', type: 'TocItem[]' },
];

export const THEME_VARS: ApiRow[] = [
  { name: '--tmr-accent', desc: 'Accent color (selection, links, TOC active)', type: 'color', defaultVal: '#ff6719' },
  { name: '--tmr-text', desc: 'Body text color', type: 'color', defaultVal: '#1b1b1b' },
  { name: '--tmr-muted', desc: 'Secondary text', type: 'color', defaultVal: '#6b6b6b' },
  { name: '--tmr-border', desc: 'Borders and dividers', type: 'color', defaultVal: '#eaeaea' },
  { name: '--tmr-body-font', desc: 'Body font family', type: 'font-family' },
  { name: '--tmr-font-size', desc: 'Base font size', type: 'length', defaultVal: '16px' },
  { name: '--tmr-line-height', desc: 'Body line height', type: 'number', defaultVal: '1.7' },
];

export const PACKAGE_FEATURES = [
  { icon: '📝', title: 'Markdown in/out', body: 'Author and export as Markdown. getHTML() and getJSON() available too.' },
  { icon: '🎨', title: 'Opinionated UI', body: 'Toolbar, color palette, code blocks, TOC — styled out of the box, zero Ant Design.' },
  { icon: '👁', title: 'Editor + Preview + SSR', body: 'Client editor, live preview, and server-side renderReportHtml for SEO pages.' },
  { icon: '🔗', title: 'Stable TOC anchors', body: 'Shared slug logic between editor, preview, and published reader.' },
  { icon: '🎯', title: 'Themeable', body: 'All colors and fonts exposed as --tmr-* CSS variables.' },
  { icon: '⚡', title: 'RSC-safe server entry', body: 'tiptap-markdown-react/server has no client code.' },
];

export const DEMO_MD = `# Meet the editor

This panel is **tiptap-markdown-react** running live. Everything is stored and exported as _Markdown_.

## Rich, but markdown-native

- Bullet, ordered, and task lists
- Inline \`code\`, [links](https://tiptap.dev), highlights and colors
- Tables, blockquotes, dividers

> Right-click inside a table to add or remove rows and columns.

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
`;

export const SAMPLE_TOC = [
  { id: 'intro', level: 1, text: 'Introduction', locked: false },
  { id: 'getting-started', level: 2, text: 'Getting Started', locked: false },
  { id: 'api-reference', level: 2, text: 'API Reference', locked: false },
  { id: 'advanced', level: 2, text: 'Advanced Usage', locked: true },
  { id: 'changelog', level: 2, text: 'Changelog', locked: false },
];
