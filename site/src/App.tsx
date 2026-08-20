import 'tiptap-markdown-react/style.css';
import {
  CommentAnchorDemo,
  CodeBlockDemo,
  CitationDemo,
  CitationSsrDemo,
  EditorDemo,
  EditorTocDemo,
  HeroDemo,
  MarkdownIngestDemo,
  MarkdownOutputDemo,
  MathDemo,
  MathSsrDemo,
  PreviewDemo,
  ReportContentDemo,
  ThemeDemo,
  TocDemo,
  ToolbarDemo,
} from './demos';
import {
  CITATION_API,
  CITATION_INTERACTIVE_API,
  COMPONENT_NAV,
  DEMO_NAV,
  EDITOR_API,
  EDITOR_REF_API,
  INSERT_MARKDOWN_API,
  MATH_API,
  MATH_LABELS_API,
  PACKAGE_FEATURES,
  PREVIEW_API,
  RENDER_HTML_API,
  REPORT_CONTENT_API,
  SCROLL_TO_TOC_HEADING_API,
  THEME_VARS,
  TOC_API,
  TOC_UTIL_API,
  TOOLBAR_API,
} from './site-data';
import {
  ApiTable,
  ComponentSection,
  CopyRow,
  DemoBlock,
  DocsShell,
  PageToc,
  Reveal,
  SideNav,
  SiteFooter,
  Snippet,
  TopNav,
  useHashPage,
} from './ui';

const COLOR_PALETTE_API = [
  { name: 'value', desc: 'Currently applied color (shows checkmark)', type: 'string', defaultVal: '—' },
  { name: 'onPick', desc: 'Called when a swatch is clicked; null clears', type: '(color: string | null) => void' },
  { name: 'labels', desc: 'Label overrides', type: 'Partial<ColorPaletteLabels>', defaultVal: '—' },
];

const COMMENT_ANCHOR_API = [
  { name: 'comments', desc: 'Decoded comment anchors (segments). Mapped onto text ranges as edit-session marks', type: 'CommentRef[]', defaultVal: '—' },
  { name: 'activeCommentId', desc: 'Controlled active comment id (mark/block emphasis)', type: 'string | null', defaultVal: 'null' },
  { name: 'onCommentClick', desc: 'Clicked a mark or gutter — commentIds + anchorEl (anchorEl null for gutter)', type: '(payload: CommentClickPayload) => void', defaultVal: '—' },
  { name: 'onActiveCommentChange', desc: 'Active id changed from inside the editor', type: '(id: string | null) => void', defaultVal: '—' },
  { name: 'showCommentGutter', desc: 'Render block-left gutter bubbles', type: 'boolean', defaultVal: 'true' },
  { name: 'commentInteractive', desc: 'Editor-side mark clicks are inert (one-way sidebar-driven hosts pass false)', type: 'boolean', defaultVal: 'true' },
];

const COMMENT_REF_API = [
  { name: 'focusComment', desc: 'Set active, scroll to first mark, place cursor at range start', type: '(id: string) => boolean', defaultVal: '—' },
  { name: 'nextComment', desc: 'Jump to next/prev comment in document order', type: "(dir?: 'next' | 'prev') => string | null", defaultVal: '—' },
  { name: 'getCommentIds', desc: 'Deduplicated comment ids in document order', type: '() => string[]', defaultVal: '—' },
];

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="badges">
          <span className="badge">
            npm <b>v0.8.0</b>
          </span>
          <span className="badge">Tiptap v3</span>
          <span className="badge">MIT</span>
          <span className="badge">zero Ant Design</span>
        </div>
        <h1>
          Markdown editing, <span className="accent">done beautifully</span>
        </h1>
        <p className="lede">
          A batteries-included WYSIWYG editor and reader on Tiptap&nbsp;v3.
          Markdown in/out, styled toolbar, table of contents, live preview,
          and server-side rendering — themeable and Ant&nbsp;Design-free.
        </p>
        <div className="heroActions">
          <CopyRow text="npm install tiptap-markdown-react" />
          <a className="ghost" href="#/components">
            Browse components →
          </a>
        </div>
      </section>

      <section className="homeSection">
        <Reveal>
          <div className="sectionHead">
            <p className="kicker">Live</p>
            <h2>Try it right here</h2>
            <p className="sectionLede">
              The panel below is the real package. Edit, switch to rendered
              reader, or peek at Markdown output.
            </p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <HeroDemo />
        </Reveal>
      </section>

      <section className="homeSection">
        <Reveal>
          <div className="sectionHead">
            <p className="kicker">Why</p>
            <h2>Everything the editor needs, styled</h2>
          </div>
        </Reveal>
        <div className="features">
          {PACKAGE_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 50}>
              <div className="feature">
                <span className="featureIcon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="homeSection">
        <Reveal>
          <div className="sectionHead">
            <p className="kicker">Quick start</p>
            <h2>Three ways to render</h2>
          </div>
        </Reveal>
        <h3>1. Editor + toolbar</h3>
        <Snippet
          code={`import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { MarkdownWysiwygEditor, EditorToolbar } from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';

function Composer() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <div>
      {editor && <EditorToolbar editor={editor} onImageUpload={upload} />}
      <MarkdownWysiwygEditor initialMarkdown="# Hello" onEditorReady={setEditor} />
    </div>
  );
}`}
        />
        <h3>2. Client preview</h3>
        <Snippet
          code={`import { MarkdownPreview } from 'tiptap-markdown-react';
<MarkdownPreview
  markdown={markdown}
  sources={[{ index: '1', url: 'https://…', title: 'FY2025' }]}
/>`}
        />
        <h3>3. Server reader (SEO)</h3>
        <Snippet
          code={`import { renderReportHtml, ReportContent } from 'tiptap-markdown-react/server';

const { html, toc } = renderReportHtml(markdown);
return <ReportContent html={html} />;`}
        />
      </section>
    </>
  );
}

