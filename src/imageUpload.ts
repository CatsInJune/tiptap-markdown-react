/**
 * 图片上传占位块（`ImageUploadNode`）：交互与扩展结构对齐官方 UI Components 的
 * `image-upload-node`（MIT，移植范围与声明见 THIRD_PARTY_LICENSES.md 第 2 节）——
 * 工具栏按钮插入占位块，块内拖拽 / 点选、进度就地显示，全部成功后原地换成图片节点。
 */
import { mergeAttributes, Node, type Editor } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageUploadView } from './components/ImageUploadView';
import type { ImageUploadLabels } from './labels';

/**
 * 上传函数：收到文件与进度回调（`progress` 为 0–100），返回可访问的图片 URL。
 * `signal` 在用户移除该文件 / 清空队列 / 占位块被删掉时 abort，宿主据此中断请求。
 * 旧的 `(file) => Promise<string>` 单参函数仍可直接传入。
 */
export type ImageUploadFn = (
  file: File,
  onProgress?: (event: { progress: number }) => void,
  signal?: AbortSignal,
) => Promise<string>;

export interface ImageUploadOptions {
  /** 真正干活的上传（网络 I/O 归宿主）。未配置时选中文件即走 `onError`。 */
  upload?: ImageUploadFn;
  /** 文件选择框接受的文件类型，默认 `image/*`。 */
  accept?: string;
  /** 一次可排队上传的文件数上限，默认 1；大于 1 时文件选择框允许多选。 */
  limit?: number;
  /** 单文件体积上限（字节），默认 0 = 不限。 */
  maxSize?: number;
  /** 上传成功后就地替换成的节点类型，默认 `image`（本库的块级图片）。 */
  type?: string;
  /** 单个文件失败的回调：超体积、超数量、上传函数抛错都走这里。 */
  onError?: (error: Error) => void;
  /** 单个文件成功的回调（先于占位块替换触发）。 */
  onSuccess?: (url: string) => void;
  /** 占位块文案。 */
  labels?: Partial<ImageUploadLabels>;
}

/**
 * 组件层（`<MarkdownWysiwygEditor imageUpload={{…}}>`）的配置：`upload` 必填——
 * 组件入口就是要注入 I/O 的地方；扩展层单独用时才允许先不配。
 */
export type ImageUploadConfig = ImageUploadOptions & { upload: ImageUploadFn };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      /**
       * 在光标处插入图片上传占位块：可点击选图 / 拖拽，上传进度就地显示，
       * 全部成功后就地换成图片节点。参数覆盖 configure 的 accept / limit / maxSize。
       */
      setImageUploadNode: (options?: {
        accept?: string;
        limit?: number;
        maxSize?: number;
      }) => ReturnType;
    };
  }
}

/** 编辑器里是否注册了图片上传扩展（工具栏据此把图片按钮切成「插入上传块」）。 */
export function hasImageUpload(editor: Editor): boolean {
  return editor.extensionManager.extensions.some(
    (ext) => ext.name === ImageUploadNode.name,
  );
}

/**
 * 图片上传占位块（对齐官方 ImageUploadNode 的交互）：块级 atom，NodeView 里自带
 * 拖拽区 / 文件队列 / 进度条，上传成功后原地替换为 `type` 指定的图片节点。
 *
 * 两条与官方不同的边界处理：
 * - `renderMarkdown` 返回空串——上传中的占位块不进 Markdown，autosave 不会把
 *   进度文案落库（HTML 序列化才有 `data-type="image-upload"` 的痕迹）。
 * - 体积上限 0 表示「不限」：判超限必须走 `maxSize > 0`，否则默认值 0 会把所有
 *   非空文件都判成超限（官方实现即栽在这条上）。
 */
export const ImageUploadNode = Node.create<ImageUploadOptions>({
  name: 'imageUpload',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      upload: undefined,
      accept: 'image/*',
      limit: 1,
      maxSize: 0,
      type: 'image',
      onError: undefined,
      onSuccess: undefined,
      labels: undefined,
    };
  },

  addAttributes() {
    return {
      accept: { default: this.options.accept },
      limit: { default: this.options.limit },
      maxSize: { default: this.options.maxSize },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-upload"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-type': 'image-upload' }, HTMLAttributes),
    ];
  },

  /** 占位块不进 Markdown（与 ImportPlaceholder 同）：上传中的状态不该被保存。 */
  renderMarkdown() {
    return '';
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadView);
  },

  addCommands() {
    return {
      setImageUploadNode:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },

  addKeyboardShortcuts() {
    return {
      // 官方图片按钮的快捷键（Cmd/Ctrl+Shift+I）。Windows 上 Ctrl+Shift+I 是
      // DevTools 的键位，冲突时浏览器优先——与官方行为一致。
      'Mod-Shift-i': () => this.editor.commands.setImageUploadNode(),
      // 选中占位块时按 Enter = 打开文件选择框。借 NodeView 的点击路径（NodeViewWrapper
      // 外包一层 div，所以要点它的第一个子元素），与官方同款实现。
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { nodeAfter } = selection.$from;
        if (nodeAfter?.type.name !== this.name || !editor.isActive(this.name)) {
          return false;
        }
        const nodeEl = editor.view.nodeDOM(selection.$from.pos);
        const clickable =
          nodeEl instanceof HTMLElement ? nodeEl.firstChild : null;
        if (clickable instanceof HTMLElement) {
          clickable.click();
          return true;
        }
        return false;
      },
    };
  },
});
