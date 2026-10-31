/**
 * 长文档编辑性能基准（CDP 驱动，仅本地工具，不进构建）。
 *
 * 用法：
 *   node site/scripts/perf-bench.mjs                 # 默认全矩阵
 *   node site/scripts/perf-bench.mjs --only lib-30k  # 按名称过滤（子串）
 *   node site/scripts/perf-bench.mjs --profile custom-30k  # 额外采样 CPU profile 并分析热点
 *
 * 结果写入 site/bench-results/<name>.json。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = join(ROOT, 'site');
const OUT_DIR = join(SITE, 'bench-results');
const PORT = 5199;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHARS = 'xxo ok?. as in; a b c';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const profileTarget = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : null;

/** 矩阵：name → bench.html 的 query。 */
const MATRIX = {
  'lib-10k-mixed': 'mode=lib&chars=10000&variant=mixed',
  'lib-30k-mixed': 'mode=lib&chars=30000&variant=mixed',
  'lib-60k-mixed': 'mode=lib&chars=60000&variant=mixed',
  'lib-60k-paragraphs': 'mode=lib&chars=60000&variant=paragraphs',
  'lib-60k-headings': 'mode=lib&chars=60000&variant=headings',
  'lib-30k-lean': 'mode=lib&chars=30000&variant=mixed&lean=1',
  'lib-30k-cc': 'mode=lib&chars=30000&variant=mixed&cc=1',
  'custom-30k-full': 'mode=custom&chars=30000&variant=mixed',
  'custom-30k-noToc': 'mode=custom&chars=30000&variant=mixed&noToc=1',
  'custom-30k-noFind': 'mode=custom&chars=30000&variant=mixed&noFind=1',
  'custom-30k-noToc-noFind': 'mode=custom&chars=30000&variant=mixed&noToc=1&noFind=1',
  'custom-30k-minimal':
    'mode=custom&chars=30000&variant=mixed&noToc=1&noFind=1&noSlash=1&noTypo=1&noPaste=1&noDrop=1&noResize=1&noChart=1&noComments=1',
  'custom-30k-fix': 'mode=custom&chars=30000&variant=mixed&fix=1',
  'custom-60k-fix': 'mode=custom&chars=60000&variant=mixed&fix=1',
  'custom-60k-full': 'mode=custom&chars=60000&variant=mixed',
  'custom-30k-json': 'mode=custom&chars=30000&variant=mixed&content=json',
  'custom-60k-json': 'mode=custom&chars=60000&variant=mixed&content=json',
  'lib-100k-mixed': 'mode=lib&chars=100000&variant=mixed',
  'lib-200k-mixed': 'mode=lib&chars=200000&variant=mixed',
  'lib-300k-mixed': 'mode=lib&chars=300000&variant=mixed',
  'lib-500k-mixed': 'mode=lib&chars=500000&variant=mixed',
  'lib-200k-toc': 'mode=lib&chars=200000&variant=mixed&toc=1',
};

const P = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const r1 = (v) => Math.round(v * 10) / 10;

function startVite() {
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: SITE,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  return child;
}

function waitViteReady() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      http
        .get(`http://localhost:${PORT}/bench.html`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - started > 30000) reject(new Error('vite 启动超时'));
      else setTimeout(tick, 300);
    };
    tick();
  });
}

