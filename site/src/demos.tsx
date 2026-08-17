import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  CommentPopover,
  EditorToolbar,
  MarkdownPreview,
  MarkdownWysiwygEditor,
  ReportContent,
  ReportContentInteractive,
  TocPanel,
  type CitationEnterContext,
  type CommentRef,
  type MarkdownWysiwygEditorHandle,
  type RenderCitation,
  type TocItem,
} from 'tiptap-markdown-react';
import { renderReportHtml } from 'tiptap-markdown-react/server';
import {
  CODEBLOCK_MD,
  CITATION_MD,
  CITATION_SOURCES,
  DEMO_MD,
  INGEST_MD,
  MATH_MD,
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

const COMMENT_SAMPLE_MD = `# 寒武纪深度研究

寒武纪成立于2016年，是中国目前少数全面掌握AI芯片全栈自研能力的独立芯片设计企业。

FY2025 营收 649,720 万元，同比 +453.2%，扭亏为盈。
`;

const COMMENT_SAMPLE_COMMENTS: CommentRef[] = [
  {
    commentId: 'c1',
    author: 'agent',
    state: 'open',
    segments: [{ exact: '寒武纪成立于2016年' }],
    body: '【无依据】请补充成立年份的来源。',
  },
  {
    commentId: 'c2',
    author: 'user',
    state: 'open',
    segments: [{ exact: '649,720 万元' }],
    body: '确认营收口径为人民币万元。',
  },
];

/**
 * 评论锚定 Demo：编辑态高亮 + gutter + sidebar 联动 + CommentPopover。
 * 只读态（MarkdownPreview）不渲染任何评论。
 */
export function CommentAnchorDemo() {
  const editorRef = useRef<MarkdownWysiwygEditorHandle>(null);
  const [active, setActive] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);
  const [popover, setPopover] = useState<{
    commentId: string;
    anchorEl: HTMLElement;
  } | null>(null);

  const byId = useMemo(
    () => new Map(COMMENT_SAMPLE_COMMENTS.map((c) => [c.commentId, c])),
    [],
  );

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={readonly}
            onChange={(e) => {
              setReadonly(e.target.checked);
              setPopover(null);
            }}
          />
          Read-only ({readonly ? 'same component, comments off' : 'edit mode'})
        </label>
        <MarkdownWysiwygEditor
          ref={editorRef}
          initialMarkdown={COMMENT_SAMPLE_MD}
          editable={!readonly}
          comments={COMMENT_SAMPLE_COMMENTS}
          activeCommentId={active}
          onActiveCommentChange={setActive}
          onCommentClick={({ commentIds, anchorEl }) => {
            if (anchorEl) {
              setPopover({ commentId: commentIds[0], anchorEl });
            }
          }}
        />
      </div>

      <aside
        style={{
          width: 220,
          flexShrink: 0,
          border: '1px solid #e4e2dd',
          borderRadius: 8,
          padding: 10,
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Comments</div>
        {COMMENT_SAMPLE_COMMENTS.map((c) => (
          <button
            key={c.commentId}
            type="button"
            onClick={() => editorRef.current?.focusComment(c.commentId)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              marginBottom: 6,
              padding: '6px 8px',
              borderRadius: 6,
              border:
                active === c.commentId
                  ? '1px solid #f4b400'
                  : '1px solid #e4e2dd',
              background: active === c.commentId ? '#fff6d9' : '#fff',
              cursor: 'pointer',
            }}
          >
            {c.body}
          </button>
        ))}
        <button
          type="button"
          onClick={() => editorRef.current?.nextComment('next')}
          style={{ marginTop: 4 }}
        >
          Next comment
        </button>
      </aside>

      {!readonly && (
        <CommentPopover
          open={!!popover}
          onOpenChange={(open) => {
            if (!open) setPopover(null);
          }}
          anchorEl={popover?.anchorEl ?? null}
        >
          {popover && byId.get(popover.commentId) && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {byId.get(popover.commentId)!.body}
              </div>
              <button type="button" onClick={() => setPopover(null)}>
                Close
              </button>
            </div>
          )}
        </CommentPopover>
      )}
    </div>
  );
}

