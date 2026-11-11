/**
 * 历史面板装载基线。Chrome 里走和 VersionDiffView 相同的扩展，
 * 量整篇 setContent、分块首屏/装完、JSON 缓存命中、parseVersionDoc。
 *
 *   node site/scripts/history-bench.mjs
 *   node site/scripts/history-bench.mjs --chars 160000
 *
 * 结果写入 site/bench-results/history-baseline.json。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = join(ROOT, 'site');
const OUT = join(SITE, 'bench-results', 'history-baseline.json');
const PORT = 5198;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const chars = args.includes('--chars') ? args[args.indexOf('--chars') + 1] : '160000';

function startVite() {
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: SITE,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));
  return child;
}

function waitVite() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      http
        .get(`http://localhost:${PORT}/history-bench.html`, (res) => {
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

const vite = startVite();
try {
  await waitVite();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(180000);
  await page.goto(`http://localhost:${PORT}/history-bench.html?chars=${chars}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction('window.__historyBench && window.__historyBench.ready === true');
  const result = await page.evaluate(() => window.__historyBench.measure());
  const payload = {
    measuredAt: new Date().toISOString(),
    note: 'Chrome。扩展与 VersionDiffView 相同。量报告形之前会先挂一棵同样的长文，模拟正文编辑器已经开着。plain 是同样字数的纯段落。',
    ...result,
  };
  mkdirSync(join(SITE, 'bench-results'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  await browser.close();
} finally {
  vite.kill('SIGTERM');
}
