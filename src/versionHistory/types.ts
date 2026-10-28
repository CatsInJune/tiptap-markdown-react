/**
 * 宿主保存的一份正文快照。库不负责存储，只负责展示、对比和写回。
 */
export interface DocumentVersion {
  id: string;
  /** 列表主文案。 */
  title: string;
  /** 这一版的正文。不含文档标题。 */
  markdown: string;
  /** 列表次行的时间。 */
  createdAt?: Date | number | string;
  /** 列表次行的说明，例如作者。 */
  detail?: string;
  /** 行内标记，例如「已发布」「草稿」。文案由宿主决定。 */
  badge?: string;
  /**
   * 正文标题。它不在 markdown 里，面板恢复时不会写回编辑器；
   * 宿主在 `onRestore` 里自己写。
   */
  documentTitle?: string;
}
