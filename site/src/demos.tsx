import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  EditorToolbar,
  MarkdownPreview,
  MarkdownWysiwygEditor,
  ReportContent,
  TocPanel,
  type TocItem,
} from 'tiptap-markdown-react';
import {
  CODEBLOCK_MD,
  DEMO_MD,
  PREVIEW_MD,
  SAMPLE_TOC,
} from './site-data';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 完整编辑器 + 工具栏 */
export function EditorDemo({ initial = DEMO_MD }: { initial?: string }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const onImageUpload = useCallback((file: File) => fileToDataUrl(file), []);
  return (
    <div className="editorDemo">
      {editor && (
        <EditorToolbar editor={editor} onImageUpload={onImageUpload} />
      )}
      <div className="editorDemoBody">
        <MarkdownWysiwygEditor
          initialMarkdown={initial}
          placeholder="Write something…"
          onEditorReady={setEditor}
        />
      </div>
    </div>
  );
}

/** 仅编辑器，无工具栏 */
export function EditorOnlyDemo() {
  return (
    <div className="editorDemoBody compact">
      <MarkdownWysiwygEditor
        initialMarkdown="# Minimal editor\n\nNo toolbar — just the editor surface."
        placeholder="Type here…"
      />
    </div>
  );
}

/** 工具栏 + 编辑器，强调图片上传 */
export function ToolbarDemo() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const onImageUpload = useCallback((file: File) => fileToDataUrl(file), []);
  return (
    <div className="editorDemo">
      {editor && (
        <EditorToolbar
          editor={editor}
          onImageUpload={onImageUpload}
          labels={{ image: 'Upload image (data URL demo)' }}
        />
      )}
      <div className="editorDemoBody compact">
        <MarkdownWysiwygEditor
          initialMarkdown="# Toolbar demo\n\nClick the image button to upload — files become data URLs in this demo."
          onEditorReady={setEditor}
        />
      </div>
    </div>
  );
}

/** 代码块 + 键盘导航 */
export function CodeBlockDemo() {
  return (
    <div className="editorDemo">
      <div className="editorDemoBody">
        <MarkdownWysiwygEditor initialMarkdown={CODEBLOCK_MD} />
      </div>
    </div>
  );
}

/** 客户端预览 */
export function PreviewDemo({ markdown = PREVIEW_MD }: { markdown?: string }) {
  return (
    <div className="previewDemo">
      <MarkdownPreview markdown={markdown} />
    </div>
  );
}

/** 实时 markdown 输出 */
export function MarkdownOutputDemo() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [markdown, setMarkdown] = useState(DEMO_MD);
  useEffect(() => {
    if (!editor) return;
    const sync = () => setMarkdown(editor.getMarkdown());
    editor.on('update', sync);
    sync();
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);
  return (
    <div className="markdownOutDemo">
      <div className="markdownOutEditor">
        <MarkdownWysiwygEditor
          initialMarkdown={DEMO_MD}
          onEditorReady={setEditor}
        />
      </div>
      <pre className="markdownOut">
        <code>{markdown}</code>
      </pre>
    </div>
  );
}

/** TOC 面板 */
export function TocDemo() {
  const [activeId, setActiveId] = useState('getting-started');
  const [items, setItems] = useState<TocItem[]>(SAMPLE_TOC);
  return (
    <div className="tocDemo">
      <TocPanel
        items={items}
        activeId={activeId}
        onItemClick={(item) => !item.locked && setActiveId(item.id)}
        labels={{ title: 'Contents' }}
      />
      <div className="tocDemoAside">
        <p>
          Active: <code>{activeId}</code>
        </p>
        <button type="button" onClick={() => setItems([...SAMPLE_TOC])}>
          Reset items
        </button>
      </div>
    </div>
  );
}

/** 编辑器内联 TOC 同步 */
export function EditorTocDemo() {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');
  return (
    <div className="editorTocDemo">
      <div className="editorTocDemoEditor">
        <MarkdownWysiwygEditor
          initialMarkdown="# Intro\n\n## Getting Started\n\n## API Reference\n\n## Changelog"
          onTocChange={setToc}
        />
      </div>
      <TocPanel
        items={toc}
        activeId={activeId}
        onItemClick={(item) => setActiveId(item.id)}
      />
    </div>
  );
}

/** ReportContent 静态 HTML 阅读器 */
const SAMPLE_HTML = `<h1 id="published-article">Published article</h1>
<p>This is <strong>ReportContent</strong> — the same HTML produced by <code>renderReportHtml()</code> on the server.</p>
<h2 id="syntax-highlighting">Syntax highlighting</h2>
<pre><code class="language-javascript">const sum = (a, b) =&gt; a + b;</code></pre>
<h2 id="table-support">Table support</h2>
<table><thead><tr><th>Column</th><th>Value</th></tr></thead><tbody><tr><td>Alpha</td><td>1</td></tr><tr><td>Beta</td><td>2</td></tr></tbody></table>`;

export function ReportContentDemo() {
  return (
    <div className="previewDemo">
      <ReportContent html={SAMPLE_HTML} />
    </div>
  );
}

/** CSS 变量主题切换 */
export function ThemeDemo() {
  const [accent, setAccent] = useState('#1677ff');
  return (
    <div
      className="themeDemo"
      style={
        {
          '--tmr-accent': accent,
        } as CSSProperties
      }
    >
      <div className="themeControls">
        <label>
          Accent color
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
          />
        </label>
        <code>--tmr-accent: {accent}</code>
      </div>
      <MarkdownWysiwygEditor initialMarkdown="# Themed editor\n\nAccent color drives selection, links, and TOC highlights." />
    </div>
  );
}

/** 首页三 tab 大 demo */
export function HeroDemo() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [markdown, setMarkdown] = useState(DEMO_MD);
  const [tab, setTab] = useState<'editor' | 'markdown' | 'reader'>('editor');
  const onImageUpload = useCallback((file: File) => fileToDataUrl(file), []);

  useEffect(() => {
    if (!editor) return;
    const sync = () => setMarkdown(editor.getMarkdown());
    editor.on('update', sync);
    sync();
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);

  return (
    <div className="window">
      <div className="windowBar">
        <span className="dot r" />
        <span className="dot y" />
        <span className="dot g" />
        <span className="windowTitle">tiptap-markdown-react · live</span>
      </div>
      <div className="demoTabs">
        <button
          type="button"
          className={tab === 'editor' ? 'active' : ''}
          onClick={() => setTab('editor')}
        >
          Editor
        </button>
        <button
          type="button"
          className={tab === 'reader' ? 'active' : ''}
          onClick={() => setTab('reader')}
        >
          Rendered
        </button>
        <button
          type="button"
          className={tab === 'markdown' ? 'active' : ''}
          onClick={() => setTab('markdown')}
        >
          Markdown output
        </button>
      </div>
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
        <pre className="markdownOut">
          <code>{markdown}</code>
        </pre>
      )}
    </div>
  );
}
