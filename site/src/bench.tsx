/**
 * 性能基准页面（仅 bench.html 使用，不进站点）。
 *
 * 用法（由 site/scripts/perf-bench.mjs 驱动，query 参数）：
 *   ?chars=30000      目标正文字数
 *   ?variant=mixed    mixed=报告风混合结构 | paragraphs=纯段落 | headings=标题密集
 *   ?mode=lib         lib=dist 构建的 MarkdownWysiwygEditor（真实用户路径）
 *                     custom=直接引用 src 自组扩展（减法归因实验；@tiptap 解析到
 *                     根 node_modules，与 dist 包的 pnpm 副本隔离，互不冲突）
 *   ?toc=1            开目录（custom 模式用 noToc=1 表示关闭）
 *   ?cc=1             开字数统计条
 *   ?lean=1           lib 模式关掉所有可关 props（findReplace/paste/drop/…）
 *   custom 模式减法开关：noToc / noFind / noSlash / noTypo / noBlockDrag / noPaste /
 *   noDrop / noResize / noChart / noComments / noShortcut
 */
import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef } from 'react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import Typography from '@tiptap/extension-typography';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import { CharacterCount, Placeholder, Selection } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, type AnyExtension } from '@tiptap/react';
import { MarkdownWysiwygEditor as LibEditor } from 'tiptap-markdown-react';
import 'tiptap-markdown-react/style.css';
import contentStyles from '../../src/styles/content.module.css';
import { baseExtensions, lowlight } from '../../src/extensions';
import { ImageWithConfirmDelete } from '../../src/components/MarkdownWysiwygEditor';
import { ImportPlaceholder } from '../../src/importPlaceholder';
import { createChart } from '../../src/chart/createChart';
import { createCitationRef } from '../../src/createCitationRef';
import { CommentMark } from '../../src/commentAnchor/CommentMark';
import { commentAnchorExtension } from '../../src/commentAnchor/commentAnchorPlugin';
import { MarkdownPaste } from '../../src/markdownPaste';
import { MarkdownFileDrop } from '../../src/markdownFileDrop';
import { SlashMenu } from '../../src/slashMenu/SlashMenuExtension';
import { pendingAnchorExtension } from '../../src/pendingAnchor';
import { countWords } from '../../src/characterCount';
import { makeTocGetId } from '../../src/toc/tocSlug';
import { MarkdownEmoji } from '../../src/emoji/markdownEmoji';

type Variant = 'mixed' | 'paragraphs' | 'headings';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') ?? 'lib';
const variant = (params.get('variant') ?? 'mixed') as Variant;
const targetChars = Number(params.get('chars') ?? 10000);
const contentFormat = params.get('content') ?? 'markdown'; // markdown | json（对照：跳过解析层）
const useToc = params.get('toc') === '1';
const useCount = params.get('cc') === '1';
const lean = params.get('lean') === '1';
const off = (name: string) => params.get(name) === '1' || lean;
const fix = params.get('fix') === '1';

/**
 * 修复实验：官方 Emoji.addStorage 每次访问都重算（几千 emoji 的去重+查找），
 * tiptap 的 storage 是无缓存 getter，事务路径上会被反复触发。缓存化后只算一次。
 */
let emojiStorageCache: Record<string, unknown> | null = null;
const MarkdownEmojiFixed = MarkdownEmoji.extend({
  addStorage() {
    if (!emojiStorageCache) {
      emojiStorageCache =
        (MarkdownEmoji.config.addStorage?.call(this) as Record<string, unknown>) ?? {};
    }
    return emojiStorageCache;
  },
});

/* ------------------------------ 大文档生成器 ------------------------------ */

const PARAS = [
  '宏观经济层面，制造业采购经理指数连续第三个月位于扩张区间，生产端修复快于需求端的格局仍未改变，企业利润向下游传导存在明显时滞。政策端对设备更新与消费品以旧换新的支持力度持续加大，对相关产业链的拉动效果正在逐步显现。',
  '从行业格局看，头部企业凭借规模效应与渠道优势持续扩大市场份额，中小企业则在细分赛道寻找差异化空间。价格战对毛利率的侵蚀尚未见底，行业出清仍需时间，现金流管理能力成为这一阶段竞争的关键变量。',
  '海外市场的需求呈现出结构性分化：欧美补库周期带动耐用品订单回暖，但地缘扰动推升了航运成本与交付周期；新兴市场保持较高增速，汇率波动对以美元计价收入的企业构成汇兑损益的不确定性。',
  '技术路线上，下一代产品的迭代方向聚焦于能耗、可靠性与自动化水平的综合提升。供应链本土化比例提高后，关键物料的交付周期缩短，但新增产能的爬坡进度仍落后于订单增长的斜率。',
  '财务数据方面，本季度营业收入同比增长，但增速环比有所回落；销售费用率与管理费用率合计下降，研发投入维持高强度。经营性现金流净额为正，应收账款周转天数同比改善，存货水位处于可控区间。',
  '风险提示部分需要关注三点：一是下游客户资本开支意愿不及预期的风险；二是原材料价格快速上行挤压利润空间的风险；三是海外政策与关税变化带来的外需波动风险。上述因素均可能对盈利预测产生方向性影响。',
];