async function openBench(browser, query) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // 页面加载前注入：keydown 打点（输入延迟起点）
  await page.evaluateOnNewDocument(() => {
    window.__keys = [];
    window.addEventListener(
      'keydown',
      (e) => {
        window.__keys.push({ t0: performance.now(), key: e.key });
      },
      true,
    );
  });
  await page.goto(`http://localhost:${PORT}/bench.html?${query}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction('window.__benchReady === true', { timeout: 120000 });
  return page;
}

async function cdpMetrics(client) {
  await client.send('Performance.enable');
  await client.send('HeapProfiler.collectGarbage');
  const { metrics } = await client.send('Performance.getMetrics');
  const get = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    heapUsedMB: r1(get('JSHeapUsedSize') / 1048576),
    nodes: get('Nodes'),
    listeners: get('JSEventListeners'),
  };
}

/** 编辑器内关键打点：patch view.dispatch 记录每事务耗时。 */
async function armEditor(page) {
  return page.evaluate(() => {
    const editor = window.__bench.getEditor();
    if (!editor) throw new Error('editor 未就绪');
    window.__editor = editor;
    window.__tx = [];
    const orig = editor.view.dispatch.bind(editor.view);
    editor.view.dispatch = (tr) => {
      const start = performance.now();
      orig(tr);
      window.__tx.push({ start, done: performance.now(), keysLen: window.__keys.length });
    };
    const dom = editor.view.dom;
    return {
      docNodes: editor.state.doc.nodeSize,
      domCount: dom.querySelectorAll('*').length,
      textLength: editor.state.doc.textContent.length,
    };
  });
}

async function runCase(browser, name, query) {
  const page = await openBench(browser, query);
  const client = await page.createCDPSession();
  const info = await armEditor(page);
  const memBefore = await cdpMetrics(client);

  // ---- 打字：文档末尾 100 键 ----
  await page.evaluate(() => {
    window.__keys.length = 0;
    window.__tx.length = 0;
    window.__editor.commands.focus('end');
    window.__keys.length = 0;
    window.__tx.length = 0;
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.keyboard.type(CHARS.repeat(4), { delay: 40 }); // 100 字符
  await new Promise((r) => setTimeout(r, 300));
  const typing = await page.evaluate(() => ({ keys: [...window.__keys], tx: [...window.__tx] }));
  const pairs = pairKeysToTx(typing.keys, typing.tx);

  // ---- Enter ×10（拆段落）----
  await page.evaluate(() => { window.__tx.length = 0; });
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 60));
  }
  await new Promise((r) => setTimeout(r, 200));
  const enterTx = await page.evaluate(() => window.__tx.map((t) => t.done - t.start));

  // ---- 大事务：全选加粗 ×3 ----
  const bigTx = [];
  for (let i = 0; i < 3; i += 1) {
    const dt = await page.evaluate(() => {
      const t0 = performance.now();
      const ed = window.__editor;
      ed.chain().selectAll().toggleBold().run();
      return performance.now() - t0;
    });
    bigTx.push(dt);
    await new Promise((r) => setTimeout(r, 150));
  }

  // ---- undo ×20（大撤销步）----
  const undoTimes = [];
  for (let i = 0; i < 20; i += 1) {
    const dt = await page.evaluate(() => {
      const t0 = performance.now();
      window.__editor.commands.undo();
      return performance.now() - t0;
    });
    undoTimes.push(dt);
    await new Promise((r) => setTimeout(r, 60));
  }

  // ---- getMarkdown ×3 ----
  const mdTimes = [];
  let mdBytes = 0;
  for (let i = 0; i < 3; i += 1) {
    const r = await page.evaluate(() => {
      const t0 = performance.now();
      const md = window.__editor.getMarkdown();
      return { dt: performance.now() - t0, len: md.length };
    });
    mdTimes.push(r.dt);
    mdBytes = r.len;
    await new Promise((r2) => setTimeout(r2, 100));
  }

  // ---- 滚动：帧间隔 + longtask ----
  const scrollFrames = await page.evaluate(() => {
    const frames = [];
    window.__scrollLoop = true;
    let last = performance.now();
    const loop = (t) => {
      frames.push(t - last);
      last = t;
      if (window.__scrollLoop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__frames = frames;
  });
  for (let i = 0; i < 20; i += 1) {
    await page.mouse.wheel({ deltaY: 900 });
    await new Promise((r) => setTimeout(r, 60));
  }
  await new Promise((r) => setTimeout(r, 300));
  const scroll = await page.evaluate(() => {
    window.__scrollLoop = false;
    return { frames: [...window.__frames] };
  });

  const memAfter = await cdpMetrics(client);
  const finalInfo = await page.evaluate(() => {
    const ed = window.__editor;
    return {
      domCount: ed.view.dom.querySelectorAll('*').length,
      longTasks: [...window.__bench.longTasks],
    };
  });

  const result = {
    name,
    query,
    doc: { textLength: info.textLength, docNodes: info.docNodes, domCount0: info.domCount },
    typing: {
      n: pairs.length,
      e2eP50: r1(P(pairs, 50)),
      e2eP95: r1(P(pairs, 95)),
      e2eMax: pairs.length ? r1(Math.max(...pairs)) : 0,
      txP50: r1(P(typing.tx.map((t) => t.done - t.start), 50)),
      txP95: r1(P(typing.tx.map((t) => t.done - t.start), 95)),
    },
    enter: { p50: r1(P(enterTx, 50)), p95: r1(P(enterTx, 95)) },
    bigTx: { times: bigTx.map(r1), p50: r1(P(bigTx, 50)) },
    undo: { p50: r1(P(undoTimes, 50)), p95: r1(P(undoTimes, 95)), max: r1(Math.max(...undoTimes)) },
    getMarkdown: { p50: r1(P(mdTimes, 50)), bytes: mdBytes },
    scroll: {
      frameP50: r1(P(scroll.frames, 50)),
      frameP95: r1(P(scroll.frames, 95)),
    },
    memory: memAfter,
    memoryBefore: memBefore,
    domCount: finalInfo.domCount,
    longTasks: {
      count: finalInfo.longTasks.length,
      total: r1(finalInfo.longTasks.reduce((s, t) => s + t.duration, 0)),
      max: finalInfo.longTasks.length ? r1(Math.max(...finalInfo.longTasks.map((t) => t.duration))) : 0,
    },
    loadMarks: await page.evaluate(() => window.__bench.marks),
  };
  await page.close();
  return result;
}

/** 把 keydown t0 与下一个事务 done 配对（输入端到端延迟）。 */
function pairKeysToTx(keys, tx) {
  const pairs = [];
  let ti = 0;
  for (const k of keys) {
    while (ti < tx.length && tx[ti].done < k.t0) ti += 1;
    if (ti >= tx.length) break;
    pairs.push(tx[ti].done - k.t0);
    ti += 1;
  }
  return pairs;
}

/** CPU profile 采样 + 热点分析。action: typing（默认）| bigtx | load。 */
async function runProfile(browser, name, query, action = 'typing') {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => {
    window.__keys = [];
    window.addEventListener('keydown', (e) => window.__keys.push({ t0: performance.now(), key: e.key }), true);
  });
  const client = await page.createCDPSession();
  await client.send('Profiler.enable');
  await client.send('Profiler.start');
  await page.goto(`http://localhost:${PORT}/bench.html?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__benchReady === true', { timeout: 120000 });
  await armEditor(page);
  if (action === 'bigtx') {
    for (let i = 0; i < 8; i += 1) {
      await page.evaluate(() => {
        window.__editor.chain().selectAll().toggleBold().run();
      });
      await new Promise((r) => setTimeout(r, 80));
    }
    await new Promise((r) => setTimeout(r, 300));
  } else if (action === 'typing') {
    await page.evaluate(() => {
      window.__keys.length = 0;
      window.__tx.length = 0;
      window.__editor.commands.focus('end');
      window.__keys.length = 0;
      window.__tx.length = 0;
    });
    await new Promise((r) => setTimeout(r, 200));
    await page.keyboard.type(CHARS.repeat(10), { delay: 25 }); // 250 键
    await new Promise((r) => setTimeout(r, 300));
  }
  const { profile } = await client.send('Profiler.stop');
  await page.close();

  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  // self time：按 samples/timeDeltas 累加
  const selfUs = new Map();
  for (let i = 0; i < profile.samples.length; i += 1) {
    const id = profile.samples[i];
    const dt = profile.timeDeltas[i] ?? 0;
    selfUs.set(id, (selfUs.get(id) ?? 0) + Math.max(0, dt));
  }
  const IDLE = new Set(['(idle)', '(program)', '(garbage collector)']);
  const totalUs = [...selfUs.entries()]
    .filter(([id]) => !IDLE.has(byId.get(id)?.callFrame?.functionName))
    .reduce((s, [, v]) => s + v, 0);
  const byFn = new Map();
  for (const [id, us] of selfUs) {
    const cf = byId.get(id)?.callFrame;
    if (!cf) continue;
    const key = `${cf.functionName || '(anonymous)'} @ ${shortUrl(cf.url)}:${cf.lineNumber + 1}`;
    byFn.set(key, (byFn.get(key) ?? 0) + us);
  }
  const top = [...byFn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([key, us]) => ({ fn: key, ms: r1(us / 1000), pct: r1((us / totalUs) * 100) }));
  const byPkg = new Map();
  for (const [id, us] of selfUs) {
    const cf = byId.get(id)?.callFrame;
    if (!cf || IDLE.has(cf.functionName)) continue;
    const pkg = pkgOf(cf.url);
    byPkg.set(pkg, (byPkg.get(pkg) ?? 0) + us);
  }
  const pkgs = [...byPkg.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pkg, us]) => ({ pkg, ms: r1(us / 1000), pct: r1((us / totalUs) * 100) }));
  writeFileSync(join(OUT_DIR, `${name}.cpuprofile`), JSON.stringify(profile));
  return { totalMs: r1(totalUs / 1000), top, byPkg: pkgs };
}

