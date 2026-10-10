'use client';

import type { Editor } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { XIcon } from '../icons';
import type { ImageUploadOptions } from '../imageUpload';
import {
  defaultImageUploadLabels,
  type ImageUploadLabels,
} from '../labels';
import styles from '../styles/imageUpload.module.css';

interface FileItem {
  id: string;
  file: File;
  /** 0–100。 */
  progress: number;
  status: 'uploading' | 'error';
  abort: AbortController;
}

let seq = 0;
const nextId = () => `image-upload-${++seq}`;

/** 文件体积的人类可读格式。 */
function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
}

/** MB 数值去掉多余的 .0（5MB / 2.5MB）。 */
const toMb = (bytes: number) => parseFloat((bytes / 1024 / 1024).toFixed(1));

/**
 * 上传完成后把光标移到图片之后；没有后继节点就补一个空段落。
 * 不挪的话替换成 atom 图片后光标悬空，用户接着打字会落在占位块之前。
 */
function focusNextNode(editor: Editor) {
  const { state, view } = editor;
  const next = Selection.findFrom(state.selection.$to, 1, true);
  if (next) {
    view.dispatch(state.tr.setSelection(next).scrollIntoView());
    return;
  }
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return;
  const end = state.doc.content.size;
  const tr = state.tr.insert(end, paragraph.create());
  view.dispatch(
    tr
      .setSelection(TextSelection.near(tr.doc.resolve(end + 1)))
      .scrollIntoView(),
  );
}

/**
 * 图片上传占位块的 NodeView：空态是点击 / 拖拽区，排队后是文件行（进度条 + 百分比 +
 * 移除），全部成功时就地把自己换成图片节点。上传函数与回调都来自扩展 options。
 *
 * 组件结构 / 文件队列 / 拖拽 / 中止逻辑按官方 UI Components 的 `image-upload-node`
 * 移植（MIT，见 THIRD_PARTY_LICENSES.md 第 2 节），按本库的样式体系（CSS Modules +
 * --tmr-* 变量）与 labels 注入重写。
 */