/** Markdown 摄入:粘贴 / 拖拽 .md / 工具栏导入 */
export function MarkdownIngestDemo() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <div className="editorDemo">
      {editor && <EditorToolbar editor={editor} />}
      <div className="editorDemoBody">
        <MarkdownWysiwygEditor
          initialMarkdown={INGEST_MD}
          placeholder="Paste markdown or drop a .md file…"
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

/** 公式：工具栏插入 + 点击编辑；金额保持文本 */
export function MathDemo() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <div className="editorDemo">
      {editor && <EditorToolbar editor={editor} />}
      <div className="editorDemoBody">
        <MarkdownWysiwygEditor
          initialMarkdown={MATH_MD}
          placeholder="Insert an equation from More…"
          onEditorReady={setEditor}
        />
      </div>
    </div>
  );
}

/** SSR 阅读页公式（无 NodeView） */
export function MathSsrDemo() {
  const html = useMemo(() => renderReportHtml(MATH_MD).html, []);
  return (
    <div className="previewDemo">
      <ReportContent html={html} />
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

/** 脚注圆标：库渲 pill，消费方用 renderCitation 挂 Popover */
export function CitationDemo() {
  const renderCitation: RenderCitation = useCallback(({ index, defaultDom }) => {
    const source = CITATION_SOURCES.find((s) => s.index === index);
    if (!source?.excerpt) return defaultDom;
    return (
      <Popover.Root>
        <Popover.Trigger asChild>
          <span style={{ display: 'inline', cursor: 'pointer' }}>
            {defaultDom}
          </span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            sideOffset={8}
            className="citationPopover"
          >
            <div className="citationPopoverTitle">Original excerpt</div>
            <div className="citationPopoverBody">{source.excerpt}</div>
            {source.url && (
              <>
                <div className="citationPopoverDivider" />
                <a
                  className="citationPopoverLink"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                </a>
              </>
            )}
            <Popover.Arrow className="citationPopoverArrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }, []);

  return (
    <div className="previewDemo">
      <MarkdownPreview
        markdown={CITATION_MD}
        sources={CITATION_SOURCES}
        renderCitation={renderCitation}
      />
    </div>
  );
}

/** SSR HTML + CitationInteractive：仅 click，宿主管 Popover */
export function CitationSsrDemo() {
  const html = useMemo(
    () =>
      renderReportHtml(CITATION_MD, { sources: CITATION_SOURCES }).html,
    [],
  );

  const [active, setActive] = useState<CitationEnterContext | null>(null);

  const onCitationEnter = useCallback((ctx: CitationEnterContext) => {
    const source = CITATION_SOURCES.find((s) => s.index === ctx.index);
    if (!source?.excerpt) {
      setActive(null);
      return;
    }
    setActive(ctx);
  }, []);

  const source = active
    ? CITATION_SOURCES.find((s) => s.index === active.index)
    : undefined;
  const rect = active?.anchorEl.getBoundingClientRect();

  return (
    <div className="previewDemo">
      <ReportContentInteractive
        html={html}
        onCitationEnter={onCitationEnter}
        onCitationLeave={() => setActive(null)}
      />
      {active && source?.excerpt && rect ? (
        <div
          className="citationPopover citationPopoverFixed"
          style={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left + rect.width / 2,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
          }}
          role="dialog"
        >
          <div className="citationPopoverTitle">Original excerpt</div>
          <div className="citationPopoverBody">{source.excerpt}</div>
          {source.url && (
            <>
              <div className="citationPopoverDivider" />
              <a
                className="citationPopoverLink"
                href={source.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setActive(null)}
              >
                View source
              </a>
            </>
          )}
          <button
            type="button"
            className="citationPopoverClose"
            onClick={() => setActive(null)}
          >
            Close
          </button>
        </div>
      ) : null}
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