function ComponentsPage() {
  const tocItems = COMPONENT_NAV.flatMap((g) =>
    g.items.map((i) => ({ id: i.id, label: i.label })),
  );
  return (
    <DocsShell
      sidebar={<SideNav groups={COMPONENT_NAV} />}
      toc={<PageToc items={tocItems} />}
    >
      <div className="docsPageHead">
        <h1>Components</h1>
        <p>
          Batteries-included React components for editing, reading, and
          navigating Markdown content. Each ships with opinionated styles and
          Radix-based UI — no Ant Design.
        </p>
      </div>

      <ComponentSection
        id="editor"
        title="MarkdownWysiwygEditor"
        description="The core WYSIWYG editor. Markdown in, markdown out via ref methods. Emits TOC updates through onTocChange."
        importName="MarkdownWysiwygEditor"
        features={[
          'Full rich-text editing with Markdown serialization',
          'Ref API: getMarkdown(), getHTML(), getJSON(), getEditor()',
          'onTocChange for live table-of-contents sync',
          'extraExtensions hook for custom Tiptap nodes',
        ]}
        demo={
          <DemoBlock title="Basic editor" description="Toolbar optional — wire EditorToolbar separately.">
            <EditorDemo />
          </DemoBlock>
        }
        api={EDITOR_API}
        refApi={EDITOR_REF_API}
      />

      <ComponentSection
        id="toolbar"
        title="EditorToolbar"
        description="Styled formatting toolbar. Image upload button appears only when onImageUpload is provided."
        importName="EditorToolbar"
        features={[
          'Headings, lists, tables, links, colors, alignment',
          'More menu: code block, equations, table, import markdown',
          'Radix Popover / DropdownMenu — no native selects',
          'extraToolbarItems for custom More-menu entries',
          'Partial ToolbarLabels for i18n',
        ]}
        demo={
          <DemoBlock title="Toolbar with image upload">
            <ToolbarDemo />
          </DemoBlock>
        }
        api={TOOLBAR_API}
      />

      <ComponentSection
        id="equations"
        title="Equations"
        description="KaTeX inline and block math. Insert from the toolbar More menu; click a formula to edit LaTeX with live preview. Typing $ / $$ never converts — dollar amounts stay text. Markdown round-trip uses $$."
        importName="EditorToolbar, renderReportHtml"
        features={[
          'More → Inline equation / Block equation (no keyboard shortcut)',
          'Click formula → LaTeX popover with live KaTeX preview',
          'Inline $$x$$ vs block newline-wrapped $$; single $ is never math',
          'SSR renderReportHtml emits .katex HTML (no NodeView required)',
        ]}
        demo={
          <DemoBlock
            title="Insert and edit"
            description="Use More → Inline / Block equation. Click a rendered formula to change the LaTeX."
          >
            <MathDemo />
          </DemoBlock>
        }
        api={MATH_API}
        extra={
          <>
            <h4>ToolbarLabels</h4>
            <ApiTable rows={MATH_LABELS_API} />
            <Snippet
              code={`editor.commands.insertInlineMath({ latex: 'E = mc^2' })
editor.commands.insertBlockMath({ latex: '\\\\sum x' })

// markdown on disk
// inline: $$E = mc^2$$
// block:
// $$
// \\\\frac{a}{b}
// $$`}
            />
          </>
        }
      />

      <ComponentSection
        id="comment-anchors"
        title="Comment Anchors"
        description="Edit-session review annotations: map decoded comment segments onto text ranges as marks, render a block-left gutter, and report clicks. Read-only preview never renders comments; getMarkdown() strips all marks."
        importName="MarkdownWysiwygEditor (comments), CommentPopover"
        features={[
          'Segments → text-range marks (commentMapper + overlap merge)',
          'Overlapping comments merge into data-comment-ids',
          'Gutter bubbles + active mark/block emphasis (--tmr-* variables)',
          'focusComment / nextComment ref methods; paste/drop strips marks',
        ]}
        demo={
          <DemoBlock
            title="Edit-session review"
            description="Click a highlighted span (or gutter) to open CommentPopover; sidebar buttons focus via ref methods. MarkdownPreview ignores comments."
          >
            <CommentAnchorDemo />
          </DemoBlock>
        }
        api={COMMENT_ANCHOR_API}
        refApi={COMMENT_REF_API}
      />

      <ComponentSection
        id="preview"
        title="MarkdownPreview"
        description="Read-only client-side preview using the same extensions and styles as the editor."
        importName="MarkdownPreview"
        features={[
          'Same rendering pipeline as the editor',
          'Syntax highlighting via lowlight',
          'Stable heading anchors for deep links',
          'Citation pills via [^n] + optional sources',
        ]}
        demo={
          <DemoBlock title="Client preview">
            <PreviewDemo />
          </DemoBlock>
        }
        api={PREVIEW_API}
      />

      <ComponentSection
        id="citations"
        title="Citations [^n]"
        description="Inline circular citation pills aligned with body text (not super/subscript). Library renders the marker; hosts mount Popover via renderCitation NodeView slot."
        importName="createCitationRef, RenderCitation"
        features={[
          'Parses [^n] via CitationRef markdownTokenizer',
          'Mid-line accent-wash circular pills (CSS .citation-ref)',
          'renderCitation slot: wrap defaultDom with host Popover',
          'Data source lookup is 100% host-owned',
        ]}
        demo={
          <DemoBlock
            title="Citation pills + host Popover"
            description="Click a pill — Popover is Radix in this demo; invret can use antd the same way."
          >
            <CitationDemo />
          </DemoBlock>
        }
        api={CITATION_API}
        extra={
          <Snippet
            code={`// Editor / Preview (NodeView)
<MarkdownPreview renderCitation={({ index, defaultDom }) => (
  <Popover trigger="click" content={lookup(index)}>{defaultDom}</Popover>
)} />

// SSR reader — click only; host owns open state
const [active, setActive] = useState(null);
<ReportContentInteractive
  html={html}
  onCitationEnter={setActive}
  onCitationLeave={() => setActive(null)}
/>
{active && <Popover anchorEl={active.anchorEl}>{lookup(active.index)}</Popover>}`}
          />
        }
      />

      <ComponentSection
        id="report-content"
        title="ReportContent"
        description="RSC-safe static HTML reader. Pass html from renderReportHtml() — no client JavaScript required."
        importName="ReportContent"
        features={[
          'Pure HTML injection with editorContent styles',
          'Also exported from tiptap-markdown-react/server',
          'Ideal for published articles and SEO pages',
        ]}
        demo={
          <DemoBlock title="Static reader" description="Pre-rendered HTML sample — same output as renderReportHtml().">
            <ReportContentDemo />
          </DemoBlock>
        }
        api={REPORT_CONTENT_API}
      />

      <ComponentSection
        id="toc"
        title="TocPanel"
        description="Sidebar table of contents. Consumes TocItem[] from onTocChange or extractToc."
        importName="TocPanel"
        features={[
          'Active item highlighting via activeId',
          'Locked sections (e.g. paywalled content)',
          'Click handler with locked-item guard',
        ]}
        demo={
          <DemoBlock title="TOC panel">
            <TocDemo />
          </DemoBlock>
        }
        api={TOC_API}
      />

      <ComponentSection
        id="color-palette"
        title="ColorPalette"
        description="10×6 color matrix used inside EditorToolbar. Can be used standalone for custom color pickers."
        importName="ColorPalette"
        features={[
          'None row to clear color',
          'THEME brand swatches',
          'Accessible grid with checkmark on active color',
        ]}
        api={COLOR_PALETTE_API}
      />

      <ComponentSection
        id="render-html"
        title="renderReportHtml"
        description="Server-only function. Renders markdown to HTML + TOC without a browser or Tiptap Editor instance."
        importName="renderReportHtml"
        features={[
          'Pure function — runs in Server Components / ISR',
          'Stable slug anchors via makeTocGetId',
          'Returns { html, toc } for ReportContent + TocPanel',
        ]}
        extra={
          <Snippet
            code={`import { renderReportHtml } from 'tiptap-markdown-react/server';

const { html, toc } = renderReportHtml(markdown, {
  lockedTitles: ['Advanced Usage'],
  sources: [{ index: '1', url: 'https://…' }],
});`}
          />
        }
        api={RENDER_HTML_API}
      />
    </DocsShell>
  );
}

