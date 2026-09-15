import type { ToolbarLabels } from './labels';

/** 包内唯一识别的扩展名：命中即本地读文本，其余一律交给宿主回调。 */
export const MD_FILE_RE = /\.(md|markdown)$/i;
export const MD_ACCEPT = '.md,.markdown,text/markdown';

/** 主栏导入下拉里的一项。`accept` 写到隐藏 file input。 */
export interface ImportMenuItem {
  key: string;
  label: string;
  accept: string;
}

export function resolveImportMenuItems({
  labels,
  onImportDocument,
  importAccept,
  importMenuItems,
}: {
  labels: ToolbarLabels;
  onImportDocument?: unknown;
  importAccept?: string;
  importMenuItems?: ImportMenuItem[];
}): ImportMenuItem[] {
  if (importMenuItems?.length) return importMenuItems;
  const markdown: ImportMenuItem = {
    key: 'markdown',
    label: labels.importMarkdown,
    accept: MD_ACCEPT,
  };
  if (onImportDocument && importAccept) {
    return [
      markdown,
      {
        key: 'document',
        label: labels.importDocumentOther,
        accept: importAccept,
      },
    ];
  }
  return [markdown];
}
