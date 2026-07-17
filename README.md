# tiptap-markdown-react

A batteries-included, self-styled **Markdown WYSIWYG editor + reader** suite built on [Tiptap v3](https://tiptap.dev). Markdown in, markdown out — plus a table of contents, a client preview, and a server-side (RSC/SSR) renderer for SEO-friendly reading pages. No Ant Design, no icon library; themeable via CSS variables.

- **Markdown-first**: content goes in and comes out as markdown (`getMarkdown()`), with `getHTML()` / `getJSON()` also exposed.
- **Own opinionated UI**: toolbar, color palette, code block, and table of contents ship styled out of the box. Zero `antd`. Dropdowns/popovers use [Radix](https://www.radix-ui.com/) primitives; icons are inline SVG.
- **Editor + Preview + Static reader**: edit, live client-side preview, and a pure `renderReportHtml()` for server rendering (Next.js Server Components / ISR).
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

## API

### `<MarkdownWysiwygEditor>` (client)

| Prop | Type | Description |
| --- | --- | --- |
| `initialMarkdown` | `string` | Initial content (markdown). |
| `placeholder` | `string` | Placeholder for the empty document. |
| `onEditorReady` | `(editor: Editor \| null) => void` | Get the Tiptap instance (for the toolbar). |
| `onTocChange` | `(items: TocItem[]) => void` | Fires when headings change. |
| `markdownPaste` | `boolean` | Auto-detect markdown in plain-text paste and convert it (Shift+paste keeps plain text). Default `true`. Init-only. |
| `markdownFileDrop` | `boolean` | Drop or paste `.md` / `.markdown` files into the editor to insert their parsed content. Default `true`. Init-only. |
| `extraExtensions` | `AnyExtension[]` | Extra Tiptap extensions to register. |
| `codeBlockLabels` | `Partial<CodeBlockLabels>` | Localize the code block UI. |
| `className` | `string` | Class on the scroll container. |

Ref handle (`MarkdownWysiwygEditorHandle`): `getMarkdown()`, `getHTML()`, `getJSON()`, `getEditor()`.

#### Markdown in: paste, drop, import

Three ways to get markdown into the editor, all built in:

- **Paste markdown text** — plain-text paste is heuristically detected (headings, lists, links, fences, tables…) and parsed into rich content. Rich-text (HTML) paste is untouched; Shift+paste always inserts plain text; pasting inside a code block is never converted. Opt out with `markdownPaste={false}`.
- **Drop / paste `.md` files** — drag a `.md` / `.markdown` file into the editor (inserted at drop point) or paste a copied file (inserted at cursor). Opt out with `markdownFileDrop={false}`.
- **Toolbar import** — "Import Markdown" in the toolbar's More menu opens a file picker and inserts the parsed file at the cursor (label: `labels.importMarkdown`).

The underlying extensions `MarkdownPaste` / `MarkdownFileDrop` (and the `looksLikeMarkdown` heuristic) are exported for custom pipelines.

### `<EditorToolbar>` (client)

| Prop | Type | Description |
| --- | --- | --- |
| `editor` | `Editor` | The instance from `onEditorReady`. |
| `onImageUpload` | `(file: File) => Promise<string>` | Upload handler returning a URL. Omit to hide the image button. |
| `onError` | `(err: unknown) => void` | Side-effect error callback (e.g. failed upload). |
| `labels` | `Partial<ToolbarLabels>` | i18n labels. |
| `extraToolbarItems` | `ExtraToolbarItem[]` | Custom items appended to the "More" menu. |

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
| `renderReportHtml(markdown, lockedTitles?)` | `{ html, toc }` — pure markdown → HTML + TOC. |
| `ReportContent` | `<ReportContent html={...} />` static reader with editor content styles. |
| `extractToc`, `makeTocGetId` | TOC helpers. |
| `baseExtensions`, `pureCodeBlock`, `pureImage`, `lowlight` | Schema-level extensions. |

## License

MIT © CatsInJune
