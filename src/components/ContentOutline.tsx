'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LocaleCode } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';
import styles from '../styles/content.module.css';
import { readTocItems, sameTocItems } from '../toc/readTocItems';
import type { TocItem } from '../toc/extractToc';
import { EditorToc } from './EditorToc';

export function ContentOutline({
  toc = false,
  locale = 'en',
  watch,
  children,
}: {
  /** 内置左缘目录。默认关。无标题或宽度小于 768px 时也不显示。 */
  toc?: boolean;
  locale?: LocaleCode;
  /** 正文变化时重读标题，一般传 html 字符串。 */
  watch?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<TocItem[]>([]);
  const mobile = useIsMobile(768);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !toc) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const read = () => {
      const next = readTocItems(el);
      setItems((prev) => (sameTocItems(prev, next) ? prev : next));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [toc, watch]);

  const root = ref.current;
  const show = toc && !mobile && items.length > 0 && root !== null;

  return (
    <div className={styles.editorHost}>
      {show && root ? (
        <EditorToc items={items} editorDom={root} locale={locale} />
      ) : null}
      <div ref={ref} className={show ? styles.withToc : undefined}>
        {children}
      </div>
    </div>
  );
}