export function ImageUploadView(props: NodeViewProps) {
  const { node, extension, editor, getPos } = props;
  const options = extension.options as ImageUploadOptions;
  const labels: ImageUploadLabels = {
    ...defaultImageUploadLabels,
    ...options.labels,
  };

  const accept = String(node.attrs.accept ?? 'image/*');
  const limit = Number(node.attrs.limit ?? 1) || 1;
  const maxSize = Number(node.attrs.maxSize ?? 0) || 0;

  const [items, setItems] = useState<FileItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 卸载（占位块被替换 / 删除 / 换文档）时，把在飞的请求全部中断
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(
    () => () => itemsRef.current.forEach((it) => it.abort.abort()),
    [],
  );

  const patchItem = (id: string, partial: Partial<FileItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...partial } : it)),
    );
  };

  const uploadOne = async (file: File): Promise<string | null> => {
    if (maxSize > 0 && file.size > maxSize) {
      options.onError?.(
        new Error(
          `File size exceeds the maximum of ${formatFileSize(maxSize)}`,
        ),
      );
      return null;
    }
    if (!options.upload) {
      options.onError?.(new Error('Upload function is not defined'));
      return null;
    }

    const abort = new AbortController();
    const id = nextId();
    setItems((prev) => [
      ...prev,
      { id, file, progress: 0, status: 'uploading', abort },
    ]);

    try {
      const url = await options.upload(
        file,
        ({ progress }) => patchItem(id, { progress }),
        abort.signal,
      );
      if (!url) throw new Error('Upload returned no URL');
      if (abort.signal.aborted) return null;
      options.onSuccess?.(url);
      return url;
    } catch (err) {
      // abort 是用户主动移除，不算失败
      if (!abort.signal.aborted) {
        patchItem(id, { status: 'error', progress: 0 });
        options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
      return null;
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (limit > 0 && files.length > limit) {
      options.onError?.(
        new Error(`Maximum ${limit} file${limit === 1 ? '' : 's'} at a time`),
      );
      return;
    }
    // 逐文件配对结果：只对成功的做插入，且文件名跟着自己的 URL 走
    const settled = await Promise.all(
      files.map(async (file) => ({ file, url: await uploadOne(file) })),
    );
    const uploaded = settled.filter(
      (s): s is { file: File; url: string } => s.url != null,
    );
    if (uploaded.length === 0) return;

    const pos = getPos();
    if (typeof pos !== 'number') return;
    const imageType = options.type ?? 'image';
    const nodes = uploaded.map(({ file, url }) => {
      const alt = file.name.replace(/\.[^/.]+$/, '') || labels.fallbackAlt;
      return { type: imageType, attrs: { src: url, alt, title: alt } };
    });
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .insertContentAt(pos, nodes)
      .run();
    focusNextNode(editor);
  };

  const removeItem = (id: string) => {
    itemsRef.current.find((it) => it.id === id)?.abort.abort();
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const clearAll = () => {
    itemsRef.current.forEach((it) => it.abort.abort());
    setItems([]);
  };

  const openPicker = () => {
    if (!editor.isEditable || items.length > 0) return;
    const input = inputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) void uploadFiles(files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void uploadFiles(files);
  };

  const editable = editor.isEditable;
  const hasFiles = items.length > 0;
  const maxSizeMb = maxSize > 0 ? toMb(maxSize) : null;
  const dropzoneClass = [
    styles.dropzone,
    dragActive ? styles.dragActive : '',
    dragOver ? styles.dragOver : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <NodeViewWrapper
      className={styles.wrap}
      data-image-upload=""
      tabIndex={editable ? 0 : undefined}
      onClick={openPicker}
    >
      {!hasFiles ? (
        <div
          className={dropzoneClass}
          data-image-upload-dropzone=""
          role={editable ? 'button' : undefined}
          aria-label={
            editable ? `${labels.dropzoneClick}${labels.dropzoneRest}` : undefined
          }
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragActive(false);
              setDragOver(false);
            }
          }}
          onDrop={onDrop}
        >
          <span className={styles.fileShape} aria-hidden>
            <FileDocIcon />
            <FileCornerIcon />
            <span className={styles.fileBadge}>
              <CloudUploadIcon />
            </span>
          </span>
          <span className={styles.text}>
            <span className={styles.textMain}>
              <em className={styles.textEm}>{labels.dropzoneClick}</em>
              {labels.dropzoneRest}
            </span>
            <span className={styles.subtext}>
              {labels.dropzoneLimits(limit, maxSizeMb)}
            </span>
          </span>
        </div>
      ) : (
        <div className={styles.previews} data-image-upload-list="">
          {items.length > 1 && (
            <div className={styles.header}>
              <span>{labels.uploadingCount(items.length)}</span>
              <button
                type="button"
                className={styles.clearAll}
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
              >
                {labels.clearAll}
              </button>
            </div>
          )}
          {items.map((it) => (
            <div
              key={it.id}
              className={styles.preview}
              data-image-upload-item=""
            >
              {it.status === 'uploading' && (
                <div
                  className={styles.progress}
                  style={{ width: `${it.progress}%` }}
                  aria-hidden
                />
              )}
              <div className={styles.previewContent}>
                <span className={styles.fileInfo}>
                  <span className={styles.fileIcon} aria-hidden>
                    <CloudUploadIcon />
                  </span>
                  <span className={styles.details}>
                    <span className={styles.fileName}>{it.file.name}</span>
                    <span className={styles.subtext}>
                      {it.status === 'error'
                        ? labels.failed
                        : formatFileSize(it.file.size)}
                    </span>
                  </span>
                </span>
                <span className={styles.actions}>
                  {it.status === 'uploading' && (
                    <span className={styles.progressText}>
                      {Math.round(it.progress)}%
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.remove}
                    data-image-upload-remove=""
                    title={labels.remove}
                    aria-label={labels.remove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(it.id);
                    }}
                  >
                    <XIcon size={14} />
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={limit > 1}
          hidden
          onChange={onInputChange}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </NodeViewWrapper>
  );
}

/* 图标 path 取自 tiptap-ui-components（MIT）的 image-upload-node，见 THIRD_PARTY_LICENSES.md */

function CloudUploadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.1953 4.41771C10.3478 4.08499 9.43578 3.94949 8.5282 4.02147C7.62062 4.09345 6.74133 4.37102 5.95691 4.83316C5.1725 5.2953 4.50354 5.92989 4.00071 6.68886C3.49788 7.44783 3.17436 8.31128 3.05465 9.2138C2.93495 10.1163 3.0222 11.0343 3.3098 11.8981C3.5974 12.7619 4.07781 13.5489 4.71463 14.1995C5.10094 14.5942 5.09414 15.2274 4.69945 15.6137C4.30476 16 3.67163 15.9932 3.28532 15.5985C2.43622 14.731 1.79568 13.6816 1.41221 12.5299C1.02875 11.3781 0.91241 10.1542 1.07201 8.95084C1.23162 7.74748 1.66298 6.59621 2.33343 5.58425C3.00387 4.57229 3.89581 3.72617 4.9417 3.10998C5.98758 2.4938 7.15998 2.1237 8.37008 2.02773C9.58018 1.93176 10.7963 2.11243 11.9262 2.55605C13.0561 2.99968 14.0703 3.69462 14.8919 4.58825C15.5423 5.29573 16.0585 6.11304 16.4177 7.00002H17.4999C18.6799 6.99991 19.8288 7.37933 20.7766 8.08222C21.7245 8.78515 22.4212 9.7743 22.7637 10.9036C23.1062 12.0328 23.0765 13.2423 22.6788 14.3534C22.2812 15.4644 21.5367 16.4181 20.5554 17.0736C20.0962 17.3803 19.4752 17.2567 19.1684 16.7975C18.8617 16.3382 18.9853 15.7172 19.4445 15.4105C20.069 14.9934 20.5427 14.3865 20.7958 13.6794C21.0488 12.9724 21.0678 12.2027 20.8498 11.4841C20.6318 10.7655 20.1885 10.136 19.5853 9.6887C18.9821 9.24138 18.251 8.99993 17.5001 9.00002H15.71C15.2679 9.00002 14.8783 8.70973 14.7518 8.28611C14.4913 7.41374 14.0357 6.61208 13.4195 5.94186C12.8034 5.27164 12.0427 4.75043 11.1953 4.41771Z" />
      <path d="M11 14.4142V21C11 21.5523 11.4477 22 12 22C12.5523 22 13 21.5523 13 21V14.4142L15.2929 16.7071C15.6834 17.0976 16.3166 17.0976 16.7071 16.7071C17.0976 16.3166 17.0976 15.6834 16.7071 15.2929L12.7078 11.2936C12.7054 11.2912 12.703 11.2888 12.7005 11.2864C12.5208 11.1099 12.2746 11.0008 12.003 11L12 11L11.997 11C11.8625 11.0004 11.7343 11.0273 11.6172 11.0759C11.502 11.1236 11.3938 11.1937 11.2995 11.2864C11.297 11.2888 11.2946 11.2912 11.2922 11.2936L7.29289 15.2929C6.90237 15.6834 6.90237 16.3166 7.29289 16.7071C7.68342 17.0976 8.31658 17.0976 8.70711 16.7071L11 14.4142Z" />
    </svg>
  );
}

function FileDocIcon() {
  return (
    <svg
      width="43"
      height="57"
      viewBox="0 0 43 57"
      fill="none"
      aria-hidden
      className={styles.fileShapeDoc}
    >
      <path
        d="M0.75 10.75C0.75 5.64137 4.89137 1.5 10 1.5H32.3431C33.2051 1.5 34.0317 1.84241 34.6412 2.4519L40.2981 8.10876C40.9076 8.71825 41.25 9.5449 41.25 10.4069V46.75C41.25 51.8586 37.1086 56 32 56H10C4.89137 56 0.75 51.8586 0.75 46.75V10.75Z"
        fill="currentColor"
        fillOpacity="0.11"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FileCornerIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden
      className={styles.fileShapeCorner}
    >
      <path d="M0 0.75H0.343146C1.40401 0.75 2.42143 1.17143 3.17157 1.92157L8.82843 7.57843C9.57857 8.32857 10 9.34599 10 10.4069V10.75H4C1.79086 10.75 0 8.95914 0 6.75V0.75Z" />
    </svg>
  );
}