const LIST_ITEMS = [
  '产能利用率维持在合理区间，冷启动成本可摊薄',
  '渠道库存去化接近尾声，经销商回款周期缩短',
  '新产品导入节奏符合预期，良率爬坡快于上一代',
  '重点客户订单可见度延伸至下一年度第一季度',
  '原材料长协覆盖率提升，价格波动敞口收窄',
];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成目标字数（中文字符数）的 markdown 文档。 */
function generateDoc(chars: number, docVariant: Variant): string {
  const rand = mulberry(20261030);
  const out: string[] = [];
  let count = 0;
  let chapter = 0;

  out.push('# 压测文档：行业景气度跟踪报告');
  count += 15;

  while (count < chars) {
    chapter += 1;
    if (docVariant !== 'paragraphs') {
      out.push(`## 第${chapter}章 行业动态与经营情况`);
      count += 16;
      if (docVariant === 'headings' && chapter % 3 === 0) {
        out.push(`### ${chapter}.1 关键指标速览`);
        out.push(`### ${chapter}.2 边际变化解读`);
        count += 24;
      }
    }
    const paras = docVariant === 'headings' ? 2 : 3;
    for (let i = 0; i < paras; i += 1) {
      const base = PARAS[Math.floor(rand() * PARAS.length)];
      // 富文本点缀：每段随机加粗一段 / 行内代码 / 高亮
      let para = base;
      if (rand() < 0.5) para = para.replace(/(\S{4,6})/, '**$1**');
      if (rand() < 0.3) para = para.slice(0, 12) + '`KPI_01`' + para.slice(12);
      if (rand() < 0.2) para = para.slice(0, 20) + '==重点==' + para.slice(20);
      out.push(para);
      count += base.length;
    }
    if (docVariant !== 'paragraphs' && count < chars) {
      out.push('- ' + LIST_ITEMS[chapter % LIST_ITEMS.length]);
      out.push('- ' + LIST_ITEMS[(chapter + 2) % LIST_ITEMS.length]);
      count += 40;
    }
    if (docVariant === 'mixed' && chapter % 3 === 0 && count < chars) {
      out.push(
        '| 指标 | 本期 | 上期 | 同比 |\n| --- | --- | --- | --- |\n| 产能利用率 | 86% | 82% | +4pct |\n| 库存周转 | 45天 | 52天 | -7天 |\n| 新签订单 | 12.4亿 | 10.1亿 | +22% |',
      );
      count += 60;
    }
    if (docVariant === 'mixed' && chapter % 5 === 0 && count < chars) {
      out.push(
        '- [ ] 核对财务口径数据\n- [ ] 与业务部门确认产能计划\n- [x] 更新同业对比表\n- [x] 复核风险提示段落',
      );
      count += 50;
    }
    if (docVariant === 'mixed' && chapter % 4 === 0 && count < chars) {
      out.push('> 分析师提示：本节观点基于公开信息整理，不构成投资建议。数据截至报告发布日，后续如有重大变化将另行更新。');
      count += 55;
    }
    if (docVariant === 'mixed' && chapter % 8 === 0 && count < chars) {
      out.push(
        '```python\n# 示例：季度环比增速计算\ndef qoq(current, previous):\n    return (current - previous) / previous * 100\n\nprint(f"QoQ: {qoq(12.4, 10.1):.1f}%")\n```',
      );
      count += 80;
    }
  }
  return out.join('\n\n');
}

/* -------------------------------- 埋点基建 -------------------------------- */

let tNav = performance.now();
const marks: Record<string, number> = {};
const mark = (name: string) => {
  marks[name] = performance.now() - tNav;
};
/** 计时基线重置到「文档数据就绪」：markdown 模式在字符串生成后、json 模式在 fetch 后调用。 */
function resetTimingBaseline() {
  tNav = performance.now();
  for (const key of Object.keys(marks)) delete marks[key];
}

const longTasks: { duration: number; startTime: number }[] = [];
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longTasks.push({ duration: entry.duration, startTime: entry.startTime });
    }
  }).observe({ entryTypes: ['longtask'] });
} catch {
  /* longtask 不可用时忽略 */
}

