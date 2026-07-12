// 引入 @tiptap/markdown 的类型增强，使 editor 上出现 getMarkdown()
import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';
import {
  EditorToolbar,
  MarkdownPreview,
  MarkdownWysiwygEditor,
} from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';

const DEMO_MD = `# Meet the editor

This whole panel is **tiptap-markdown-react** running live. Type here — everything
is stored and exported as _Markdown_.

## Rich, but markdown-native

- Bullet lists, ordered lists, and task lists
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

/** 演示用图片上传：直接把文件读成 data URL，无需后端。 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CopyRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copyRow">
      <code>{text}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Snippet({ code }: { code: string }) {
  return (
    <pre className="snippet">
      <code>{code}</code>
    </pre>
  );
}

function Demo() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [markdown, setMarkdown] = useState(DEMO_MD);
  const [tab, setTab] = useState<'editor' | 'markdown' | 'reader'>('editor');

  // 订阅编辑器更新，实时把 markdown 同步到 output / reader 面板
  useEffect(() => {
    if (!editor) return;
    const sync = () => setMarkdown(editor.getMarkdown());
    editor.on('update', sync);
    sync();
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);

  const onImageUpload = useCallback((file: File) => fileToDataUrl(file), []);

  return (
    <div className="demo">
      <div className="demoTabs">
        <button
          className={tab === 'editor' ? 'active' : ''}
          onClick={() => setTab('editor')}
        >
          Editor
        </button>
        <button
          className={tab === 'reader' ? 'active' : ''}
          onClick={() => setTab('reader')}
        >
          Rendered
        </button>
        <button
          className={tab === 'markdown' ? 'active' : ''}
          onClick={() => setTab('markdown')}
        >
          Markdown output
        </button>
      </div>

      {/* 编辑器常驻挂载（切 tab 只是隐藏），避免重挂丢失状态 */}
      <div style={{ display: tab === 'editor' ? 'block' : 'none' }}>
        {editor && (
          <EditorToolbar editor={editor} onImageUpload={onImageUpload} />
        )}
        <div className="demoBody">
          <MarkdownWysiwygEditor
            initialMarkdown={DEMO_MD}
            placeholder="Write something…"
            onEditorReady={setEditor}
          />
        </div>
      </div>

      {tab === 'reader' && (
        <div className="demoBody">
          <MarkdownPreview markdown={markdown} />
        </div>
      )}

      {tab === 'markdown' && (
        <pre className="demoBody markdownOut">
          <code>{markdown}</code>
        </pre>
      )}
    </div>
  );
}

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Markdown in, markdown out',
    body: 'Content is authored and exported as Markdown. getHTML() and getJSON() are there too when you need them.',
  },
  {
    title: 'Its own opinionated UI',
    body: 'Toolbar, color palette, code block, and table of contents ship styled. No Ant Design — Radix primitives + inline SVG icons.',
  },
  {
    title: 'Editor + Preview + SSR reader',
    body: 'Edit, live client preview, and a pure renderReportHtml() for Server Components / ISR reading pages.',
  },
  {
    title: 'Shareable TOC anchors',
    body: 'Stable slug anchors match between the editor preview and the published page, so deep links keep working.',
  },
  {
    title: 'Themeable',
    body: 'Colors and fonts are exposed as --tmr-* CSS variables. Restyle without forking.',
  },
  {
    title: 'RSC-safe server entry',
    body: 'tiptap-markdown-react/server has no client code and renders markdown to HTML at build/request time.',
  },
];

export function App() {
  return (
    <div className="page">
      <header className="nav">
        <span className="brand">tiptap-markdown-react</span>
        <nav>
          <a href="#demo">Demo</a>
          <a href="#usage">Usage</a>
          <a href="#api">API</a>
          <a
            href="https://github.com/CatsInJune/tiptap-markdown-react"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/tiptap-markdown-react"
            target="_blank"
            rel="noreferrer"
          >
            npm
          </a>
        </nav>
      </header>

      <section className="hero">
        <h1>
          A batteries-included Markdown
          <br />
          <span className="accent">WYSIWYG editor + reader</span>
        </h1>
        <p className="lede">
          Built on Tiptap v3. Markdown in/out, a styled toolbar, table of
          contents, a live preview, and a server-side renderer for SEO-friendly
          reading pages. Themeable, and completely Ant&nbsp;Design-free.
        </p>
        <div className="heroActions">
          <CopyRow text="npm install tiptap-markdown-react" />
          <a
            className="ghost"
            href="https://github.com/CatsInJune/tiptap-markdown-react"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub →
          </a>
        </div>
      </section>

      <section id="demo" className="section">
        <h2>Try it</h2>
        <p className="sectionLede">
          The panel below is the real package. Edit, switch to the rendered
          reader, or peek at the Markdown it produces.
        </p>
        <Demo />
      </section>

      <section className="section">
        <h2>Why</h2>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="usage" className="section">
        <h2>Usage</h2>

        <h3>1. Editor + toolbar</h3>
        <Snippet
          code={`import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  MarkdownWysiwygEditor,
  EditorToolbar,
} from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';

