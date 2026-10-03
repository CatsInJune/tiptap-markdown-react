import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { EN_STRINGS, ZH_STRINGS } from './strings';
import type { LocaleCode } from './i18n';

/**
 * 站点自身的语言状态（区别于库组件的 labels 注入，见 i18n.ts）：
 * 默认中文，localStorage 持久化，<html lang> 随之更新。
 *
 * 翻译走「字典 + 优雅回退」：英文原文即 key（数据文件零改动），
 * ZH_STRINGS 缺 key 时原样回退英文；站点里原本就是中文的少量字符串
 * 由 EN_STRINGS 反向映射。
 */
const STORAGE_KEY = 'site-lang';

interface LangState {
  lang: LocaleCode;
  setLang: (lang: LocaleCode) => void;
}

const LangContext = createContext<LangState>({ lang: 'zh', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<LocaleCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' ? 'en' : 'zh';
    } catch {
      return 'zh';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* 隐私模式等场景忽略 */
    }
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  return useContext(LangContext);
}

/** 字典翻译：数据文件里的英文原文直接查表，缺失回退原文。 */
export function useT(): (s: string) => string {
  const { lang } = useLang();
  return useCallback(
    (s: string) => (lang === 'zh' ? (ZH_STRINGS[s] ?? s) : (EN_STRINGS[s] ?? s)),
    [lang],
  );
}

/** 成对翻译：适合 JSX 行内成段的中英文案。 */
export function useTx(): (zh: string, en: string) => string {
  const { lang } = useLang();
  return useCallback((zh: string, en: string) => (lang === 'zh' ? zh : en), [lang]);
}

/** 顶栏的中 / EN 切换按钮。 */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="langToggle" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'zh' ? 'langOption active' : 'langOption'}
        onClick={() => setLang('zh')}
      >
        中
      </button>
      <button
        type="button"
        className={lang === 'en' ? 'langOption active' : 'langOption'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
}