/* -------------------------------- 渲染入口 -------------------------------- */

function LibMode() {
  const ref = useRef<HTMLDivElement>(null);
  const initialMarkdown = useMemo(
    () => generateDoc(targetChars, variant),
    [targetChars, variant],
  );

  useEffect(() => {
    (window as any).__benchReady = true;
    mark('editor-ready');
  }, []);

  return (
    <div ref={ref} style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <LibEditor
        ref={(handle: any) => {
          (window as any).__handle = handle;
        }}
        locale="zh"
        initialMarkdown={initialMarkdown}
        documentTitle="压测文档"
        toc={useToc}
        tocContainer={() => ref.current}
        characterCount={useCount}
        placeholder="输入正文…"
        {...(lean
          ? {
              typography: false,
              slashMenu: false,
              emojiSuggestion: false,
              blockDrag: false,
              findReplace: false,
              markdownPaste: false,
              markdownFileDrop: false,
              shortcutPanel: false,
              imageResize: false,
            }
          : {})}
      />
    </div>
  );
}

/** custom 模式：直接引用 src 自组扩展，支持逐个减扩展。扩展集复刻 lib 默认档。 */
function CustomMode({
  initialContent,
}: {
  initialContent: string | Record<string, unknown>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const extensions = useMemo(() => {
    const exts: AnyExtension[] = [
      ...baseExtensions.map((ext) =>
        fix && ext.name === 'emoji' ? MarkdownEmojiFixed : ext,
      ),
      CodeBlockLowlight.configure({ lowlight }),
      ImageWithConfirmDelete.configure({
        inline: false,
        ...(off('noResize')
          ? {}
          : {
              resize: {
                enabled: true,
                alwaysPreserveAspectRatio: true,
                directions: ['left', 'right'] as any,
                minWidth: 80,
                minHeight: 80,
              },
            }),
      }),
      ImportPlaceholder,
      Placeholder.configure({ placeholder: '输入正文…' }),
      createChart({ editable: false }),
      createCitationRef({ renderCitation: undefined }),
      CommentMark,
      commentAnchorExtension({ showGutter: true, interactive: true }),
      Markdown,
      pendingAnchorExtension,
      Selection.configure({ className: 'tmr-blur-selection' }),
      FindAndReplace.configure({ injectCSS: false, searchDebounceMs: 0 }),
    ];
    if (useCount) {
      exts.push(CharacterCount.configure({ wordCounter: countWords }));
    }
    if (!off('noToc')) {
      exts.push(
        TableOfContents.configure({
          getId: makeTocGetId(),
          onUpdate: () => {},
        }),
      );
    }
    if (!off('noPaste')) exts.push(MarkdownPaste);
    if (!off('noDrop')) exts.push(MarkdownFileDrop);
    if (!off('noSlash')) exts.push(SlashMenu);
    if (!off('noTypo')) exts.push(Typography);
    return exts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    extensions,
    content: initialContent,
    ...(typeof initialContent === 'string'
      ? { contentType: 'markdown' as const }
      : {}),
    editable: true,
    immediatelyRender: true,
    editorProps: {
      attributes: { class: contentStyles.editorContent },
    },
  });

  useEffect(() => {
    (window as any).__benchReady = true;
    (window as any).__editor = editor;
    mark('editor-ready');
  }, [editor]);

  return (
    <div ref={ref} style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <EditorContent editor={editor} />
    </div>
  );
}

// 暴露给驱动脚本
(window as any).__bench = {
  getEditor: () =>
    mode === 'lib'
      ? ((window as any).__handle?.getEditor?.() ?? null)
      : ((window as any).__editor ?? null),
  marks,
  longTasks,
  docChars: targetChars,
  variant,
  mode,
};

/** 入口：markdown 模式同步生成字符串；json 模式先取预转换的 doc JSON（对照实验用）。 */
async function bootstrap() {
  let content: string | Record<string, unknown> = generateDoc(targetChars, variant);
  if (contentFormat === 'json') {
    const res = await fetch(`/bench-fixtures/doc-${targetChars}-${variant}.json`);
    if (!res.ok) throw new Error(`fixture 加载失败: ${res.status}`);
    content = await res.json();
  }
  // 计时基线重置到「数据就绪」：对比的是装载→编辑器可用，不含数据准备本身
  resetTimingBaseline();
  mark('data-ready');
  const root = createRoot(document.getElementById('root')!);
  mark('react-before-mount');
  root.render(mode === 'lib' ? <LibMode /> : <CustomMode initialContent={content} />);
  mark('react-after-mount');
}
bootstrap();
