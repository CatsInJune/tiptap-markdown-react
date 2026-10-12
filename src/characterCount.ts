/**
 * 本库自写的词数。传给 MIT 包 `@tiptap/extensions` 的 CharacterCount 当作
 * `wordCounter`，不复制该扩展的源码。
 *
 * 扩展默认按空格切分，一整段中文会被算成 1 个词。这里每个汉字算 1 个词，
 * 其余仍按空白切开，并丢掉纯标点。
 */
const CJK_IDEOGRAPH =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

export function countWords(text: string): number {
  let cjk = 0;
  const rest = text.replace(CJK_IDEOGRAPH, () => {
    cjk += 1;
    return ' ';
  });
  const words = rest
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  return cjk + words.length;
}