function shortUrl(url) {
  if (!url) return '(native)';
  return url.replace(/^.*node_modules\//, '').replace(/^.*?\/(site|src)\//, '$1/');
}
function pkgOf(url) {
  if (!url) return '(native)';
  const m = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/.exec(url);
  if (m) {
    if (m[1].startsWith('@tiptap')) return '@tiptap/*';
    if (m[1].startsWith('prosemirror')) return 'prosemirror-*';
    return m[1];
  }
  if (url.includes('/site/') || url.includes('/src/')) return 'project-src';
  if (url.includes('tiptap-markdown-react/dist')) return 'dist-bundle';
  return 'other';
}

/* ---------------------------------- 主流程 ---------------------------------- */

mkdirSync(OUT_DIR, { recursive: true });
const vite = startVite();
try {
  await waitViteReady();
  // 预热（触发 optimizeDeps），丢弃
  const warmup = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--window-size=1400,1000'],
  });
  const wp = await warmup.newPage();
  await wp.goto(`http://localhost:${PORT}/bench.html?mode=lib&chars=500`, { timeout: 120000 });
  await wp.waitForFunction('window.__benchReady === true', { timeout: 120000 }).catch(() => {});
  await warmup.close();

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--window-size=1400,1000'],
  });

  const names = Object.keys(MATRIX).filter((n) => !only || n.includes(only));
  const all = {};
  for (const name of names) {
    const query = MATRIX[name];
    process.stdout.write(`\n=== ${name} (${query}) ===\n`);
    const result = await runCase(browser, name, query);
    all[name] = result;
    printResult(result);
    writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(result, null, 2));
  }

  if (profileTarget) {
    const actionArg = args.includes('--profile-action')
      ? args[args.indexOf('--profile-action') + 1]
      : 'typing';
    const matched = names.filter((n) => n === profileTarget);
    const target = matched[0] ?? 'custom-30k-full';
    process.stdout.write(`\n=== CPU profile: ${target} (${actionArg}) ===\n`);
    const prof = await runProfile(browser, `${target}-${actionArg}`, MATRIX[target], actionArg);
    printProfile(prof);
    writeFileSync(join(OUT_DIR, `${target}-${actionArg}-profile.json`), JSON.stringify(prof, null, 2));
  }

  await browser.close();
  writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(all, null, 2));
  process.stdout.write(`\n结果目录: ${OUT_DIR}\n`);
} finally {
  vite.kill('SIGTERM');
}

