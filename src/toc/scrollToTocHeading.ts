/**
 * 目录点击 → 平滑滚到对应标题。
 *
 * 不依赖浏览器 `scrollTo({behavior:'smooth'})` / `scrollIntoView({behavior:'smooth'})`——
 * 在 flex + overflow 嵌套布局下（父级 `overflow:hidden`、自身 `flex:1; overflow-y:auto`），
 * Chrome 的 compositor 驱动 smooth scroll 会静默失效。
 *
 * 改用 `requestAnimationFrame` + easeOutCubic 缓动，直接操作 `scrollTop`，
 * 主线程一次性 400ms 动画，点击触发的单次滚动无感知性能差异。
 *
 * 尊重 `prefers-reduced-motion: reduce`——此时瞬间跳转，无动画。
 */

/** 缓动：easeOutCubic。t ∈ [0, 1]。 */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/**
 * 平滑滚动（或瞬间跳转）到指定 `data-toc-id` 的标题。
 *
 * @param headingId  - TOC item 的 id，对应 DOM 上 `data-toc-id` 属性值
 * @param scrollContainer - 滚动容器（如 `.scrollArea`）
 * @param options    - `duration`：动画时长 ms，默认 400
 */
export function scrollToTocHeading(
  headingId: string,
  scrollContainer: HTMLElement,
  options?: { duration?: number },
): void {
  const el = scrollContainer.querySelector<HTMLElement>(
    `[data-toc-id="${CSS.escape(headingId)}"]`,
  );
  if (!el) return;

  const startTop = scrollContainer.scrollTop;
  const rootRect = scrollContainer.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetTop = startTop + (elRect.top - rootRect.top);

  // prefers-reduced-motion：瞬间跳转
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scrollContainer.scrollTop = targetTop;
    return;
  }

  // 手动平滑滚动
  const duration = options?.duration ?? 400;
  const start = performance.now();
  const animate = () => {
    const t = Math.min((performance.now() - start) / duration, 1);
    scrollContainer.scrollTop = startTop + (targetTop - startTop) * easeOutCubic(t);
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
