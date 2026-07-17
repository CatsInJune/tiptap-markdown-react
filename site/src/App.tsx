import 'tiptap-markdown-react/style.css';
import {
  CodeBlockDemo,
  EditorDemo,
  EditorTocDemo,
  HeroDemo,
  MarkdownIngestDemo,
  MarkdownOutputDemo,
  PreviewDemo,
  ReportContentDemo,
  ThemeDemo,
  TocDemo,
  ToolbarDemo,
} from './demos';
import {
  COMPONENT_NAV,
  DEMO_NAV,
  EDITOR_API,
  EDITOR_REF_API,
  PACKAGE_FEATURES,
  PREVIEW_API,
  RENDER_HTML_API,
  REPORT_CONTENT_API,
  THEME_VARS,
  TOC_API,
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

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="badges">
          <span className="badge">
            npm <b>v0.3.0</b>
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
<MarkdownPreview markdown={markdown} />`}
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
        id="preview"
        title="MarkdownPreview"
        description="Read-only client-side preview using the same extensions and styles as the editor."
        importName="MarkdownPreview"
        features={[
          'Same rendering pipeline as the editor',
          'Syntax highlighting via lowlight',
          'Stable heading anchors for deep links',
        ]}
        demo={
          <DemoBlock title="Client preview">
            <PreviewDemo />
          </DemoBlock>
        }
        api={PREVIEW_API}
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

const { html, toc } = renderReportHtml(markdown, ['Advanced Usage']);`}
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
        <p>Complete reference for props, ref methods, and theming tokens.</p>
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

        <h3>MarkdownPreview</h3>
        <ApiTable rows={PREVIEW_API} />

        <h3>TocPanel</h3>
        <ApiTable rows={TOC_API} />

        <h3>ReportContent</h3>
        <ApiTable rows={REPORT_CONTENT_API} />

        <h3>ColorPalette</h3>
        <ApiTable rows={COLOR_PALETTE_API} />
      </section>

      <section id="api-server" className="apiSection">
        <h2>tiptap-markdown-react/server</h2>
        <h3>renderReportHtml(markdown, lockedTitles?)</h3>
        <ApiTable rows={RENDER_HTML_API} />
        <Snippet
          code={`import {
  renderReportHtml,
  ReportContent,
  extractToc,
  makeTocGetId,
  baseExtensions,
} from 'tiptap-markdown-react/server';`}
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
