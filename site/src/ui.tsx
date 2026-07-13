import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiRow, NavGroup, PageId } from './site-data';
import { TOP_NAV } from './site-data';

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

export function useHashPage(): PageId {
  const [page, setPage] = useState<PageId>(() => parsePage(window.location.hash));
  useEffect(() => {
    const onHash = () => setPage(parsePage(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page;
}

function parsePage(hash: string): PageId {
  const path = hash.replace(/^#/, '') || '/';
  if (path.startsWith('/components')) return 'components';
  if (path.startsWith('/demos')) return 'demos';
  if (path.startsWith('/api')) return 'api';
  return 'home';
}

export function TopNav({ active }: { active: PageId }) {
  const scrolled = useScrolled();
  return (
    <header className={`topNav ${scrolled ? 'scrolled' : ''}`}>
      <a className="brand" href="#/">
        <span className="brandMark">M</span>
        <span className="brandText">tiptap-markdown-react</span>
      </a>
      <nav className="topNavLinks">
        {TOP_NAV.map((item) => (
          <a
            key={item.id}
            className={`topNavLink ${active === item.id ? 'active' : ''}`}
            href={item.href}
          >
            {item.label}
          </a>
        ))}
        <a
          className="topNavCta"
          href="https://github.com/CatsInJune/tiptap-markdown-react"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </nav>
    </header>
  );
}

export function DocsShell({
  sidebar,
  toc,
  children,
}: {
  sidebar?: ReactNode;
  toc?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`docsShell ${sidebar ? '' : 'noSidebar'}`}>
      {sidebar && <aside className="docsSidebar">{sidebar}</aside>}
      <main className="docsMain">{children}</main>
      {toc && <aside className="docsToc">{toc}</aside>}
    </div>
  );
}

export function SideNav({ groups }: { groups: NavGroup[] }) {
  return (
    <nav className="sideNav">
      {groups.map((group) => (
        <div key={group.title} className="sideNavGroup">
          <p className="sideNavTitle">{group.title}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <a className="sideNavLink" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function PageToc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="pageToc">
      <p className="pageTocTitle">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CopyRow({ text }: { text: string }) {
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

export function Snippet({ code }: { code: string }) {
  return (
    <pre className="snippet">
      <code>{code}</code>
    </pre>
  );
}

export function ImportRow({ name }: { name: string }) {
  return (
    <div className="importRow">
      <span className="importLabel">import</span>
      <CopyRow text={`import { ${name} } from 'tiptap-markdown-react';`} />
    </div>
  );
}

export function NpmRow() {
  return (
    <div className="npmRow">
      <a
        href="https://www.npmjs.com/package/tiptap-markdown-react"
        target="_blank"
        rel="noreferrer"
        className="npmBadge"
      >
        npm v0.1.0
      </a>
      <CopyRow text="npm install tiptap-markdown-react" />
    </div>
  );
}

export function DemoBlock({
  title,
  description,
  controls,
  children,
  anchor,
}: {
  title: string;
  description?: string;
  controls?: ReactNode;
  children: ReactNode;
  anchor?: string;
}) {
  return (
    <div className="demoBlock" id={anchor}>
      <div className="demoBlockHead">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {controls && <div className="demoControls">{controls}</div>}
      <div className="demoCard">
        <span className="demoWatermark">tiptap-markdown-react</span>
        <div className="demoCardBody">{children}</div>
      </div>
    </div>
  );
}

export function ApiTable({ rows }: { rows: ApiRow[] }) {
  const hasDefault = rows.some((r) => r.defaultVal !== undefined);
  return (
    <div className="apiTableWrap">
      <table className="apiTable">
        <thead>
          <tr>
            <th>属性</th>
            <th>说明</th>
            <th>类型</th>
            {hasDefault && <th>默认值</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>{row.desc}</td>
              <td>
                <code className="typeCell">{row.type}</code>
              </td>
              {hasDefault && (
                <td>
                  {row.defaultVal ? (
                    <code>{row.defaultVal}</code>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComponentSection({
  id,
  title,
  description,
  importName,
  features,
  demo,
  api,
  refApi,
  extra,
}: {
  id: string;
  title: string;
  description: string;
  importName: string;
  features: string[];
  demo?: ReactNode;
  api: ApiRow[];
  refApi?: ApiRow[];
  extra?: ReactNode;
}) {
  return (
    <section className="componentSection" id={id}>
      <h2>{title}</h2>
      <p className="componentDesc">{description}</p>
      <ImportRow name={importName} />
      <NpmRow />
      <ul className="featureList">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {demo && (
        <>
          <h3 className="sectionSub">🚀 代码演示</h3>
          {demo}
        </>
      )}
      <h3 className="sectionSub">📖 API 参考</h3>
      <ApiTable rows={api} />
      {refApi && refApi.length > 0 && (
        <>
          <h4 className="sectionSubSm">Ref 方法</h4>
          <ApiTable rows={refApi} />
        </>
      )}
      {extra}
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <span>MIT © CatsInJune</span>
      <a
        href="https://github.com/CatsInJune/tiptap-markdown-react"
        target="_blank"
        rel="noreferrer"
      >
        github.com/CatsInJune/tiptap-markdown-react
      </a>
    </footer>
  );
}
