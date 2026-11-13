'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { LocaleCode } from '../i18n';

interface TiptapConfigContextValue {
  locale: LocaleCode;
}

const TiptapConfigContext = createContext<TiptapConfigContextValue | null>(null);

export interface TiptapConfigProviderProps {
  /** 组件库统一的界面语言，默认英文。 */
  locale?: LocaleCode;
  children: ReactNode;
}

/**
 * 整套组件的全局配置入口：目前承载界面语言，编辑器、工具栏、预览、阅读页
 * 以及所有就地交互统一切换；组件不再接受各自的 `locale`。
 *
 * 以后更多全局能力（例如自定义文案）也挂在这里，不另开 Provider。
 */
export function TiptapConfigProvider({
  locale = 'en',
  children,
}: TiptapConfigProviderProps) {
  const value = useMemo(() => ({ locale }), [locale]);
  return (
    <TiptapConfigContext.Provider value={value}>
      {children}
    </TiptapConfigContext.Provider>
  );
}

/** 读取最近的 Provider；未包 Provider 时回落英文。 */
export function useMarkdownLocale(): LocaleCode {
  return useContext(TiptapConfigContext)?.locale ?? 'en';
}
