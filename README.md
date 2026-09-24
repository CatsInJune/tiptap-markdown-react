# tiptap-markdown-react

A batteries-included, self-styled **Markdown WYSIWYG editor + reader** suite built on [Tiptap v3](https://tiptap.dev). Markdown in, markdown out — plus a table of contents, a client preview, and a server-side (RSC/SSR) renderer for SEO-friendly reading pages. No Ant Design, no icon library; themeable via CSS variables.

- **Markdown-first**: content goes in and comes out as markdown (`getMarkdown()`), with `getHTML()` / `getJSON()` also exposed.
- **Equations**: toolbar inserts inline / block math (KaTeX). Markdown round-trip uses `$$…$$` (inline) and newline-wrapped `$$` (block). Typing `$` / `$$` stays as text so dollar amounts are safe.
- **Charts**: agentic-ui-compatible data charts (`<!-- {"chartType":…} -->` + GFM table). Chart.js renders in editor / preview / reader (SSR placeholder → client hydrate). MVP: line, bar, column, pie, donut, area.
- **Own opinionated UI**: toolbar, color palette, code block, and table of contents ship styled out of the box. Zero `antd`. Dropdowns/popovers use [Radix](https://www.radix-ui.com/) primitives; icons are inline SVG.
- **Editor + Preview + Static reader**: edit, live client-side preview, and a pure `renderReportHtml()` for server rendering (Next.js Server Components / ISR). Reading pages that only hydrate footnotes should import `tiptap-markdown-react/reader` so they do not load `TableKit`.
- **Table of contents**: stable, shareable slug anchors that match between the editor preview and the published reading page.
- **Themeable**: colors and fonts are exposed as `--tmr-*` CSS variables.

## Install

```bash
npm install tiptap-markdown-react
# or
pnpm add tiptap-markdown-react
```

`react` and `react-dom` are peer dependencies (you likely already have them). **Tiptap and lowlight ship as transitive dependencies** — you do not need to install `@tiptap/*` separately.

Then import the stylesheet once (e.g. in your root layout / entry):

```ts
import 'tiptap-markdown-react/style.css';
```

### Migrating from 0.1.x

Remove all `@tiptap/*` and `lowlight` from your `package.json` if you added them only for this package. Upgrade to `^0.2.0` and import types from the package:

```ts
import type { Editor } from 'tiptap-markdown-react';
```

## Usage

### 1. Editor + toolbar

The editor and toolbar are separate components so you can place the toolbar wherever you like (sticky header, etc.). Wire them together via `onEditorReady`.

```tsx
'use client';
import { useState, useRef } from 'react';
import {
  MarkdownWysiwygEditor,
  EditorToolbar,
  type MarkdownWysiwygEditorHandle,
  type Editor,
} from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';

export function Composer() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const ref = useRef<MarkdownWysiwygEditorHandle>(null);

  return (
    <div>
      {editor && (
        <EditorToolbar
          editor={editor}
          onImageUpload={async (file) => {
            const url = await uploadToYourStorage(file); // return a public URL
            return url;
          }}
          onError={(err) => console.error(err)}
        />
      )}
      <MarkdownWysiwygEditor
        ref={ref}
        initialMarkdown={'# Hello\n\nStart writing…'}
        placeholder="Write something…"
        onEditorReady={setEditor}
      />
      <button onClick={() => console.log(ref.current?.getMarkdown())}>
        Save
      </button>
    </div>
  );
}
```

### 2. Client-side preview

```tsx
'use client';
import { MarkdownPreview } from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';

export function Preview({ markdown }: { markdown: string }) {
  return <MarkdownPreview markdown={markdown} />;
}
```

### Entries (do not mix `.` and `./server` in one client bundle)

| Import | Use on | Loads `TableKit` |
| --- | --- | --- |
| `tiptap-markdown-react` | Editor / toolbar / live preview | Yes |
| `tiptap-markdown-react/server` | Server Components / ISR `renderReportHtml` | Yes |
| `tiptap-markdown-react/reader` | Client reading pages (`ReportContentInteractive`) | No |

ProseMirror registers table cell selection once per JS realm. Importing **both** `.` and `./server` from a Client Component (or any shared client chunk) can throw `Duplicate use of selection JSON ID cell`. Reading pages should use `./reader` + server-rendered HTML.

### 3. Server-side / static reader (SEO)

Use the `./server` entry from a Server Component — it has no client code and no hard browser dependency. Render markdown to HTML at request/build time, then output it with `ReportContent` (which applies the same content styles as the editor).

```tsx
// app/p/[slug]/page.tsx  (React Server Component)
import { renderReportHtml, ReportContent } from 'tiptap-markdown-react/server';
import { TocPanel } from 'tiptap-markdown-react'; // client component, for the sidebar
import 'tiptap-markdown-react/style.css';

export default async function Page() {
  const markdown = await loadMarkdown();
  const { html, toc } = renderReportHtml(markdown);

  return (
    <article>
      {/* toc can be passed to a client <TocPanel toc={toc} /> */}
      <ReportContent html={html} />
    </article>
  );
}
```

Hydrate footnotes on the client **without** loading the editor / `TableKit`:

```tsx
'use client';
import {
  ReportContentInteractive,
  type CitationEnterContext,
} from 'tiptap-markdown-react/reader';
import 'tiptap-markdown-react/style.css';

export function ArticleBody({ html }: { html: string }) {
  return (
    <ReportContentInteractive
      html={html}
      onCitationEnter={(ctx: CitationEnterContext) => {
        /* host popover */
      }}
      onCitationLeave={() => {}}
    />
  );
}
```

Do not also import `tiptap-markdown-react` (the editor entry) from that same client module graph.

### 3b. Charts (comment + table)

Author / LLM form (matches agentic-ui / invret backend):

```markdown
<!-- {"chartType": "line", "x": "date", "y": "close", "title": "Price"} -->

| date | close |
|------|------|
| 2024-01-01 | 100 |
```

Supported MVP `chartType` values: `line`, `bar`, `column`, `pie`, `donut`, `area`.
Multiple configs in one comment (`[{...},{...}]`) render as tabs.
Unsupported types fall back to a normal table.

Reading page with hydrate:

```tsx
'use client';
import { ReportContentWithCharts } from 'tiptap-markdown-react/reader';
import 'tiptap-markdown-react/style.css';

export function ArticleBody({ html }: { html: string }) {
  return <ReportContentWithCharts html={html} />;
}
```

`renderReportHtml` emits a `div[data-type=chart]` placeholder (no Chart.js on the server).
Click a chart in the editor to edit JSON config + Markdown table source.

### 4. Comment anchoring (edit session only)

Review / annotation workflows: pass decoded comment segments to the editor; the
library maps them onto text ranges as `commentAnchor` marks, renders a block-left
gutter, and reports clicks back to you. **Marks are session-only** — `getMarkdown()`
strips them, undo history ignores them, and the read-only `MarkdownPreview` never
renders them.

```tsx
const comments: CommentRef[] = [
  {
    commentId: 'c1',
    author: 'agent',
    segments: [{ exact: '寒武纪成立于2016年' }],
    body: 'Add a source for this claim.',
  },
];

<MarkdownWysiwygEditor
  ref={ref}
  initialMarkdown={md}
  comments={comments}
  activeCommentId={activeId}
  onActiveCommentChange={setActiveId}
  onCommentClick={({ commentIds, anchorEl }) => openPopover(commentIds[0], anchorEl)}
/>
```

- **Ref methods**: `focusComment(id)` (active + scroll + cursor to range start),
  `nextComment('next' | 'prev')`, `getCommentIds()`.
- **Overlap**: multiple comments on the same text merge into one mark with
  `data-comment-ids="1 2"`; clicks report all ids.
- **Popover**: `CommentPopover` (Radix) anchors to the clicked mark; content is
  host-owned (`renderComment`-style children).
- **One-way hosts**: pass `commentInteractive={false}` and
  `showCommentGutter={false}` to make editor-side clicks inert — marks are
  invisible by default and only the **active** comment (driven by
  `focusComment(id)` from a sidebar) shows a yellow border + block outline.
- **Guards**: paste / drop strips marks via `transformPasted`; anchor application
  is excluded from undo history.
- **Segments**: `CommentSegment[]` (`{ blockHash?, prefix?, exact, suffix? }`).
  Capture them from a document with the same text model (see `commentMapper` /
  `blockTextHash`) so re-anchoring is exact.

### 5. Equations (KaTeX)

Insert from the toolbar **More** menu (`Inline equation` / `Block equation`). Click an existing formula to edit: the rendered KaTeX stays in the document (highlighted), and a pill input anchors **below** it. Typing updates that same formula in place — there is no second preview in the popover. Empty inserts still show a chip / hint bar. Inline confirms with Enter, block with ⌘/Ctrl+Enter. There is no typing shortcut and `$` / `$$` does **not** convert to math.

Markdown on disk:

- Inline: `$$E = mc^2$$`
- Block:

```md
$$
\frac{a}{b}
$$
```

Single `$` is always a dollar sign (`$24.4B`, `US$`, even `$24.4B$`). Importing markdown that already uses `$$` still renders as math. SSR (`renderReportHtml`) emits KaTeX HTML so reading pages work without the editor NodeView.

## Theming

Override any of these CSS variables on an ancestor (e.g. `:root` or the editor container):

| Variable | Default | Purpose |
| --- | --- | --- |
| `--tmr-accent` | `#ff6719` | Brand/accent color (links, active states, quotes) |
| `--tmr-text` | `#363737` | Body text color |
| `--tmr-muted` | `#777777` | Muted text (blockquote, h6) |
| `--tmr-border` | `#e6e6e6` | Borders (tables, hr) |
| `--tmr-body-font` | Spectral, serif… | Content font family |
| `--tmr-font-size` | `19px` | Base content font size |
| `--tmr-line-height` | `1.7` | Content line height |
| `--tmr-min-height` | `420px` | Editor min height |
| `--tmr-code-bg` | `#f4f4f4` | Inline code background |
| `--tmr-table-header-bg` | `#f7f7f7` | Table header background |
| `--tmr-comment-ring` | `rgba(219, 171, 10, 0.55)` | Active mark / block outline ring |
| `--tmr-comment-gutter-bg` | `#f4b400` | Gutter bubble background |
| `--tmr-popover-bg` | `#fff` | CommentPopover background |
| `--tmr-find-bg` | `rgba(255, 196, 0, 0.32)` | Find: match highlight |
| `--tmr-find-active-bg` | `rgba(255, 145, 0, 0.5)` | Find: current match highlight |
| `--tmr-find-active-ring` | `rgba(230, 122, 0, 0.7)` | Find: current match ring |

## API

### `<MarkdownWysiwygEditor>` (client)

| Prop | Type | Description |
| --- | --- | --- |
| `initialMarkdown` | `string` | Initial content (markdown). |
| `editable` | `boolean` | `false` renders read-only with the **same** extensions/NodeViews/styles — interactive controls (code-block language dropdown, delete) collapse. Comments are ignored when `false`. Default `true`. |
| `placeholder` | `string` | Placeholder for the empty document. |
| `onEditorReady` | `(editor: Editor \| null) => void` | Get the Tiptap instance (for the toolbar). |
| `onTocChange` | `(items: TocItem[]) => void` | Fires when headings change. |
| `markdownPaste` | `boolean` | Auto-detect markdown in plain-text paste and convert it (Shift+paste keeps plain text). Default `true`. Init-only. |
| `markdownFileDrop` | `boolean` | Drop or paste `.md` / `.markdown` files into the editor to insert their parsed content. Default `true`. Init-only. |
| `extraExtensions` | `AnyExtension[]` | Extra Tiptap extensions to register. |
| `codeBlockLabels` | `Partial<CodeBlockLabels>` | Localize the code block UI. |
| `findReplace` | `boolean` | Enable find & replace (default `true`): registers the official `@tiptap/extension-find-and-replace` and renders the floating bar. |
| `findBar` | `boolean` | Render the floating bar inside the editor (default: same as `findReplace`). `false` hands **placement to the host** — the extension stays registered, the editor renders no bar, and you render `<FindReplaceBar editor={editor} />` wherever you want; `findShortcut` and `handle.openFind/closeFind` go quiet with it. |
| `findBarContainer` | `HTMLElement \| (() => HTMLElement \| null)` | Mount the editor's bar into a container you own (the `getPopupContainer` idea): the library keeps open state and the shortcut, only the mount point changes. Use it when an `overflow: hidden` ancestor would clip the bar, or to park it in your own header / sidebar. Positioning is then yours (no absolute positioning is added), and if the container sits outside your themed subtree, bring `--tmr-*` along. Falls back to the in-editor bar when it resolves to `null`. |
| `findBarOffset` | `{ top?, right?, bottom?, left? } \| number = px` | Where the library-rendered bar sits inside its positioning context. Default `{ top: 4, right: 4 }` (top-right); pass e.g. `{ bottom: 8, left: 8 }` to dock it elsewhere. The context is the editor, or your `findBarContainer` element when you supply one — the library adds `position: relative` to that container if it is `static` (otherwise the bar would anchor to some unexpected ancestor). |
| `findShortcut` | `boolean` | Take over <kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> while the editor has focus (default `true`; bound only when the editor owns a bar). `false` keeps the browser's native find — wire your own entry with `handle.openFind()`. |
| `findLabels` | `Partial<FindLabels>` | Localize the find & replace bar. |
| `className` | `string` | Class on the scroll container. |

Ref handle (`MarkdownWysiwygEditorHandle`): `getMarkdown()`, `getHTML()`, `getJSON()`, `getEditor()`,
`focusComment(id)`, `nextComment(dir?)`, `getCommentIds()`, `openFind()`, `closeFind()`.

#### Find & replace

<kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> (while focus is inside the editor) opens a floating bar: match counter inside the search field, wrap-around next/previous, match-case and whole-word toggles, replace and replace-all. `Esc` closes it, clears the highlights and returns focus to the editor. Read-only editors (`editable={false}`) can search but not replace.

Matching is done by the official extension, so the semantics are its semantics — worth knowing before you rely on them:

- **Scope is textblocks**: paragraphs, headings, list items, table cells and code blocks. Text stored in node attributes is **not** searched — equations (LaTeX), chart data, image alt text and citation titles are invisible to find.
- **Matches may span marks inside one block** (`**bold** tail` is found by `bold tail`) but never cross blocks. What you search is rendered text, not markdown source: `**bold**` does not match.
- **Replacement takes the marks at the match start**: replacing `bold tail` in `**bold** tail` yields `**X**` — the trailing plain run's formatting is gone.
- **Replace-all is a single transaction**, so one undo restores everything.
- **Regex is RE2-compatible** (via `re2js`): no lookarounds or backreferences, replacement text is literal (`$1` is not expanded), and an invalid pattern yields zero matches instead of throwing — the bar shows "Invalid pattern" for that case. The bar ships no regex toggle (find/replace as a plain-text tool); turn it on from your own UI or headlessly with `editor.commands.setUseRegex(true)`.

Everything is also callable headlessly — the extension's commands and storage are the API, so AI/agent flows can drive it without the bar:

```ts
editor.commands.setSearchTerm('营收');
editor.commands.setReplaceTerm('收入');
editor.commands.replaceAll();          // one transaction, one undo
editor.storage.findAndReplace.results; // [{ from, to }, …]
```

##### Placing the bar yourself

Same split as the toolbar: the bar is a component, its placement is yours. Set `findBar={false}` and render `<FindReplaceBar>` anywhere — a header row, a side panel, a modal. The extension stays registered, so its commands and `editor.storage.findAndReplace` keep working, and the bar is self-contained (it pushes the query, clears highlights on unmount, and reads the counter from the plugin state):

```tsx
<MarkdownWysiwygEditor findBar={false} onEditorReady={setEditor} />

{editor && open && (
  <div className="my-find-panel">
    <FindReplaceBar editor={editor} onClose={() => setOpen(false)} labels={zhFind} />
  </div>
)}
```

Middle ground — keep the library's bar and shortcut, choose only the mount point:

```tsx
<div ref={setHost} className="my-find-slot" />
<MarkdownWysiwygEditor
  findBarContainer={() => host}
  findBarOffset={{ bottom: 8, left: 8 }}   // 默认 { top: 4, right: 4 }
  onEditorReady={setEditor}
/>
```

<kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> still opens it, `handle.openFind()` still works, and the bar now lives inside `my-find-slot`, placed at `findBarOffset` inside it. Reach for plain CSS only if you want more than an inset (the bar keeps the class the editor gives it). A function is the safer form: it re-resolves on every render, so a container that mounts later is picked up. Resolving to `null` falls back to the in-editor bar.

With `findBar={false}` the editor does not bind <kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> (it would swallow the browser's find without opening anything), so bind your own shortcut to `setOpen`. Two invariants to keep: leave `findReplace` on — the bar needs the extension's commands — and render it inside the same editor instance it drives.

`FindReplaceBar` is exported if you'd rather place the bar yourself, `FindLabels` / `defaultFindLabels` for i18n, and `FindAndReplace` for hand-built pipelines. Two details to reuse when driving it yourself: keep `searchDebounceMs: 0` on the extension and debounce in your own UI, and route calls through `runFindCommand()` — it absorbs a Tiptap 3.31.3 transaction mismatch that fires on the first search when the document ends with a code block / table / chart (see the comment on `runFindCommand` for the mechanism).

#### i18n (labels)

There is no global locale and no provider: every visible string comes from a `Partial<XLabels>` prop that is merged over built-in English defaults (`{ ...defaultToolbarLabels, ...labels }`). A host ships one object per language and passes it down; switching languages is picking a different object. Override only the keys you care about — everything else falls back to English.

| Component | Prop | Type |
| --- | --- | --- |
| `<EditorToolbar>` | `labels` | `Partial<ToolbarLabels>` (also covers the Import menu and the equation popover) |
| `<MarkdownWysiwygEditor>` | `findLabels` | `Partial<FindLabels>` |
| `<MarkdownWysiwygEditor>` | `codeBlockLabels` | `Partial<CodeBlockLabels>` |
| `<TocPanel>` | `labels` | `Partial<TocLabels>` |
| `<ColorPalette>` | `labels` | `Partial<ColorPaletteLabels>` |

```ts
// zh.ts — only the keys you want to change
export const zhToolbar: Partial<ToolbarLabels> = {
  undo: '撤销', bold: '加粗', headingLabel: (level) => `标题 ${level}`, importDocument: '导入',
};
export const zhFind: Partial<FindLabels> = { find: '查找', next: '下一处', replaceAll: '全部替换' };
```

Toolbar, TOC, palette and the find bar merge at render time, so they switch live. `codeBlockLabels` is different: it is written into the code-block extension's options when the editor is constructed (the NodeView reads `extension.options`), so existing code blocks keep the old text until the editor is rebuilt — remount with `key={locale}` and feed the current markdown back via `getMarkdown()` first, because `initialMarkdown` is init-only. Not yet injectable: **chart labels** (only reachable through `createChart({ chartLabels })` on a hand-built pipeline) and comment popover text (the popover renders your `children`). One `aria-label` is hardcoded English (`Code language` in the code-block header, screen readers only).

#### Markdown in: paste, drop, import

Three ways to get markdown into the editor, all built in:

- **Paste markdown text** — plain-text paste is heuristically detected (headings, lists, links, fences, tables…) and parsed into rich content. Rich-text (HTML) paste is untouched; Shift+paste always inserts plain text; pasting inside a code block is never converted. Opt out with `markdownPaste={false}`.
- **Drop / paste `.md` files** — drag a `.md` / `.markdown` file into the editor (inserted at drop point) or paste a copied file (inserted at cursor). Opt out with `markdownFileDrop={false}`.
- **Toolbar import** — the main-bar **Import** control is a Style/Size-like dropdown (`labels.importDocument` on the trigger, `labels.importDocumentHint` on hover). `.md` / `.markdown` is read in-package; any other file is handed to `onImportDocument`. Pass `importMenuItems` to split formats (Markdown / Word / PDF); otherwise the menu is Markdown-only, plus a Document item when `importAccept` is set. Without `onImportDocument` the picker stays `.md`-only.

The underlying extensions `MarkdownPaste` / `MarkdownFileDrop` (and the `looksLikeMarkdown` heuristic) are exported for custom pipelines.

### `<EditorToolbar>` (client)

| Prop | Type | Description |
| --- | --- | --- |
| `editor` | `Editor` | The instance from `onEditorReady`. |
| `onImageUpload` | `(file: File) => Promise<string>` | Upload handler returning a URL. Omit to hide the image button. |
| `onError` | `(err, source?: 'image' \| 'markdown' \| 'import') => void` | Side-effect error callback (e.g. failed upload). |
| `onImportDocument` | `(file, ctx) => Promise<ImportDocumentResult \| string>` | Converts a non-Markdown file to Markdown. `ctx.signal` aborts on cancel/unmount; `ctx.onProgress` reports upload/convert progress back. Omit and Import only takes `.md`. |
| `importAccept` | `string` | Extra `accept` used by the default Document menu item when `importMenuItems` is omitted. |
| `importMenuItems` | `ImportMenuItem[]` | Import dropdown options (`label` + `accept`). Hosts that want Markdown / Word / PDF pass three items. |
| `showImport` | `boolean` | Show the Import dropdown (default `true`). |
| `labels` | `Partial<ToolbarLabels>` | i18n labels. |
| `extraToolbarItems` | `ExtraToolbarItem[]` | Custom items appended to the "More" menu. |
| `labels.inlineMath` / `blockMath` | `string` | More-menu equation items. |
| `labels.mathPlaceholder` / `mathDone` / `mathNewInline` / `mathNewBlock` | `string` | Equation editor (empty chip/hint, input, Done). |

### `<MarkdownPreview>` (client)

| Prop | Type | Description |
| --- | --- | --- |
| `markdown` | `string` | Markdown to render read-only. |
| `className` | `string` | Class on the container. |

### `<TocPanel>` (client)

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `TocItem[]` | Table of contents items. |
| `activeId` | `string` | Currently highlighted anchor id. |
| `onItemClick` | `(item: TocItem) => void` | Click handler (locked items are skipped). |
| `labels` | `Partial<TocLabels>` | i18n labels. |

### `tiptap-markdown-react/server` (RSC-safe)

| Export | Description |
| --- | --- |
| `renderReportHtml(markdown, options?)` | `{ html, toc, ok }` — markdown → HTML。`includeToc` 默认 true；卡片预览传 false。`stabilize` 给流式半成品补未闭合围栏。解析失败 `ok: false`，不把已有 HTML 吞成空串。 |
| `stabilizeMarkdown(markdown)` | 给未闭合 ` ``` ` / `~~~` 补闭合。 |
| `ReportContent` | `<ReportContent html={...} />` static reader with editor content styles. |
| `extractToc`, `makeTocGetId` | TOC helpers. |
| `baseExtensions`, `pureCodeBlock`, `pureImage`, `lowlight` | Schema-level extensions. |

### `tiptap-markdown-react/reader` (client reading, no TableKit)

| Export | Description |
| --- | --- |
| `ReportContentInteractive` | `ReportContent` + citation click delegation. |
| `ReportContent`, `CitationInteractive` | Compose your own wrapper. |
| `SourceRef`, citation DOM/types | Footnote helpers. |
| `scrollToTocHeading` | Scroll the reading container to a heading. |

## License

MIT © CatsInJune
