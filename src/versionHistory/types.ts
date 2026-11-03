/**
 * 宿主保存的一份正文快照。库不负责存储，只负责展示、对比和写回。
 */
export interface DocumentVersion {
  id: string;
  /** 列表主文案。 */
  title: string;
  /**
   * 这一版的正文。不含文档标题。
   *
   * 列表接口只回元数据时可以为空——面板在选中/对比时调用
   * `onLoadVersionContent(id)` 按需取全文并缓存。
   */
  markdown?: string;
  /**
   * 版本所属章节的首块 ID。有值且当前文档还能定位到该块时，恢复只替换这一章；
   * 找不到（章已删）则插到光标处。缺省时面板会从 markdown 的
   * `<!--b:...-->` 首行推断；都没有则按旧语义整篇替换。
   */
  leadBlockId?: string | null;
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
  /**
   * 恢复范围。`document` = 这一版是「整篇快照」（一次保存一条的批次历史），
   * 恢复时整篇替换且保留块 ID；缺省按章恢复。
   */
  scope?: 'chapter' | 'document';
}