function printResult(r) {
  const f = (v) => String(v ?? '-').padStart(8);
  process.stdout.write(
    [
      `文档: ${r.doc.textLength} 字 / PM nodeSize ${r.doc.docNodes} / DOM ${r.doc.domCount0} 节点`,
      `打字 100 键: e2e P50 ${r.typing.e2eP50}ms  P95 ${r.typing.e2eP95}ms  max ${r.typing.e2eMax}ms | 事务 P50 ${r.typing.txP50}ms`,
      `Enter P95 ${r.enter.p95}ms | 全选加粗 P50 ${r.bigTx.p50}ms | undo P50 ${r.undo.p50}ms max ${r.undo.max}ms`,
      `getMarkdown ${r.getMarkdown.p50}ms (${r.getMarkdown.bytes}B) | 滚动帧 P95 ${r.scroll.frameP95}ms`,
      `内存 heap ${r.memoryBefore.heapUsedMB}→${r.memory.heapUsedMB}MB | DOM 节点 ${r.memory.nodes} | listeners ${r.memory.listeners}`,
      `长任务: ${r.longTasks.count} 个 / 共 ${r.longTasks.total}ms / 最长 ${r.longTasks.max}ms`,
      '',
    ].join('\n'),
  );
}

function printProfile(p) {
  process.stdout.write(`总采样 ${p.totalMs}ms\n\n按包自耗时:\n`);
  for (const row of p.byPkg.slice(0, 12)) {
    process.stdout.write(`  ${String(row.ms).padStart(7)}ms  ${String(row.pct).padStart(5)}%  ${row.pkg}\n`);
  }
  process.stdout.write('\nTop 函数（自耗时）:\n');
  for (const row of p.top) {
    process.stdout.write(`  ${String(row.ms).padStart(7)}ms  ${String(row.pct).padStart(5)}%  ${row.fn}\n`);
  }
}