function DemosPage() {
  const tocItems = DEMO_NAV.flatMap((g) =>
    g.items.map((i) => ({ id: i.id, label: i.label })),
  );
  return (
    <DocsShell
      sidebar={<SideNav groups={DEMO_NAV} />}
      toc={<PageToc items={tocItems} />}
    >
      <div className="docsPageHead">
        <h1>Demo</h1>
        <p>
          Interactive examples grouped by scenario. Each block is a live preview
          you can edit and inspect.
        </p>
      </div>

      <h2 className="demoGroupTitle">Editing</h2>

      <DemoBlock
        anchor="demo-editor"
        title="WYSIWYG Editor"
        description="Full editor with toolbar. Content exports as Markdown."
      >
        <EditorDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          <code>initialMarkdown</code> seeds content; <code>onEditorReady</code>{' '}
          provides the Tiptap Editor for toolbar wiring.
        </p>
      </div>

      <DemoBlock
        anchor="demo-markdown-in"
        title="Paste / Drop / Import Markdown"
        description="Three built-in ways to get markdown into the editor — paste detection, .md file drop, and a toolbar file picker."
      >
        <MarkdownIngestDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Paste detection and file drop are on by default — opt out with{' '}
          <code>markdownPaste={'{false}'}</code> /{' '}
          <code>markdownFileDrop={'{false}'}</code>. Detection looks only at the
          plain-text content, so copying markdown source from any app (Xcode,
          VS Code, notes) converts, while real rich text (Word / web pages)
          pastes normally. The toolbar item is localized via{' '}
          <code>labels.importMarkdown</code>.
        </p>
      </div>

      <DemoBlock
        anchor="demo-toolbar"
        title="Toolbar + Image Upload"
        description="onImageUpload converts files to data URLs in this demo (no backend)."
      >
        <ToolbarDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          <code>onImageUpload</code> is required for the image button to appear.
          Return a URL string (or data URL) to insert the image node.
        </p>
      </div>

      <DemoBlock
        anchor="demo-codeblock"
        title="Code Block"
        description="Radix language dropdown — arrow keys work around the block. Backspace twice to delete."
      >
        <CodeBlockDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Customize labels via <code>codeBlockLabels</code> on{' '}
          <code>MarkdownWysiwygEditor</code>.
        </p>
      </div>

      <DemoBlock
        anchor="demo-equations"
        title="Equations"
        description="More menu inserts inline / block math. Click a formula to edit at the caret. $24.4B stays text."
      >
        <MathDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          No extra editor props. Localize via <code>labels.inlineMath</code> /{' '}
          <code>labels.blockMath</code> / <code>labels.mathNewInline</code> /{' '}
          <code>labels.mathPlaceholder</code>.
          Commands: <code>insertInlineMath</code> / <code>insertBlockMath</code>.
        </p>
      </div>

      <h2 className="demoGroupTitle">Reading</h2>

      <DemoBlock
        anchor="demo-preview"
        title="Client Preview"
        description="MarkdownPreview renders the same markdown as the editor."
      >
        <PreviewDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Pass any markdown string to <code>markdown</code>. Styles come from{' '}
          <code>tiptap-markdown-react/style.css</code>.
        </p>
      </div>

      <DemoBlock
        anchor="demo-equations-ssr"
        title="SSR equations"
        description="renderReportHtml emits KaTeX HTML so reading pages work without the editor NodeView."
      >
        <MathSsrDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Same markdown as the editor demo. Hosts already importing{' '}
          <code>tiptap-markdown-react/style.css</code> get KaTeX fonts/styles.
        </p>
      </div>

      <DemoBlock
        anchor="demo-citations"
        title="Citation pills"
        description="[^n] becomes a mid-line circular number. Host mounts Popover via renderCitation NodeView slot — library never owns your source schema."
      >
        <CitationDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Pass <code>renderCitation={'{({ index, defaultDom }) => …}'}</code> to
          wrap each pill. Look up your own data by <code>index</code>. Optional{' '}
          <code>sources</code> only attaches url/title onto nodes.
        </p>
      </div>

      <DemoBlock
        anchor="demo-citations-ssr"
        title="SSR reader + citations"
        description="renderReportHtml produces static pills; click a pill — CitationInteractive emits enter/leave, host owns the Popover. Inner <a> does not navigate (pointer-events:none); use the panel link."
      >
        <CitationSsrDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Use <code>ReportContentInteractive</code> or compose{' '}
          <code>ReportContent</code> + <code>CitationInteractive</code>. Click only:{' '}
          <code>onCitationEnter(ctx)</code> / <code>onCitationLeave()</code>. Render
          your Popover outside the content tree.
        </p>
      </div>

      <DemoBlock
        anchor="demo-markdown-out"
        title="Markdown Output"
        description="Edit on the left — live Markdown export on the right."
      >
        <MarkdownOutputDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Call <code>ref.getMarkdown()</code> or subscribe to editor{' '}
          <code>update</code> events.
        </p>
      </div>

      <h2 className="demoGroupTitle">Navigation</h2>

      <DemoBlock
        anchor="demo-toc"
        title="Table of Contents"
        description="Editor headings sync to TocPanel via onTocChange."
      >
        <EditorTocDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          <code>TocPanel</code> takes <code>items</code>, <code>activeId</code>,{' '}
          and <code>onItemClick</code>. Locked items are not clickable.
        </p>
      </div>

      <h2 className="demoGroupTitle">Theming</h2>

      <DemoBlock
        anchor="demo-theme"
        title="CSS Variables"
        description="Override --tmr-accent and other tokens without forking."
        controls={
          <p className="demoControlHint">
            Use the color picker above the editor to change accent live.
          </p>
        }
      >
        <ThemeDemo />
      </DemoBlock>
      <div className="propsNote">
        <h4>Props 说明</h4>
        <p>
          Set CSS variables on a wrapper element. See the API page for the full
          --tmr-* list.
        </p>
      </div>
    </DocsShell>
  );
}

