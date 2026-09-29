/**
 * 查找替换的适配层。
 *
 * 匹配 / 高亮 / 替换全部由官方 `@tiptap/extension-find-and-replace` 承担（命令 + storage +
 * decoration），宿主与 AI 侧可以直接用 `editor.commands.setSearchTerm / replaceAll …`。
 * 这个文件只收拾 Tiptap 3.31.3 上的一个坑，以及库内的默认防抖。
 */

/**
 * 输入防抖（毫秒）。
 *
 * 注意：注册扩展时必须把官方选项 `searchDebounceMs` 设为 **0**。官方防抖走 `setTimeout`，
 * 真正的 dispatch 发生在异步回调里，下面 `runFindCommand` 的守卫就兜不住那次抛错。
 * 防抖改由调用方（浮动条）自己做，语义一样但全程同步。
 */
export const FIND_DEBOUNCE_MS = 120;

const MISMATCH_RE = /Applying a mismatched transaction/;

/**
 * 跑一条官方查找替换命令，兜掉 Tiptap 3.31.3 的一处事务错配。
 *
 * 成因：官方扩展的 `setSearchTerm` 不走 CommandManager 给的 dispatch，而是自己
 * `editor.state.tr` + `view.dispatch`（见扩展 dist 的 `applySearchTerm`）。CommandManager
 * 在命令结束后仍会派发它「命令开始时创建」的那个 tr。若这次派发触发了 TrailingNode 的
 * appendTransaction（**文末是代码块 / 表格 / 图表**时它会补一个空段落，starter-kit 自带），
 * doc 已经前进，那个旧 tr 的 `before` 就对不上当前 doc → `RangeError: Applying a mismatched
 * transaction`。
 *
 * 此时查询其实已经生效（扩展自己那次 dispatch 成功了、尾段落也补上了），只是紧随其后的
 * 第二次派发炸掉。所以捕获这一种错并重试一次即可收敛——重试时文末空段落已在，TrailingNode
 * 不再插手。其它错误照抛，不吞。
 */
export function runFindCommand(run: () => void): void {
  try {
    run();
  } catch (error) {
    if (error instanceof RangeError && MISMATCH_RE.test(error.message)) {
      run();
      return;
    }
    throw error;
  }
}