function Composer() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <div>
      {editor && (
        <EditorToolbar
          editor={editor}
          onImageUpload={async (file) => await uploadToStorage(file)}
        />
      )}
      <MarkdownWysiwygEditor
        initialMarkdown={'# Hello'}
        onEditorReady={setEditor}
      />
    </div>
  );
}`}
        />

        <h3>2. Client-side preview</h3>
        <Snippet
          code={`import { MarkdownPreview } from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';

<MarkdownPreview markdown={markdown} />;`}
        />

        <h3>3. Server-side reader (SEO)</h3>
        <Snippet
          code={`// app/p/[slug]/page.tsx — a Server Component
import { renderReportHtml, ReportContent } from 'tiptap-markdown-react/server';
import 'tiptap-markdown-react/style.css';

export default async function Page() {
  const { html, toc } = renderReportHtml(await loadMarkdown());
  return <ReportContent html={html} />;
}`}
        />
      </section>

      <section id="api" className="section">
        <h2>Exports</h2>
        <div className="apiGrid">
          <div>
            <h4>tiptap-markdown-react</h4>
            <ul>
              <li>
                <code>MarkdownWysiwygEditor</code> — the editor (ref:
                getMarkdown/getHTML/getJSON)
              </li>
              <li>
                <code>EditorToolbar</code> — styled toolbar, onImageUpload /
                extraToolbarItems
              </li>
              <li>
                <code>MarkdownPreview</code> — read-only client preview
              </li>
              <li>
                <code>TocPanel</code> — table of contents sidebar
              </li>
              <li>
                <code>ColorPalette</code>, icons, label defaults
              </li>
            </ul>
          </div>
          <div>
            <h4>tiptap-markdown-react/server</h4>
            <ul>
              <li>
                <code>renderReportHtml(md)</code> → {'{ html, toc }'}
              </li>
              <li>
                <code>ReportContent</code> — static reader (RSC-safe)
              </li>
              <li>
                <code>extractToc</code>, <code>makeTocGetId</code>
              </li>
              <li>
                <code>baseExtensions</code>, <code>lowlight</code>
              </li>
            </ul>
          </div>
          <div>
            <h4>Theming (--tmr-*)</h4>
            <ul>
              <li>
                <code>--tmr-accent</code>, <code>--tmr-text</code>,{' '}
                <code>--tmr-muted</code>
              </li>
              <li>
                <code>--tmr-border</code>, <code>--tmr-body-font</code>
              </li>
              <li>
                <code>--tmr-font-size</code>, <code>--tmr-line-height</code>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>MIT © CatsInJune</span>
        <a
          href="https://github.com/CatsInJune/tiptap-markdown-react"
          target="_blank"
          rel="noreferrer"
        >
          github.com/CatsInJune/tiptap-markdown-react
        </a>
      </footer>
    </div>
  );
}
