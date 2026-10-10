/**
 * 站点文案字典。英文原文（源码里的字符串字面量）即 key，查表翻译；
 * 缺 key 优雅回退英文原文。反过来，站点里原本就写死的中文由
 * EN_STRINGS 反向映射到英文。
 */

export const ZH_STRINGS: Record<string, string> = {
  // ── 顶部导航 / 侧栏分组 ──
  Home: '首页',
  Components: '组件',
  Demo: '演示',
  Editing: '编辑',
  Reading: '阅读',
  Navigation: '导航',
  Theming: '主题',
  'The toolbar&#39;s link button opens a small popover: type an address, apply it, open it in a new window, or remove the link. Opening it with the caret inside a link prefills that link&#39;s href — editing a URL no longer means deleting and re-adding it. The logic follows the official link-popover component (MIT); the chrome is this library&#39;s own, themed with --tmr-*. It replaces window.prompt, which could not be edited, could tell you nothing about a rejected address, and is unavailable in Electron and some WebViews.':
    '工具栏的链接按钮打开一个小浮层：输地址、应用、在新窗口打开、或移除链接。光标在链接里打开时会把它的 href 预填进去——改地址不必再「先删后加」。逻辑照官方 link-popover 组件（MIT）搬，外壳是本库自绘、走 --tmr-* 主题。它替换了 window.prompt：那个既不能编辑已有链接，地址被拒时也毫无反馈，而且在 Electron 与部分 WebView 里根本不可用。',
  'Prefills the current href when the caret is inside a link': '光标在链接里时预填当前 href',
  'Changes apply to the whole link (extendMarkRange), not just the caret segment': '改动作用于整条链接（extendMarkRange），而不是光标那一段',
  'Empty selection with no link: the address is inserted as its own text': '空选区且不在链接里：地址本身作为文字插入',
  'A rejected address (javascript:, …) keeps the popover open and marks the field instead of failing silently': '地址被拒（javascript: 等）时不关浮层、把输入框标出来，而不是默默什么都不发生',
  'Bare domains and host:port take the configured protocol, so markdown exports an absolute link': '裸域名与 主机:端口 会补上扩展配的协议，导出的 markdown 是绝对链接',
  'Open in a new window goes through a protocol allowlist plus noopener,noreferrer': '「在新窗口打开」过协议白名单，并带 noopener,noreferrer',
  'IME-safe Enter; stable data-link-* selectors for host CSS': '输入法安全（组合中的回车不算应用）；给宿主 CSS 稳定的 data-link-* 选择器',
  'Headless: applyLink / removeLink / normalizeLinkHref / sanitizeLinkUrl are exported': '无头用法：applyLink / removeLink / normalizeLinkHref / sanitizeLinkUrl 都已导出',
  'Link button in the toolbar': '工具栏里的链接按钮',
  'Put the caret inside a link and click the link icon — the address is prefilled and the whole link is retargeted.': '把光标放进一条链接再点链接图标——地址会被预填，改的是整条链接。',
  'Tiptap Editor instance (required)': 'Tiptap Editor 实例（必传）',
  'Your own trigger element — Radix asChild takes over its click / ref / aria': '宿主自己的触发器元素——Radix 的 asChild 会接管它的点击 / ref / aria',
  'Popover text: field placeholder, apply / open / remove, invalid hint': '浮层文案：输入框占位、应用 / 打开 / 移除、地址非法提示',
  'Extra class / inline style on the panel (placement stays with Radix)': '面板上的附加 class / 内联样式（落点仍由 Radix 决定）',
  'Normalise and apply an address over the whole link / selection. false = the editor rejected it': '规范化地址并套到整条链接 / 选区上。返回 false = 编辑器拒了',
  'Strip the link from the whole range without letting autolink add it back': '整条摘掉链接，并且挡住自动链接加回来',
  'Bare domains and host:port take the configured protocol; site-relative, #anchor and mailto: stay as typed': '裸域名与 主机:端口 补上配置的协议；站内相对地址、#锚点与 mailto: 原样保留',
  'Absolute URL, or "#" when the protocol is not openable (javascript:, data:, …)': '返回绝对地址；协议不可打开（javascript:、data: 等）时返回 "#"',
  'data-link-popover / -field / -action / -invalid': 'data-link-popover / -field / -action / -invalid',
  'Stable selectors for host CSS (internals are hashed CSS-module classes)': '给宿主 CSS 的稳定选择器（内部是哈希过的 CSS Modules 类名）',
  'Find & replace': '查找替换',
  LinkPopover: '链接浮层',
  Internationalization: '国际化',
  'Comment Anchors': '评论锚点',
  'Citations [^n]': '引用标注 [^n]',
  'Paste / Drop / Import': '粘贴 / 拖放 / 导入',
  'Toolbar + Image': '工具栏 + 图片',
  'Code Block': '代码块',
  Equations: '公式',
  Charts: '图表',
  'Client Preview': '客户端预览',
  'SSR equations': 'SSR 公式',
  'SSR charts': 'SSR 图表',
  'SSR + citations': 'SSR + 引用标注',
  'Markdown Output': 'Markdown 输出',
  'Table of Contents': '目录面板',
  'CSS Variables': 'CSS 变量',
  'WYSIWYG Editor': '所见即所得编辑器',

  // ── 页头 / 区块 ──
  'On this page': '本页目录',
  'Client exports': '客户端导出',
  'Server exports': '服务端导出',
  Live: '实时演示',
  Why: '为什么',
  'Quick start': '快速上手',
  'Three ways to render': '三种渲染方式',
  '1. Editor + toolbar': '1. 编辑器 + 工具栏',
  '2. Client preview': '2. 客户端预览',
  '3. Server reader (SEO)': '3. 服务端阅读页（SEO）',
  'Browse components →': '浏览组件 →',
  'zero UI framework': '零 UI 框架',

  // ── 首页特性卡片 ──
  'Markdown in/out': 'Markdown 进出',
  'Author and export as Markdown. getHTML() and getJSON() available too.':
    '以 Markdown 创作与导出，getHTML() 与 getJSON() 同样可用。',
  'Opinionated UI': '自带主张的 UI',
  'Toolbar, color palette, code blocks, TOC — styled out of the box, zero UI framework.':
    '工具栏、调色板、代码块、目录——开箱即用的样式，零 UI 框架依赖。',
  'Editor + Preview + SSR': '编辑器 + 预览 + SSR',
  'Client editor, live preview, and server-side renderReportHtml for SEO pages.':
    '客户端编辑器、实时预览，以及面向 SEO 页面的服务端 renderReportHtml。',
  'Stable TOC anchors': '稳定的目录锚点',
  'Shared slug logic between editor, preview, and published reader.':
    '编辑器、预览与发布阅读页共用同一套 slug 锚点逻辑。',
  Themeable: '可主题化',
  'All colors and fonts exposed as --tmr-* CSS variables.':
    '所有颜色与字体都暴露为 --tmr-* CSS 变量。',
  'Citation pills': '引用标注',
  'Parse [^n] into mid-line circular markers; hosts supply sources + optional Popover.':
    '把 [^n] 解析成行内圆形标注，数据源与 Popover 由宿主提供。',
  'KaTeX equations': 'KaTeX 公式',
  'Toolbar insert; click to edit in place. Markdown uses $$; single $ is always a dollar sign.':
    '工具栏插入，点击原位编辑。Markdown 使用 $$，单个 $ 永远是美元符号。',
  'Chart.js via HTML comment + GFM table. SSR placeholder + client hydrate.':
    'Chart.js 经 HTML 注释 + GFM 表格驱动，SSR 占位 + 客户端水合。',

  // ── 组件页页头 ──
  'Batteries-included React components for editing, reading, and navigating Markdown content. Each ships with opinionated styles and Radix-based UI — no UI framework.':
    '用于编辑、阅读与导航 Markdown 内容的全家桶 React 组件。每个组件都带自成体系的样式与基于 Radix 的 UI——不依赖任何 UI 框架。',

  // ── 组件章节描述 ──
  'The core WYSIWYG editor. Markdown in, markdown out via ref methods. Emits TOC updates through onTocChange.':
    '核心所见即所得编辑器。Markdown 进、Markdown 出（经 ref 方法），并通过 onTocChange 实时上报目录。',
  'Full rich-text editing with Markdown serialization': '完整的富文本编辑 + Markdown 序列化',
  'Ref API: getMarkdown(), getHTML(), getJSON(), getEditor()': 'Ref API：getMarkdown()、getHTML()、getJSON()、getEditor()',
  'onTocChange for live table-of-contents sync': 'onTocChange 实时同步目录',
  'extraExtensions hook for custom Tiptap nodes': 'extraExtensions 钩子挂自定义 Tiptap 节点',
  'Basic editor': '基础编辑器',
  'Toolbar optional — wire EditorToolbar separately.': '工具栏可选——单独接 EditorToolbar 即可。',

  'Cmd/Ctrl+F while the editor has focus opens a floating bar: the match counter sits inside the search field, navigation wraps around, match-case / whole-word toggles, replace and replace-all. Regex (RE2) stays available through the extension\'s command, without a button. Matching, highlighting and replacement come from the official @tiptap/extension-find-and-replace — the bar is the library\'s own UI. Search scope is textblocks: paragraphs, headings, list items, table cells and code blocks; text inside node attributes (equations, chart data, image alt, citation titles) is not searched. Matches may span marks inside one block but never cross blocks. Esc closes the bar, clears highlights and returns focus.':
    '编辑器持有焦点时按 Cmd/Ctrl+F 弹出浮动条：计数嵌在搜索框内、循环跳转、区分大小写 / 全词匹配开关、单处替换与全部替换。正则（RE2）仍可经扩展命令使用，但没有按钮。匹配、高亮与替换来自官方 @tiptap/extension-find-and-replace——浮动条是库自绘的 UI。搜索范围是文本块：段落、标题、列表项、单元格与代码块；节点属性里的文本（公式、图表数据、图片 alt、引用标题）不参与搜索。匹配可以跨同一块内的 mark，但绝不跨块。Esc 关闭浮动条、清除高亮并把焦点还给编辑器。',
  'Cmd/Ctrl+F opens; Esc closes and restores focus': 'Cmd/Ctrl+F 打开；Esc 关闭并归还焦点',
  'Esc also closes with focus in the document, and is consumed (a host drawer wrapping the bar stays open)': '焦点在正文里 Esc 也能关，且这次按键被吃掉（宿主把条子包在自己的抽屉里时不会被一起关）',
  'Toolbar magnifier toggles the bar; openFind() keeps the refocus-and-select feel': '工具栏放大镜是开关；openFind() 保留「再按一次重聚焦全选」的手感',
  'Counter with wrap-around next / previous': '计数 + 循环的上一处 / 下一处',
  'Match case and whole word toggles; counter sits inside the search field': '区分大小写与全词匹配开关；计数嵌在搜索框内',
  'Enter that commits an IME candidate never jumps or replaces': '提交输入法候选词的 Enter 不会触发跳转或替换',
  'Stable data-find-* selectors for host CSS (bar internals are hashed CSS-module classes)': '给宿主 CSS 的稳定 data-find-* 选择器（浮动条内部是哈希过的 CSS Modules 类名）',
  'Regex (RE2, no lookarounds) stays available via setUseRegex, no button': '正则（RE2，不支持环视）经 setUseRegex 仍可用，无按钮',
  'Replace and replace-all — replace-all is a single undo step': '单处替换与全部替换——全部替换是单步撤销',
  'Find-only on read-only editors; labels via findLabels': '只读编辑器仅查找；文案经 findLabels 注入',
  'Headless: drive it with editor.commands.setSearchTerm / replaceAll': '无头用法：用 editor.commands.setSearchTerm / replaceAll 驱动',
  'Floating find bar': '浮动查找条',
  'Doc ends with a code block on purpose — that is the TrailingNode edge case runFindCommand absorbs.':
    '文档结尾故意放了一个代码块——这正是 runFindCommand 吸收的 TrailingNode 边界情况。',
  'Bar in a host container': '挂进宿主容器的浮动条',
  'findBarContainer: the library keeps the shortcut and open state, the bar mounts into a container you own (the popup-container pattern) — positioning is your CSS.':
    'findBarContainer：快捷键与开合状态仍归库，浮动条挂进你自己的容器（popup container 模式）——定位由你的 CSS 负责。',
  'Host-placed bar': '宿主自摆的浮动条',
  'findBar={false}: the editor keeps the extension but renders no bar — placement, stacking and looks belong to the host.':
    'findBar={false}：编辑器保留扩展但不出条子——摆位、层叠与外观全归宿主。',

  'Each component takes a Partial<XLabels> merged over built-in English defaults — no global locale, no provider. A host ships one object per language and passes it down; switching is picking a different object. Toolbar / TOC / palette / find bar re-render live because they merge at render time; code-block labels are written into the extension options when the editor is constructed, so they only change after a remount — feed the current markdown back via getMarkdown() (initialMarkdown is init-only) so nothing is lost.':
    '每个组件收一份 Partial<XLabels>，与内置英文默认合并——没有全局 locale，也没有 Provider。宿主为每种语言准备一个对象传下去；切换就是换一个对象。工具栏 / 目录 / 调色板 / 查找条在渲染期合并，切换即生效；代码块文案在编辑器构造时写进扩展选项，须重建编辑器才生效——先把当前内容经 getMarkdown() 取回（initialMarkdown 是 init-only），不丢任何编辑。',
  'Per-component Partial<XLabels> merged with English defaults': '按组件注入 Partial<XLabels>，与英文默认合并',
  'Unknown keys fall back to defaults — override only what you need': '未知键回退默认——只覆盖需要的文案',
  'Toolbar / TOC / palette / find bar switch live on re-render': '工具栏 / 目录 / 调色板 / 查找条重渲染即切换',
  'codeBlockLabels follow the editor instance: remount to switch language': 'codeBlockLabels 跟随编辑器实例：切换语言需重建',
  'No locale bundle shipped: the host owns the text': '不内置 locale 包：文案归宿主所有',
  'Chinese ⇄ English': '中文 ⇄ English',
  'Switching remounts the editor; the markdown is read back first so unsaved edits survive.':
    '切换会重建编辑器；先取回 markdown，未保存的编辑不会丢。',

  'Styled formatting toolbar. Image upload button appears only when onImageUpload is provided.':
    '带样式的格式化工具栏。传入 onImageUpload 时才出现图片上传按钮。',
  'Headings, lists, tables, links, colors, alignment': '标题、列表、表格、链接、颜色、对齐',
  'More menu: code block, equations, table, import markdown': '更多菜单：代码块、公式、表格、导入 Markdown',
  'Radix Popover / DropdownMenu — no native selects': 'Radix Popover / DropdownMenu——不用原生 select',
  'extraToolbarItems for custom More-menu entries': 'extraToolbarItems 注入自定义更多菜单项',
  'Partial ToolbarLabels for i18n': 'Partial ToolbarLabels 做国际化',
  'Toolbar with image upload': '带图片上传的工具栏',

  'KaTeX inline and block math. Insert from the toolbar More menu; click a formula to edit LaTeX in place (the document formula updates live; the popover is input-only). Typing $ / $$ never converts — dollar amounts stay text. Markdown round-trip uses $$.':
    'KaTeX 行内与块级公式。从工具栏「更多」菜单插入；点击公式原位编辑 LaTeX（文档内公式实时更新，弹层只做输入）。键入 $ / $$ 永不转换——金额永远是文本。Markdown 往返使用 $$。',
  'More → Inline equation / Block equation (no keyboard shortcut)': '更多 → 行内公式 / 块级公式（无快捷键）',
  'Click formula → in-place KaTeX + LaTeX input below (Notion-style)': '点击公式 → 原位 KaTeX + 下方 LaTeX 输入（Notion 式）',
  'Inline $$x$$ vs block newline-wrapped $$; single $ is never math': '行内 $$x$$ 与换行包裹的块级 $$；单个 $ 永远不是公式',
  'SSR renderReportHtml emits .katex HTML (no NodeView required)': 'SSR renderReportHtml 输出 .katex HTML（无需 NodeView）',
  'Insert and edit': '插入与编辑',
  'Use More → Inline / Block equation. Click a rendered formula: it stays in the page and updates as you type.':
    '用「更多 → 行内 / 块级公式」插入。点击已渲染的公式：它留在页面里，随输入实时更新。',

  'Data charts: HTML comment JSON + GFM table. Chart.js renders in the editor, preview, and reading page (SSR placeholder → client hydrate). Click a chart to edit config JSON and table source.':
    '数据图表：HTML 注释 JSON + GFM 表格。Chart.js 在编辑器、预览与阅读页渲染（SSR 占位 → 客户端水合）。点击图表可编辑配置 JSON 与表格数据。',
  'Author form: <!-- {"chartType":"line","x":"...","y":"..."} --> + table': '创作形态：<!-- {"chartType":"line","x":"...","y":"..."} --> + 表格',
  'MVP types: line / bar / column / pie / donut / area; multi-config → tabs': 'MVP 类型：line / bar / column / pie / donut / area；多配置 → 页签',
  'SSR emits data-type=chart placeholder; hydrate via ReportContentWithCharts': 'SSR 输出 data-type=chart 占位；经 ReportContentWithCharts 水合',
  'Loose x/y column matching (e.g. 客单价 vs 客单价(元))': '宽松的 x/y 列匹配（如 客单价 vs 客单价(元)）',
  Editor: '编辑器',
  'Click a chart to edit JSON + Markdown table.': '点击图表编辑 JSON + Markdown 表格。',
  'SSR + hydrate': 'SSR + 水合',
  'renderReportHtml placeholder, then Chart.js on the client.': 'renderReportHtml 占位，客户端再由 Chart.js 渲染。',
  'Streaming rows': '流式追加行',
  'Table rows append; chart updates in place.': '表格行追加，图表原位更新。',
  'line | bar | column | pie | donut | area': 'line | bar | column | pie | donut | area',
  'Column names (loose match against headers)': '列名（与表头宽松匹配）',
  'Chrome around the canvas': '画布周围的装饰信息',

  'Edit-session review annotations: map decoded comment segments onto text ranges as marks, render a block-left gutter, and report clicks. Read-only preview never renders comments; getMarkdown() strips all marks.':
    '编辑期审阅标注：把解码后的评论 segments 映射为文本区间 mark，渲染块左缘 gutter，并上报点击。只读预览不渲染评论；getMarkdown() 剥掉全部 mark。',
  'Segments → text-range marks (commentMapper + overlap merge)': 'segments → 文本区间 mark（commentMapper + 重叠合并）',
  'Overlapping comments merge into data-comment-ids': '重叠评论合并进 data-comment-ids',
  'Gutter bubbles + active mark/block emphasis (--tmr-* variables)': 'gutter 气泡 + 激活 mark / 块强调（--tmr-* 变量）',
  'focusComment / nextComment ref methods; paste/drop strips marks': 'focusComment / nextComment ref 方法；粘贴 / 拖放剥离 mark',
  'Edit-session review': '编辑期审阅',
  'Click a highlighted span (or gutter) to open CommentPopover; sidebar buttons focus via ref methods. MarkdownPreview ignores comments.':
    '点击高亮片段（或 gutter）打开 CommentPopover；侧栏按钮经 ref 方法聚焦。MarkdownPreview 忽略评论。',

  'Read-only client-side preview using the same extensions and styles as the editor.':
    '只读的客户端预览，与编辑器共用同一套扩展和样式。',
  'Same rendering pipeline as the editor': '与编辑器同一渲染管线',
  'Syntax highlighting via lowlight': 'lowlight 语法高亮',
  'Stable heading anchors for deep links': '稳定的标题锚点，可深链',
  'Citation pills via [^n] + optional sources': '经 [^n] 的引用标注 + 可选 sources',

  'Inline circular citation pills aligned with body text (not super/subscript). Library renders the marker; hosts mount Popover via renderCitation NodeView slot.':
    '行内圆形引用标注，与正文对齐（非上下标）。库只负责渲染标记；宿主经 renderCitation NodeView 插槽挂 Popover。',
  'Parses [^n] via CitationRef markdownTokenizer': '经 CitationRef markdownTokenizer 解析 [^n]',
  'Mid-line accent-wash circular pills (CSS .citation-ref)': '行内品牌色圆形标注（CSS .citation-ref）',
  'renderCitation slot: wrap defaultDom with host Popover': 'renderCitation 插槽：用宿主 Popover 包住 defaultDom',
  'Data source lookup is 100% host-owned': '数据源查询 100% 归宿主',
  'Citation pills + host Popover': '引用标注 + 宿主 Popover',
  'Click a pill — the popover here is built on Radix; swap in your own implementation the same way.':
    '点击圆标——本演示的 Popover 用 Radix 实现；宿主可以同样挂自己的实现。',

  'RSC-safe static HTML reader. Pass html from renderReportHtml() — no client JavaScript required.':
    'RSC 安全的静态 HTML 阅读器。传入 renderReportHtml() 的 html——不需要任何客户端 JS。',
  'Pure HTML injection with editorContent styles': '纯 HTML 注入 + editorContent 样式',
  'Also exported from tiptap-markdown-react/server': '也从 tiptap-markdown-react/server 导出',
  'Ideal for published articles and SEO pages': '适合发布文章与 SEO 页面',
  'Static reader': '静态阅读器',
  'Pre-rendered HTML sample — same output as renderReportHtml().': '预渲染的 HTML 样例——与 renderReportHtml() 输出一致。',

  'Sidebar table of contents. Consumes TocItem[] from onTocChange or extractToc.':
    '侧栏目录面板。消费 onTocChange 或 extractToc 给出的 TocItem[]。',
  'Active item highlighting via activeId': 'activeId 高亮当前项',
  'Locked sections (e.g. paywalled content)': '锁定章节（如付费内容）',
  'Click handler with locked-item guard': '点击回调，锁定项被拦截',
  'TOC panel': '目录面板',

  '10×6 color matrix used inside EditorToolbar. Can be used standalone for custom color pickers.':
    'EditorToolbar 内用的 10×6 颜色矩阵。也可独立用于自定义取色器。',
  'None row to clear color': '「无」一行用于清除颜色',
  'THEME brand swatches': 'THEME 品牌色板',
  'Accessible grid with checkmark on active color': '带无障碍语义的网格，当前色打勾',

  'Server-only function. Renders markdown to HTML + TOC without a browser or Tiptap Editor instance.':
    '仅服务端可用的函数。不需要浏览器或 Tiptap Editor 实例，把 markdown 渲染成 HTML + 目录。',
  'Pure function — runs in Server Components / ISR': '纯函数——可跑在 Server Components / ISR',
  'Stable slug anchors via makeTocGetId': '经 makeTocGetId 生成稳定 slug 锚点',
  'Returns { html, toc } for ReportContent + TocPanel': '返回 { html, toc }，配合 ReportContent + TocPanel',

  // ── 演示页 ──
  'Interactive examples grouped by scenario. Each block is a live preview you can edit and inspect.':
    '按场景分组的交互示例。每个块都是可编辑、可检查的实时预览。',

  // ── API 表（EDITOR_API） ──
  'Initial markdown content': '初始 markdown 内容',
  'Read-only mode: same extensions/NodeViews/styles as editing; interactive controls collapse. Comments ignored when false':
    '只读模式：与编辑态同一套扩展 / NodeView / 样式，交互件自动收起；为 false 时忽略评论',
  'Initial citation sources for [^n] (url/title on citationRef). Init-only': '[^n] 的初始引用来源（写入 citationRef 的 url/title）。仅初始化生效',
  'NodeView slot to wrap citation pills (Popover etc.). Init-only': '包住引用圆标的 NodeView 插槽（Popover 等）。仅初始化生效',
  'Empty-state placeholder': '空态占位文案',
  'Called when editor is ready / destroyed': '编辑器就绪 / 销毁时回调',
  'TOC updates when headings change': '标题增删改时上报目录',
  'Auto-convert pasted markdown text (Shift+paste keeps plain text). Init-only': '自动转换粘贴的 markdown 文本（Shift+粘贴保持纯文本）。仅初始化生效',
  'Drop / paste .md files to insert parsed content. Init-only': '拖入 / 粘贴 .md 文件插入解析后的内容。仅初始化生效',
  'Additional Tiptap extensions': '追加的 Tiptap 扩展',
  'Code block NodeView labels': '代码块 NodeView 文案',
  'Find & replace: registers @tiptap/extension-find-and-replace and renders the floating bar': '查找替换：注册官方 @tiptap/extension-find-and-replace 并渲染浮动条',
  'Render the bar inside the editor; false hands placement to the host (render <FindReplaceBar> yourself)': '由编辑器渲染浮动条；传 false 把摆位交给宿主（自己渲染 <FindReplaceBar>）',
  'Mount the bar into a container you own (popup-container pattern); null falls back to the in-editor bar': '把浮动条挂进你自己的容器（popup container 模式）；null 回落编辑器内浮动条',
  'Where the library-rendered bar sits in its context (editor, or your container)': '库渲染的浮动条在其上下文（编辑器或你的容器）中的落点',
  'Take over Cmd/Ctrl+F while the editor has focus; false keeps native find (use handle.openFind())': '编辑器持有焦点时接管 Cmd/Ctrl+F；传 false 保留原生查找（用 handle.openFind()）',
  'Find & replace bar labels': '查找替换浮动条文案',
  'Fired when the bar actually shows or hides — drives an external entry such as the toolbar magnifier': '浮动条真的显示 / 收起时回调——用来驱动别处的入口（如工具栏放大镜）',
  'Extra class on scroll container': '滚动容器上的附加 class',
  'Type / (line start or after whitespace) to open the block-insert menu. Table cells included, code blocks excluded; inert read-only': '键入 /（行首或空白后）唤起块级插入菜单。单元格内可用、代码块内排除；只读态不激活',
  'Slash menu labels (groups + item titles)': '斜杠菜单文案（分组名 + 条目名）',
  'Keyboard FAB bottom-right opens the shortcuts drawer (Format / Shortcut / Markdown). Hidden read-only': '右下角键盘悬浮键打开快捷键抽屉（格式 / 快捷键 / Markdown）。只读态隐藏',
  'Mount the keyboard FAB into a container you own (popup-container pattern); positioning becomes yours — e.g. stack it above a back-to-top button. null falls back to the in-editor FAB': '把键盘悬浮键挂进你自己的容器（popup container 模式）；定位随之归你——例如叠在「回到顶部」按钮上方。null 回落编辑器内悬浮键',
  'Shortcuts drawer labels': '快捷键抽屉文案',
  'Export current content as markdown': '把当前内容导出为 markdown',
  'Export current content as HTML': '把当前内容导出为 HTML',
  'Export Tiptap JSON document': '导出 Tiptap JSON 文档',
  'Underlying Tiptap Editor instance': '底层 Tiptap Editor 实例',
  'Open the bar; calling it while open refocuses and selects the query': '打开浮动条；已经开着时再调一次会聚焦并全选当前查询',
  'Flip the bar — open when closed, close when open (pair it with a toolbar entry that shows an active state)': '反转浮动条——关着就开、开着就关（配一个带 active 态的入口按钮）',
  'Bar open/close notification (fires only when the bar actually shows or hides, plus once on unmount)': '浮动条开合通知（只在真的显示 / 收起时回调，卸载时补一次 false）',
  'Ways out of the bar. Esc works from anywhere that belongs to the editor and is consumed; clicking into the document or another input deliberately does not close it': '关闭入口。Esc 在属于本编辑器的任何位置都有效且会吃掉这次按键；点回正文或别的输入框刻意不关',
  'Search entry (magnifier) left of the More menu; wire it to handle.toggleFind() — omit and no button renders': '最右组里、More 左侧的搜索入口（放大镜）。接 handle.toggleFind()；不传就不渲染按钮',
  'Close the bar, clear highlights and refocus the editor': '关闭浮动条、清除高亮并把焦点还给编辑器',

  // ── API 表（TOOLBAR_API） ──
  'Upload handler; hides image button if omitted': '上传处理函数；不传则隐藏图片按钮',
  'Side-effect error callback': '副作用失败的错误回调',
  'Convert a non-Markdown file to Markdown. Omit and Import only takes .md': '把非 Markdown 文件转成 Markdown。不传时「导入」只收 .md',
  'Extra accept for the default Document menu item when importMenuItems is omitted': '未传 importMenuItems 时，默认「文档」项的额外 accept',
  'Import dropdown options (label + accept). Hosts split Markdown / Word / PDF here': '导入下拉选项（label + accept）。宿主在此拆分 Markdown / Word / PDF',
  'Show the Import dropdown': '是否显示导入下拉',
  'Toolbar label overrides': '工具栏文案覆盖',
  'Search entry (magnifier) at the far right; wire it to handle.openFind() — omit and no button renders': '最右端的搜索入口（放大镜）。接上 handle.openFind() 即可；不传就不渲染按钮',
  'Whether the bar is open; drives aria-pressed on the search entry': '浮动条是否开着；驱动搜索入口的 aria-pressed',
  'Custom items in More menu': '更多菜单里的自定义项',
  'Extra root class': '根元素附加 class',

  // ── API 表（PREVIEW / TOC / REPORT / RENDER_HTML / INSERT） ──
  'Markdown string to render': '要渲染的 markdown 字符串',
  'Optional: attach url/title onto [^n] nodes by index': '可选：按 index 给 [^n] 节点附上 url/title',
  'NodeView slot: wrap the pill (e.g. host Popover). Data lookup is host-owned': 'NodeView 插槽：包住圆标（如宿主 Popover）。数据查询归宿主',
  'TOC entries from extractToc / onTocChange': 'extractToc / onTocChange 给出的目录项',
  'Currently highlighted anchor id': '当前高亮的锚点 id',
  'Click handler (locked items ignored)': '点击回调（锁定项被忽略）',
  'Panel label overrides': '面板文案覆盖',
  'HTML from renderReportHtml(...).html': 'renderReportHtml(...).html 的产物',
  'Extra class merged with editorContent': '与 editorContent 合并的附加 class',
  'Input markdown string': '输入的 markdown 字符串',
  'Paywalled section titles (TOC locked)': '付费章节标题（目录里锁定）',
  'Citation sources aligned by index to [^n]': '按 index 对齐 [^n] 的引用来源',
  'Rendered HTML string': '渲染出的 HTML 字符串',
  'Extracted table of contents': '提取出的目录',
  'Markdown string to insert at cursor position': '插入到光标处的 markdown 字符串',
  'Optional citation sources; enriches [^n] before insert': '可选引用来源；插入前先富化 [^n]',

  // ── API 表（FIND_API / I18N_API / MATH / CITATION / COMMENT / PALETTE） ──
  'Register the official find extension and render the floating bar': '注册官方查找扩展并渲染浮动条',
  'Let the editor render the bar; false = host places <FindReplaceBar> itself': '由编辑器渲染浮动条；false = 宿主自己摆 <FindReplaceBar>',
  'Where the library-rendered bar mounts (open state + shortcut stay in the library)': '库渲染的浮动条挂在哪里（开合状态与快捷键仍归库）',
  'Take over Cmd/Ctrl+F while the editor has focus (only when the editor owns a bar)': '编辑器持有焦点时接管 Cmd/Ctrl+F（仅当编辑器自带条子）',
  'Bar labels (FindLabels)': '浮动条文案（FindLabels）',
  'Bar open/close notification (fires only when the bar actually shows or hides)': '浮动条开合通知（只在真的显示 / 收起时回调）',
  'Toolbar magnifier entry: onSearch wires to handle.openFind(), searchActive drives its aria-pressed': '工具栏放大镜入口：onSearch 接 handle.openFind()，searchActive 驱动它的 aria-pressed',
  'Stable selectors for host CSS (the bar internals use hashed CSS-module classes)': '给宿主 CSS 用的稳定选择器（浮动条内部是哈希过的 CSS Modules 类名）',
  'The bar itself, if you place it yourself': '浮动条本体，想自己摆位时用',
  'Re-exported official extension for hand-built pipelines': '再导出的官方扩展，供自建管线使用',
  'Guard for the Tiptap 3.31.3 trailing-node transaction mismatch': 'Tiptap 3.31.3 尾随节点事务错位的防护壳',
  'EditorToolbar text (Partial<ToolbarLabels>)': 'EditorToolbar 文案（Partial<ToolbarLabels>）',
  'Find & replace bar text': '查找替换浮动条文案',
  'Code-block NodeView text (read when the editor is constructed)': '代码块 NodeView 文案（编辑器构造时读取）',
  'TocPanel text': 'TocPanel 文案',
  'ColorPalette swatch names': 'ColorPalette 色块名称',
  'Every default bundle is exported — useful as a base or to diff against': '所有默认文案包都有导出——适合当底稿或做 diff',
  'Toolbar More → Inline equation / Block equation. No keyboard shortcut; typing $ / $$ stays text': '工具栏更多 → 行内公式 / 块级公式。无快捷键；键入 $ / $$ 保持文本',
  'Click a formula: KaTeX stays in the document (highlighted); pill input anchors below and updates it in place; Done / Enter (⌘Enter for block)': '点击公式：KaTeX 留在文档里（高亮），下方锚定输入框原位更新；完成 / Enter（块级用 ⌘Enter）',
  'Single-line $$latex$$ serializes as inlineMath': '单行 $$latex$$ 序列化为行内公式',
  'Newline-wrapped $$ is blockMath': '换行包裹的 $$ 是块级公式',
  'Single $ is never math — $24.4B, US$, even $24.4B$ stay text': '单个 $ 永远不是公式——$24.4B、US$，甚至 $24.4B$ 都保持文本',
  'editor.commands.insertInlineMath / insertBlockMath / updateInlineMath / updateBlockMath': 'editor.commands.insertInlineMath / insertBlockMath / updateInlineMath / updateBlockMath',
  'renderReportHtml emits KaTeX HTML (.katex) so /p works without NodeView': 'renderReportHtml 输出 KaTeX HTML（.katex），阅读页无需 NodeView',
  'More menu: insert inline equation': '更多菜单：插入行内公式',
  'More menu: insert block equation': '更多菜单：插入块级公式',
  'LaTeX input placeholder': 'LaTeX 输入占位',
  'Confirm button': '确认按钮',
  'Unused in UI (Escape / click outside still cancels)': 'UI 中未使用（Esc / 点击外部仍会取消）',
  'Empty inline insert chip (before the first LaTeX character)': '空行内插入气泡（首个 LaTeX 字符之前）',
  'Empty block insert hint bar (before the first LaTeX character)': '空块级插入提示条（首个 LaTeX 字符之前）',
  'Decoded comment anchors (segments). Mapped onto text ranges as edit-session marks': '解码后的评论锚点（segments）。映射为文本区间上的编辑期 mark',
  'Controlled active comment id (mark/block emphasis)': '受控的激活评论 id（mark / 块强调）',
  'Clicked a mark or gutter — commentIds + anchorEl (anchorEl null for gutter)': '点击 mark 或 gutter——commentIds + anchorEl（gutter 时 anchorEl 为 null）',
  'Active id changed from inside the editor': '激活 id 从编辑器内部变化',
  'Render block-left gutter bubbles': '渲染块左缘 gutter 气泡',
  'Editor-side mark clicks are inert (one-way sidebar-driven hosts pass false)': '编辑器内点击 mark 不产生交互（单向侧栏驱动的宿主传 false）',
  'Set active, scroll to first mark, place cursor at range start': '设为激活、滚动到首个 mark、光标放到区间起点',
  'Jump to next/prev comment in document order': '按文档顺序跳转下一条 / 上一条评论',
  'Deduplicated comment ids in document order': '按文档顺序去重的评论 id 列表',
  'Currently applied color (shows checkmark)': '当前应用的颜色（显示对勾）',
  'Called when a swatch is clicked; null clears': '点击色块时回调；null 表示清除',
  'Label overrides': '文案覆盖',

  // ── API 页散文 ──
  'Complete reference for props, ref methods, utility functions, and theming tokens.':
    'props、ref 方法、工具函数与主题变量的完整参考。',

  // ── API 表（THEME_VARS） ──
  'Accent color (selection, links, TOC active)': '强调色（选区、链接、目录激活）',
  'Body text color': '正文颜色',
  'Secondary text': '次要文本',
  'Borders and dividers': '边框与分隔线',
  'Body font family': '正文字体族',
  'Base font size': '基础字号',
  'Body line height': '正文行高',
  'Citation pill background (default matches toolbar active wash)': '引用圆标背景（默认与工具栏激活色一致）',
  'Citation pill text / number': '引用圆标文字 / 序号',
  'Citation pill border': '引用圆标边框',
  'Citation pill hover background': '引用圆标悬停背景',
  'Citation pill hover text': '引用圆标悬停文字',

  // ── API 表（CITATION / CITATION_INTERACTIVE / SCROLL / TOC_UTIL） ──
  'SSR reader: event-delegates .citation-ref; emits onCitationEnter / onCitationLeave (no open state)': 'SSR 阅读页：事件代理 .citation-ref，抛出 onCitationEnter / onCitationLeave（不持有开合状态）',
  'Convenience: ReportContent + CitationInteractive. Reading pages: import from tiptap-markdown-react/reader': '便捷组合：ReportContent + CitationInteractive。阅读页从 tiptap-markdown-react/reader 导入',
  'Host-owned open/close; ctx has index + anchorEl': '开合状态归宿主；ctx 含 index + anchorEl',
  'Client CitationRef + NodeView': '客户端 CitationRef + NodeView',
  'Pure schema node for SSR HTML (no React)': '纯 schema 节点，供 SSR HTML 使用（无 React）',
  'DOM helpers for custom delegation': '自定义事件代理用的 DOM 工具',
  'Optional helpers to attach url/title by index': '按 index 附上 url/title 的可选工具',
  'Ref to the element wrapping ReportContent HTML': '指向 ReportContent HTML 外层元素的 ref',
  'Pill clicked; host opens Popover': '点击圆标；宿主打开 Popover',
  'Click outside / same pill again / Escape; host closes': '点击外部 / 再点同一圆标 / Esc；宿主关闭',
  'TOC item id, matches the data-toc-id attribute on the target heading': '目录项 id，对应目标标题上的 data-toc-id 属性',
  'The overflow:auto container element to animate': '要滚动的 overflow:auto 容器元素',
  'Animation duration in ms (default 400)': '动画时长（毫秒，默认 400）',
  'Extract TocItem[] from Tiptap JSONContent': '从 Tiptap JSONContent 提取 TocItem[]',
  'Returns (text, level) => slug; shared anchor logic for SSR + client': '返回 (text, level) => slug；SSR 与客户端共用的锚点逻辑',
  'Heuristic: does plain-text contain markdown patterns?': '启发式判断：纯文本里是否含 markdown 特征？',

  // ── 演示页 DemoBlock 标题 / 描述 ──
  'Full editor with toolbar. Content exports as Markdown.': '完整编辑器 + 工具栏。内容导出为 Markdown。',
  'Three built-in ways to get markdown into the editor — paste detection, .md file drop, and a toolbar file picker.':
    '把 markdown 送进编辑器的三种内建方式——粘贴检测、.md 文件拖放、工具栏文件选择器。',
  'Toolbar + Image Upload': '工具栏 + 图片上传',
  'onImageUpload converts files to data URLs in this demo (no backend).': '本演示里 onImageUpload 把文件转成 data URL（无后端）。',
  'Radix language dropdown — arrow keys work around the block. Backspace twice to delete.':
    'Radix 语言下拉——方向键可绕块导航。块下方按两次 Backspace 选中后删除。',
  'More menu inserts inline / block math. Click a formula to edit in place (input below, live KaTeX in the document). $24.4B stays text.':
    '更多菜单插入行内 / 块级公式。点击公式原位编辑（下方输入，文档内实时更新）。$24.4B 保持文本。',
  'Comment + GFM table → Chart.js. Click to edit JSON and table. Multi chartType uses tabs.':
    '注释 + GFM 表格 → Chart.js。点击编辑 JSON 与表格。多 chartType 用页签切换。',
  'Streaming chart rows': '流式追加的图表行',
  'Rows append every second; the chart updates without remount thrash.': '每秒追加一行；图表原位更新，不靠重挂。',
  'MarkdownPreview renders the same markdown as the editor.': 'MarkdownPreview 渲染与编辑器同一份 markdown。',
  'renderReportHtml emits KaTeX HTML so reading pages work without the editor NodeView.':
    'renderReportHtml 输出 KaTeX HTML，阅读页没有编辑器 NodeView 也能渲染公式。',
  'renderReportHtml emits chart placeholders; ReportContentWithCharts hydrates Chart.js on the client.':
    'renderReportHtml 输出图表占位；ReportContentWithCharts 在客户端水合 Chart.js。',
  '[^n] becomes a mid-line circular number. Host mounts Popover via renderCitation NodeView slot — library never owns your source schema.':
    '[^n] 变成行内圆形序号。宿主经 renderCitation NodeView 插槽挂 Popover——库从不染指你的来源 schema。',
  'SSR reader + citations': 'SSR 阅读页 + 引用标注',
  'renderReportHtml produces static pills; click a pill — CitationInteractive emits enter/leave, host owns the Popover. Inner <a> does not navigate (pointer-events:none); use the panel link.':
    'renderReportHtml 产出静态圆标；点击圆标时 CitationInteractive 抛出 enter/leave，Popover 归宿主。内部 <a> 不导航（pointer-events:none），请用面板链接。',
  'Edit on the left — live Markdown export on the right.': '左边编辑——右边实时导出 Markdown。',
  'Editor headings sync to TocPanel via onTocChange.': '编辑器标题经 onTocChange 实时同步到 TocPanel。',
  'Override --tmr-accent and other tokens without forking.': '不改库源码即可覆盖 --tmr-accent 等设计令牌。',

  // ── 快捷键面板演示 ──
  Shortcuts: '快捷键',
  'Shortcut panel': '快捷键面板',
  'Keyboard FAB bottom-right opens the Yuque-style drawer: Format / Shortcut / Markdown trigger, three columns. Every row is a real binding — verified against the installed Tiptap extensions.':
    '右下角键盘悬浮按钮打开语雀式抽屉：格式 / 快捷键 / Markdown 触发写法三列对照。每一行都是真实存在的键位——逐条对照所装 Tiptap 扩展源码核实。',
  'Use the color picker above the editor to change accent live.': '用编辑器上方的取色器实时切换强调色。',
};

/** 站点里原本写死的中文 → 英文（EN 模式下反向翻译）。 */
export const EN_STRINGS: Record<string, string> = {
  '🚀 代码演示': '🚀 Live demo',
  '📖 API 参考': '📖 API reference',
  'Ref 方法': 'Ref methods',
  'Props 说明': 'Props notes',
  属性: 'Prop',
  说明: 'Description',
  类型: 'Type',
  默认值: 'Default',
};
