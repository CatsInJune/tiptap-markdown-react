# tiptap-markdown-react

A batteries-included, self-styled **Markdown WYSIWYG editor + reader** suite built on [Tiptap v3](https://tiptap.dev). Markdown in, markdown out — plus a table of contents, a client preview, and a server-side (RSC/SSR) renderer for SEO-friendly reading pages. No UI framework dependency, no icon library; themeable via CSS variables.

**[Live demo →](https://catsinjune.github.io/tiptap-markdown-react/)** — the docs site with runnable editor demos (source in [`site/`](./site)). Auto-deployed from `main`.

- **Markdown-first**: content goes in and comes out as markdown (`getMarkdown()`), with `getHTML()` / `getJSON()` also exposed.
- **Equations**: toolbar inserts inline / block math (KaTeX). Markdown round-trip uses `$$…$$` (inline) and newline-wrapped `$$` (block). Typing `$` / `$$` stays as text so dollar amounts are safe.
- **Charts**: LLM-friendly data charts (`<!-- {"chartType":…} -->` + GFM table). Chart.js renders in editor / preview / reader (SSR placeholder → client hydrate). MVP: line, bar, column, pie, donut, area.
- **Own opinionated UI**: toolbar, color palette, code block, and table of contents ship styled out of the box. Dropdowns/popovers use [Radix](https://www.radix-ui.com/) primitives; icons are inline SVG.
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

That single import is all you need — it stays the same across versions. Since 0.17.0 the stylesheet no longer embeds the KaTeX math fonts as base64 (which made it ~940KB gzipped and render-blocking on every page). Instead `style.css` references `dist/fonts/*.woff2` via relative `url()`s, so:

- Bundlers (Next.js / Vite / webpack) resolve the font files automatically and emit them as static assets — no configuration needed.
- Browsers download a font file only when rendered glyphs actually use it. Pages without math formulas fetch zero font bytes; the blocking stylesheet itself is ~18KB gzipped.
- If you consume the CSS without a bundler (raw `<link>` to a single file), use the self-contained variant instead: `import 'tiptap-markdown-react/style-inline.css'` (~1.4MB, fonts embedded, otherwise identical).

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
        <EditorToolbar editor={editor} onError={(err) => console.error(err)} />
      )}
      <MarkdownWysiwygEditor
        ref={ref}
        initialMarkdown={'# Hello\n\nStart writing…'}
        placeholder="Write something…"
        // The toolbar's image button now inserts a drop/click upload block
        // (official ImageUploadNode interaction); it swaps itself for the
        // image when the upload finishes — see "Image upload" below.
        imageUpload={{
          upload: async (file, onProgress, signal) => {
            return uploadToYourStorage(file, onProgress, signal); // public URL
          },
          maxSize: 5 * 1024 * 1024,
        }}
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

Author / LLM form:

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
| `imageUpload` | `ImageUploadConfig` | Official `ImageUploadNode`-style upload (see [Image upload](#image-upload)). The toolbar's image button inserts a placeholder block you can drop a file on or click to pick; progress shows in place and the block is swapped for the image when every file finishes. `upload(file, onProgress?, signal?) => Promise<url>` is required; `accept` (`image/*`), `limit` (1), `maxSize` (0 = unlimited), `onError`, `onSuccess`, `labels` are optional. The block never reaches the saved markdown. Init-only. |
| `imageResize` | `boolean \| ImageResizeOptions` | Resizable images (default `true`, see [Image resize](#image-resize)). Drag a corner handle to resize; the size lands in the `width`/`height` node attributes and round-trips through markdown as `<img …>` (untouched images stay `![alt](url)`; `resetImageSize(editor)` clears a size). `false` disables; an object passes through to the official `resize` config (`directions`, `minWidth`, `minHeight`, `alwaysPreserveAspectRatio`). Init-only. |
| `extraExtensions` | `AnyExtension[]` | Extra Tiptap extensions to register. |
| `codeBlockLabels` | `Partial<CodeBlockLabels>` | Localize the code block UI. |
| `findReplace` | `boolean` | Enable find & replace (default `true`): registers the official `@tiptap/extension-find-and-replace` and renders the floating bar. |
| `findBar` | `boolean` | Render the floating bar inside the editor (default: same as `findReplace`). `false` hands **placement to the host** — the extension stays registered, the editor renders no bar, and you render `<FindReplaceBar editor={editor} />` wherever you want; `findShortcut` and `handle.openFind/closeFind` go quiet with it. |
| `findBarContainer` | `HTMLElement \| (() => HTMLElement \| null)` | Mount the editor's bar into a container you own (the popup-container pattern): the library keeps open state and the shortcut, only the mount point changes. Use it when an `overflow: hidden` ancestor would clip the bar, or to park it in your own header / sidebar. Positioning is then yours (no absolute positioning is added), and if the container sits outside your themed subtree, bring `--tmr-*` along. Falls back to the in-editor bar when it resolves to `null`. |
| `findBarOffset` | `{ top?, right?, bottom?, left? } \| number = px` | Where the library-rendered bar sits inside its positioning context. Default `{ top: 4, right: 4 }` (top-right); pass e.g. `{ bottom: 8, left: 8 }` to dock it elsewhere. The context is the editor, or your `findBarContainer` element when you supply one — the library adds `position: relative` to that container if it is `static` (otherwise the bar would anchor to some unexpected ancestor). |
| `findShortcut` | `boolean` | Take over <kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> while the editor has focus (default `true`; bound only when the editor owns a bar). `false` keeps the browser's native find — wire your own entry with `handle.openFind()`. |
| `findLabels` | `Partial<FindLabels>` | Localize the find & replace bar. |
| `onFindOpenChange` | `(open: boolean) => void` | Fired when the bar actually shows or hides (Esc / × included). Use it to drive an external entry such as the toolbar magnifier. Fires only on a real change — never a `false` on mount — and stays `false` while `findBar={false}`, so a host-placed bar never lights up an entry you did not open. |
| `className` | `string` | Class on the scroll container. |

Ref handle (`MarkdownWysiwygEditorHandle`): `getMarkdown()`, `getHTML()`, `getJSON()`, `getEditor()`,
`focusComment(id)`, `nextComment(dir?)`, `getCommentIds()`, `openFind()`, `closeFind()`, `toggleFind()`.
`openFind()` keeps the same "press again" feel as <kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> — refocus the search field and
select the query — while `toggleFind()` flips the bar and pairs with an entry that shows an active state
(`onSearch={() => handle.current?.toggleFind()}`).

#### Find & replace

<kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> (while focus is inside the editor) opens a floating bar: match counter inside the search field, wrap-around next/previous, match-case and whole-word toggles, replace and replace-all. Read-only editors (`editable={false}`) can search but not replace. <kbd>Enter</kbd> in the search field jumps to the next match — but an <kbd>Enter</kbd> that is committing an IME candidate (Chinese/Japanese input) is left alone, so confirming a word never jumps or replaces.

**Closing it.** `Esc` closes the bar, clears the highlights and returns focus to the editor; it works from anywhere that belongs to the editor (focus inside the bar, inside the document, or on the page while this is the only editor), and the keystroke is consumed so a host popover or drawer wrapping the bar does not close along with it. Other ways out: the bar's ×, `handle.closeFind()`, `toggleFind()`, and unmounting the bar. Deliberately **not** closing on: clicking into the document or another input, an empty query, zero results, after replace-all, or switching to read-only (search stays available then — only the replace row goes away). If an editor is swapped out (remounted for a new document), the library reports `onFindOpenChange(false)` so an entry elsewhere never stays lit.

`<EditorToolbar>` can carry an entry to the same bar. Pass `onSearch` (wired to the ref handle) and the magnifier appears just left of the More menu; omit it and the button does not render. Feed `searchActive` from `onFindOpenChange` and it lights up while the bar is open — pair it with `toggleFind()` so the lit button also turns the bar back off:

```tsx
const find = useRef<MarkdownWysiwygEditorHandle>(null)
const [findOpen, setFindOpen] = useState(false)

<EditorToolbar
  editor={editor}
  onSearch={() => find.current?.toggleFind()}
  searchActive={findOpen}
/>
<MarkdownWysiwygEditor ref={find} onFindOpenChange={setFindOpen} />
```

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

Styling the bar from the outside: its internals use hashed CSS-module classes, so the bar carries stable hooks instead — `[data-find-bar]` on the root, `[data-find-field="search|replace"]` on the inputs, `[data-find-counter]` on the counter, `[data-find-option="match-case|whole-words"]` on the toggles and `[data-find-action="previous|next|close|replace|replace-all"]` on the buttons. Colors stay on the theme variables (`--tmr-find-*` for the highlights, `--tmr-toolbar-*` / `--tmr-accent` for the bar chrome).

#### i18n (labels)

There is no global locale and no provider: every visible string comes from a `Partial<XLabels>` prop that is merged over built-in English defaults (`{ ...defaultToolbarLabels, ...labels }`). A host ships one object per language and passes it down; switching languages is picking a different object. Override only the keys you care about — everything else falls back to English.

| Component | Prop | Type |
| --- | --- | --- |
| `<EditorToolbar>` | `labels` | `Partial<ToolbarLabels>` (also covers the Import menu, the equation popover and the link popover) |
| `<MarkdownWysiwygEditor>` | `findLabels` | `Partial<FindLabels>` (replace / replace-all appear as icon buttons, so their labels are the tooltip + accessible name) |
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

#### Image upload

Configure `imageUpload` on the editor and the toolbar's image button stops opening the file picker directly. Instead it **inserts a placeholder block** in the document — the same interaction as the official `ImageUploadNode` UI component: drop a file on the block or click to pick one, the block lists each file with its size and a live progress bar, and once every queued file finishes it replaces itself with the matching image node(s) at the same position.

```tsx
<MarkdownWysiwygEditor
  imageUpload={{
    upload: async (file, onProgress, signal) => {
      return yourApi.upload(file, { onProgress, signal }); // public URL (or data URL)
    },
    accept: 'image/*',        // default
    limit: 3,                 // queue up to 3 per block; default 1
    maxSize: 5 * 1024 * 1024, // per-file cap in bytes; 0 = unlimited (default 0)
    onError: (err) => console.error(err),
  }}
/>
```

- **Markdown stays clean** — the block is an atom node whose `renderMarkdown` returns `''`, so an in-flight upload can never leak into `getMarkdown()` / autosave; images appear only after the swap. On success `alt` / `title` are set to the file name (extension stripped).
- **Errors** — over-size / over-limit / failed uploads call `onError(error)`; the failed row stays in the block. Remove it (or Clear all) and try again.
- **Abort** — the `upload` callback receives an `AbortSignal` that fires when a row is removed, the queue is cleared, the block is deleted, or the editor unmounts. Hand it to `fetch` so abandoned uploads stop.
- **Keyboard** — <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> inserts a block (on Windows that combo also opens DevTools — the browser wins, same as the official component); <kbd>Enter</kbd> on a selected block opens the picker.
- The block's text comes from the `imageUpload.labels` (`ImageUploadLabels`); the `ImageUploadNode` extension and `hasImageUpload(editor)` are exported for hand-built pipelines.
- The legacy toolbar prop `onImageUpload` still works when the extension is not registered — see the `<EditorToolbar>` table.

#### Paragraph styles: alignment, indent, line height

Three dropdowns sit next to the font-size control: **alignment** (left / center / right / justify — the free official `@tiptap/extension-text-align`), **indent** (increase / decrease, one 2em step per level, max 8) and **line height** (default / 1 / 1.15 / 1.5 / 2 / 2.5 / 3). They apply to paragraphs and headings; commands are `setTextAlign` (official) plus `setIndent` / `increaseIndent` / `decreaseIndent` / `setLineHeight` from the exported `ParagraphStyles` extension.

Markdown has no paragraph-style syntax, so a styled paragraph serializes to inline HTML — the same bus as resized images, with the same "only when used" rule:

```html
<p style="text-align: center; margin-left: 2em; line-height: 1.5">…</p>
<h2 style="text-align: right">…</h2>
```

Untouched paragraphs stay native markdown. The editor, preview and server renderer share one tokenizer (it only claims `<p>` / `<hN>` carrying styles this library knows), so styles round-trip everywhere — including SSR. On other renderers (GitHub etc.) the `style` is sanitized away while the text renders normally: a decoration is lost, not content.

#### Image resize

Images are resizable out of the box (the official `@tiptap/extension-image` `resize` capability): hover an image — the handles appear on hover only — and drag a side handle. The size is committed as integer-pixel node attributes (`width` / `height`) — not inline styles — so it survives save and reload.

CommonMark has no size syntax, so **a resized image serializes to inline HTML**: `<img src="…" alt="…" width="440" height="330">`, while untouched images keep the standard `![alt](url)` form. The editor, the preview and the server renderer all parse that tag back through one shared tokenizer (it claims `<img …>` before the `window.DOMParser` path can run), so sizes round-trip in every pipeline — including SSR, where raw inline HTML would otherwise be escaped to literal text. Dragging writes `width`/`height`; export `resetImageSize(editor)` clears them and returns the image to the clean `![alt](url)` syntax (wire it to your own button — the library renders no UI for it).

```tsx
<MarkdownWysiwygEditor
  imageResize={{ minWidth: 80, minHeight: 80 }} // default: true
/>
```

Defaults: two side handles (`left` / `right`, matching the official demo, shown on hover only), aspect ratio always locked (`alwaysPreserveAspectRatio: true`), a **minimum of 80×80 px**, and a **maximum that follows the editor's content width** — images cannot be dragged past the layout; the bound is re-measured before every drag, so window resizes are picked up. Pin your own bounds with `minWidth` / `minHeight` / `maxWidth` / `maxHeight` (the library injects the max into the official `ResizableNodeView`, which has no max option of its own). Locking keeps the committed size consistent with how read-only rendering scales the image (CSS `height: auto`), so non-uniformly stretched images cannot "snap back" in previews; pass `alwaysPreserveAspectRatio: false` to allow free stretching anyway. Read-only editors never show handles, and `imageResize={false}` disables the feature entirely.

#### Image alignment

Hover an image and a small toolbar appears above it — left / center / right, the same hover-handle interaction as the table row/column handles. Alignment is stored as the `align` node attribute and rendered as **`data-align`** — the attribute name the official `image-align-button` uses — so existing `img[data-align="center"]` styles keep working. Keyboard shortcuts match the official component: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> / <kbd>E</kbd> / <kbd>R</kbd> with an image selected (or the cursor right next to it).

Like size, alignment has no markdown syntax, so an aligned image serializes to `<img … data-align="center">` (untouched images stay `![alt](url)`) and the same tokenizer parses it back — editor, preview and server renderer all agree. For custom UIs the library exports `setImageAlign(editor, align)` / `isImageAlignActive(editor, align)` (selection-based) and `setImageAlignAt(editor, element, align)` (DOM-based); the hover toolbar's text comes from `labels.imageAlign*`.

#### Image caption

Hover an image, click the caption button in the hover toolbar and an input opens right there — <kbd>Enter</kbd> commits, <kbd>Esc</kbd> cancels, clicking away commits too. The caption renders under the image (small muted text, aligned with the image) and is stored as the `caption` node attribute.

In markdown a captioned image serializes to a `<figure>` block (standard HTML semantics — GitHub renders it the same way):

```html
<figure>
<img src="…" alt="…">
<figcaption>Figure 1: something</figcaption>
</figure>
```

Images without a caption keep the plain `![alt](url)` form. Editor, preview and server renderer share the same tokenizer, so captions round-trip everywhere — including SSR. Tooling for custom UIs: `setImageCaption(editor, text)` / `setImageCaptionAtPos(editor, pos, text)`; hover-toolbar labels via `labels.imageCaption` / `imageCaptionPlaceholder`. The official side has nothing for this (`@tiptap/extension-figure` does not exist on npm), so the whole path is native to this library.

### `<EditorToolbar>` (client)

The row stays centred and **scrolls horizontally** when the controls no longer fit — a single line, never wrapped (`justify-content: safe center` keeps both ends reachable once it overflows). The full set (search entry included) needs about 1045 px of container width; narrower containers scroll. `onSearch` renders the magnifier just left of the More menu.

| Prop | Type | Description |
| --- | --- | --- |
| `editor` | `Editor` | The instance from `onEditorReady`. |
| `onImageUpload` | `(file: File) => Promise<string>` | **Legacy** direct-upload path: picking a file inserts the returned URL. Ignored when the editor registers the `imageUpload` extension (configure that on `<MarkdownWysiwygEditor>` instead); omit both and no image button renders. |
| `onError` | `(err, source?: 'image' \| 'markdown' \| 'import') => void` | Side-effect error callback (e.g. failed upload). |
| `onImportDocument` | `(file, ctx) => Promise<ImportDocumentResult \| string>` | Converts a non-Markdown file to Markdown. `ctx.signal` aborts on cancel/unmount; `ctx.onProgress` reports upload/convert progress back. Omit and Import only takes `.md`. |
| `importAccept` | `string` | Extra `accept` used by the default Document menu item when `importMenuItems` is omitted. |
| `importMenuItems` | `ImportMenuItem[]` | Import dropdown options (`label` + `accept`). Hosts that want Markdown / Word / PDF pass three items. |
| `showImport` | `boolean` | Show the Import dropdown (default `true`). |
| `labels` | `Partial<ToolbarLabels>` | i18n labels. |
| `onSearch` | `() => void` | Search entry (magnifier) left of the More menu. Wire it to `handle.toggleFind()` (or `openFind()` if you'd rather it only ever open); omit it and no button renders. Worth passing only when the editor owns a bar (`findBar` on) — a host-placed bar has nothing for it to open. Search works read-only, so the button never greys out. |
| `searchActive` | `boolean` | Whether the bar is open; drives `aria-pressed` and the active highlight of the search entry (default `false`). Feed it from the editor's `onFindOpenChange`. |
| `extraToolbarItems` | `ExtraToolbarItem[]` | Custom items appended to the "More" menu. |
| `labels.inlineMath` / `blockMath` | `string` | More-menu equation items. |
| `labels.mathPlaceholder` / `mathDone` / `mathNewInline` / `mathNewBlock` | `string` | Equation editor (empty chip/hint, input, Done). |
| `labels.tableRowMenu` / `tableColumnMenu` | `string` | Aria-labels of the table hover handles. |
| `labels.linkPrompt` / `linkApply` / `linkOpen` / `linkRemove` / `linkInvalid` | `string` | Link popover: field placeholder, apply, open in new window, remove, rejected-address hint. |
| `labels.imageAlign` / `imageAlignLeft` / `imageAlignCenter` / `imageAlignRight` | `string` | Hover alignment toolbar (rendered by the toolbar, appears over the hovered image): toolbar aria-label and the three button labels. |

#### Table editing (hover handles)

Hover any cell and four affordances appear: a `⋮` handle on the row's left edge, a `⋯` handle above the table aligned to the column, a `+` pill on the table's right edge (**append a column**) and a `+` pill below it (**append a row**). They are all sized to what they act on: the row handle spans the row's height, the column handle spans the column's width, and each `+` spans the table's edge it sits on. Clicking a handle selects that whole row / column and opens its menu: add before / after, delete, **Clear content**, **Reset cell styles**, plus **Delete table**. The handles ship with `<EditorToolbar>` (they are its table UI), reuse the same commands as the insert-table grid, and do not appear on read-only editors.

Right-click is still wired for exactly one case: a **multi-cell selection** (drag across cells). A handle can only express one row or one column, so batch add/delete of a rectangle keeps the context menu.

**Clear content** empties the selected cells but keeps them (a header row therefore never degrades into a data row), and **Reset cell styles** puts `colwidth` / `align` back to their schema defaults while leaving `colspan` / `rowspan` alone — those are structural, and the extension's `mergeCells` / `splitCell` are deliberately **not** exposed here: GFM has no `colspan`, so a merged cell exports as `| 1<br>2 |  |` and cannot be restored on reload. Column width is a *column* property managed by the resize plugin, so clearing it needs the whole column selected (from the row handle it is restored from the widest cell in that column, which is the plugin's normal behavior).

Styling hooks (internals are hashed CSS-module classes): `[data-table-handle="row|col"]` on the handles, `[data-table-menu]` on the menu. Colors ride `--tmr-table-handle-bg` / `-fg` / `-border` (a light pill by default; hovering turns it into `--tmr-accent`).

**Not included: dragging a handle to reorder rows or columns.** That is precisely the part the official `table-node` component implements inside its own source — which is a **paid** Start-plan component (the registry answers 401 for `table-node`, `toc-node`, `drag-context-menu` while free ones answer 200), so it cannot be vendored into this MIT package. The free `@tiptap/extension-table` ships the add/delete/header/merge commands used here but no move commands; reordering would be our own transaction code on top of `TableMap`.

### `<LinkPopover>` (client)

The toolbar's link button opens this popover — type an address, apply it, open it in a new window, or remove the link. With the caret inside a link it prefills that link's href, so editing a URL no longer means deleting and re-adding it (the old `window.prompt` also could not be edited, gave no feedback for a rejected address, and is unavailable in Electron and some WebViews).

```tsx
<LinkPopover
  editor={editor}
  labels={{ field: 'Paste a link…' }}
  trigger={<button type="button" className="my-btn"><LinkIcon /></button>}
/>
```

| Prop | Type | Description |
| --- | --- | --- |
| `editor` | `Editor` | The editor to operate on. |
| `trigger` | `ReactNode` | Your own trigger element. Radix's `asChild` takes over its click / ref / aria, so it must be a DOM element or a `forwardRef` component (the toolbar passes its `ToolbarButton`). |
| `labels` | `Partial<LinkPopoverLabels>` | i18n labels (`defaultLinkPopoverLabels` is exported). |
| `className` / `style` | `string` / `CSSProperties` | Extra class / inline style on the panel; placement stays with Radix. |

Styling hooks (internals are hashed CSS-module classes): `[data-link-popover]` on the panel, `[data-link-field]` on the input, `[data-link-action="apply|open|remove"]` on the buttons, `[data-link-invalid]` on the input while the editor rejects the address. Colors come from the theme variables (`--tmr-accent`, `--tmr-toolbar-border`, `--tmr-toolbar-muted`, `--tmr-text`, `--tmr-danger`).

The logic follows the official link-popover component (MIT) — ported, not vendored, so no Tailwind, no primitive design system and no extra runtime deps. It also fixes two flaws in that reference implementation, both caught by tests here: a rejected address used to leave the document modified (the insert-after-a-failed-`setLink` chain), and editing a link whose caret sits inside it replaced the link's text with the URL. What it does:

- applies over `extendMarkRange('link')`, so changes hit the whole link;
- inserts the address as its own text when the selection is empty and there is no link;
- removes without letting the autolink plugin re-add the link (`preventAutolink`);
- normalises bare domains and `host:port` with the extension's `defaultProtocol` (typing `example.com` stores `http://example.com`, matching what Tiptap's autolink does on paste — otherwise markdown would export a relative link);
- opens through a protocol allowlist with `noopener,noreferrer`;
- keeps its Enter IME-safe (the official panel's handler would apply the link while you commit a Chinese/Japanese candidate).

The commands are exported for headless or self-drawn UIs: `applyLink`, `removeLink`, `canSetLink`, `isLinkActive`, `readLinkHref`, `normalizeLinkHref`, `sanitizeLinkUrl`, `openLinkUrl`.

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
| `extractFootnoteSources(markdown)` | `{ markdown, sources }` — 把 GFM 脚注定义行（`[^n]: …`）抽成 `SourceRef[]` 并从正文剥离；标记那一半交给 enrich / apply。 |
| `scrollToTocHeading` | Scroll the reading container to a heading. |

## License

MIT © CatsInJune

Third-party content used or adapted by this project — Lucide icons, Tiptap UI Components
(ported component logic and icons), KaTeX styles/fonts, and the npm dependency licenses —
is credited in [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
