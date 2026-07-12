import { useEffect, useState } from 'react';

/**
 * 是否窄屏（默认 <768px）。取代原项目的 useDevice，内联为纯 matchMedia，
 * 无第三方依赖。SSR 首帧返回 false，挂载后按实际视口更新。
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}