function ApiPage() {
  const tocItems = [
    { id: 'api-client', label: 'Client exports' },
    { id: 'api-server', label: 'Server exports' },
    { id: 'api-theme', label: 'CSS variables' },
  ];
  return (
    <DocsShell toc={<PageToc items={tocItems} />}>
      <div className="docsPageHead">
        <h1>API</h1>
        <p>Complete reference for props, ref methods, utility functions, and theming tokens.</p>
      </div>

      <section id="api-client" className="apiSection">
        <h2>tiptap-markdown-react</h2>
        <h3>MarkdownWysiwygEditor</h3>
        <ApiTable rows={EDITOR_API} />
        <p className="componentDesc">
          Markdown ingestion is built in: <code>markdownPaste</code> converts
          pasted markdown text (heuristic on the plain-text content;
          Shift+paste and code blocks are left untouched),{' '}
          <code>markdownFileDrop</code> accepts <code>.md</code> /{' '}
          <code>.markdown</code> files via drag-drop or file paste, and{' '}
          <code>EditorToolbar</code> ships an <em>Import Markdown</em> entry in
          its More menu (<code>labels.importMarkdown</code>). The underlying
          extensions <code>MarkdownPaste</code> / <code>MarkdownFileDrop</code>{' '}
          are exported for custom pipelines.
        </p>
        <h4>Ref methods</h4>
        <ApiTable rows={EDITOR_REF_API} />

        <h3>EditorToolbar</h3>
        <ApiTable rows={TOOLBAR_API} />
        <p className="componentDesc">
          More menu includes <em>Inline equation</em> / <em>Block equation</em>.
          Click a rendered formula to edit LaTeX. Labels:{' '}
          <code>inlineMath</code>, <code>blockMath</code>,{' '}
          <code>mathPlaceholder</code>, <code>mathDone</code>,{' '}
          <code>mathNewInline</code>, <code>mathNewBlock</code>.
        </p>
        <ApiTable rows={MATH_LABELS_API} />

        <h3>Equations</h3>
        <p className="componentDesc">
          Math lives in <code>baseExtensions</code> (editor, preview, and SSR).
          Markdown uses <code>$$</code> only; a single <code>$</code> is always
          a dollar sign. There is no typing shortcut.
        </p>
        <ApiTable rows={MATH_API} />

        <h3>MarkdownPreview</h3>
        <ApiTable rows={PREVIEW_API} />

        <h3>Citations</h3>
        <p className="componentDesc">
          <code>[^n]</code> is parsed into a mid-line circular pill. Mount host UI
          with <code>renderCitation</code> on the editor/preview (NodeView), or{' '}
          <code>onCitationEnter</code> / <code>onCitationLeave</code> on SSR HTML
          via <code>CitationInteractive</code>. Same <code>index</code> lookup;
          reader open state is host-owned. The library does not define your source
          schema.
        </p>
        <ApiTable rows={CITATION_API} />
        <h4>CitationInteractive</h4>
        <ApiTable rows={CITATION_INTERACTIVE_API} />

        <h3>TocPanel</h3>
        <ApiTable rows={TOC_API} />

        <h3>ReportContent</h3>
        <ApiTable rows={REPORT_CONTENT_API} />

        <h3>ColorPalette</h3>
        <ApiTable rows={COLOR_PALETTE_API} />

        <h3>Utilities</h3>
        <p className="componentDesc">
          Tool functions you can import directly from <code>tiptap-markdown-react</code>.
          Use them for custom scroll behavior, programmatic markdown insertion, and TOC anchor
          generation.
        </p>

        <h4>scrollToTocHeading</h4>
        <p className="componentDesc">
          Smooth-scroll to a heading identified by its <code>data-toc-id</code> attribute.
          Uses <code>requestAnimationFrame</code> + easeOutCubic instead of browser{' '}
          <code>scrollIntoView()</code>, which silently fails inside flex + overflow nested
          containers in Chrome. Respects <code>prefers-reduced-motion: reduce</code>.
        </p>
        <ApiTable rows={SCROLL_TO_TOC_HEADING_API} />

        <h4>insertMarkdown</h4>
        <p className="componentDesc">
          Programmatically insert a markdown string at the cursor position. Optional{' '}
          <code>sources</code> enriches <code>[^n]</code> before insert. Equivalent to{' '}
          <code>editor.chain().focus().insertContent(md, {'{'}contentType:'markdown'{'}'}).run()</code>{' '}
          when sources are omitted.
        </p>
        <ApiTable rows={INSERT_MARKDOWN_API} />

        <h4>TOC / Markdown helpers</h4>
        <ApiTable rows={TOC_UTIL_API} />
      </section>

      <section id="api-server" className="apiSection">
        <h2>tiptap-markdown-react/server</h2>
        <h3>renderReportHtml(markdown, lockedTitlesOrOptions?)</h3>
        <ApiTable rows={RENDER_HTML_API} />
        <Snippet
          code={`import {
  renderReportHtml,
  ReportContent,
  extractToc,
  makeTocGetId,
  baseExtensions,
} from 'tiptap-markdown-react/server';

// legacy: second arg is lockedTitles[]
renderReportHtml(markdown, ['Advanced Usage']);

// with citations:
renderReportHtml(markdown, {
  lockedTitles: ['Advanced Usage'],
  sources: [{ index: '1', url: 'https://…' }],
});`}
        />
      </section>

      <section id="api-theme" className="apiSection">
        <h2>CSS variables (--tmr-*)</h2>
        <p className="componentDesc">
          Override on any ancestor of the editor or reader. Import{' '}
          <code>tiptap-markdown-react/style.css</code> first.
        </p>
        <ApiTable rows={THEME_VARS} />
      </section>
    </DocsShell>
  );
}

export function App() {
  const page = useHashPage();

  return (
    <>
      <div className="aurora" aria-hidden />
      <div className="auroraGrain" aria-hidden />
      <div className="site">
        <TopNav active={page} />
        <div className={page === 'home' ? 'page homePage' : 'page docsPage'}>
          {page === 'home' && <HomePage />}
          {page === 'components' && <ComponentsPage />}
          {page === 'demos' && <DemosPage />}
          {page === 'api' && <ApiPage />}
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
