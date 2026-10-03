import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiRow, NavGroup, PageId } from './site-data';
import { TOP_NAV } from './site-data';
import { LangToggle, useT } from './lang';

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

export interface HashRoute {
  page: PageId;
  /** `#/components?editor` 形态里的页内锚点。 */
  anchor: string | null;
}

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/**
 * hash 即路由：`#/页面?锚点`。页面内锚点必须寄生在路由 hash 上——
 * 若菜单直接写 `#anchor`，hashchange 会把路由解析成 home（整站跳走的 bug）。
 */
function parseRoute(hash: string): HashRoute {
  const [path, anchorPart] = hash.replace(/^#/, '').split('?');
  const anchor = anchorPart?.trim() || null;
  if (path.startsWith('/components')) return { page: 'components', anchor };
  if (path.startsWith('/demos')) return { page: 'demos', anchor };
  if (path.startsWith('/api')) return { page: 'api', anchor };
  return { page: 'home', anchor };
}

export function TopNav({ active }: { active: PageId }) {
  const scrolled = useScrolled();
  const t = useT();
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
            {t(item.label)}
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
        <LangToggle />
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
  const t = useT();
  return (
    <nav className="sideNav">
      {groups.map((group) => (
        <div key={group.title} className="sideNavGroup">
          <p className="sideNavTitle">{t(group.title)}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <a className="sideNavLink" href={item.href}>
                  {t(item.label)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function PageToc({
  page,
  items,
}: {
  page: PageId;
  items: { id: string; label: string }[];
}) {
  const t = useT();
  return (
    <nav className="pageToc">
      <p className="pageTocTitle">{t('On this page')}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {/* 锚点寄生在路由 hash 上，避免把路由顶掉 */}
            <a href={`#/${page}?${item.id}`}>{t(item.label)}</a>
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
        npm v{__LIB_VERSION__}
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
  const t = useT();
  return (
    <div className="demoBlock" id={anchor}>
      <div className="demoBlockHead">
        <h3>{t(title)}</h3>
        {description && <p>{t(description)}</p>}
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
  const t = useT();
  const hasDefault = rows.some((r) => r.defaultVal !== undefined);
  return (
    <div className="apiTableWrap">
      <table className="apiTable">
        <thead>
          <tr>
            <th>{t('属性')}</th>
            <th>{t('说明')}</th>
            <th>{t('类型')}</th>
            {hasDefault && <th>{t('默认值')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>{t(row.desc)}</td>
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
  const t = useT();
  return (
    <section className="componentSection" id={id}>
      <h2>{title}</h2>
      <p className="componentDesc">{t(description)}</p>
      <ImportRow name={importName} />
      <NpmRow />
      <ul className="featureList">
        {features.map((f) => (
          <li key={f}>{t(f)}</li>
        ))}
      </ul>
      {demo && (
        <>
          <h3 className="sectionSub">{t('🚀 代码演示')}</h3>
          {demo}
        </>
      )}
      <h3 className="sectionSub">{t('📖 API 参考')}</h3>
      <ApiTable rows={api} />
      {refApi && refApi.length > 0 && (
        <>
          <h4 className="sectionSubSm">{t('Ref 方法')}</h4>
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
