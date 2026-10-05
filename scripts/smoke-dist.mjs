import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn(process.execPath, [path.join(root, 'wildwood-together/server/index.js'), '--production'], {
  cwd: root,
  env: { ...process.env, HOST: '127.0.0.1', PORT: '0', SITE_ROOT: path.join(root, 'dist'), GAME_BASE_PATH: '/wildwood-together/' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const origin = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { server.kill(); reject(new Error('Preview startup timed out')); }, 15000);
  server.on('error', error => { clearTimeout(timeout); reject(error); });
  server.stdout.on('data', data => {
    const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
    if (match) { clearTimeout(timeout); resolve(match[0]); }
  });
  server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
});
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const failures = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`);
  });

  const routes = [
    { path: '/wildwood-together/', title: '荒野同行 · 联机生存', selector: '#world[data-assets="ready"]' },
    { path: '/', title: 'WebGame 游戏聚合', selector: '.game-list' },
    { path: '/fruit-ninja/', title: '水果忍者：刀锋果园', selector: '#game-stage canvas' },
    { path: '/starbound-brothers/', title: '星跃兄弟：横版闯关', selector: '#game-stage canvas' },
    { path: '/5.6-sol%E6%88%91%E7%9A%84%E4%B8%96%E7%95%8C/', title: '5.6-sol我的世界', selector: '#game-canvas' },
    { path: '/gpt-5.5%E6%88%91%E7%9A%84%E4%B8%96%E7%95%8C/', title: 'WebGame | gpt-5.5我的世界', selector: '#gameCanvas' },
  ];

  for (const route of routes) {
    const response = await page.goto(`${origin}${route.path}`, { waitUntil: 'networkidle' });
    if (!response?.ok()) failures.push(`navigation: ${route.path} returned ${response?.status() ?? 'no response'}`);
    if ((await page.title()) !== route.title) failures.push(`title: ${route.path} did not render the expected app`);
    await page.locator(route.selector).waitFor({ state: 'visible', timeout: 10_000 });
  }

  await page.goto(`${origin}/wildwood-together/?room=SMOKE1`);
  await page.locator('#connection').filter({ hasText: '已连接' }).waitFor({ timeout: 10000 });
  const peer = await browser.newPage();
  await peer.goto(`${origin}/wildwood-together/?room=SMOKE1`);
  await page.locator('#room-count').filter({ hasText: '2/8' }).waitFor({ timeout: 10000 });
  await peer.close();

  if (failures.length > 0) throw new Error(`Deployment smoke test failed:\n${failures.join('\n')}`);
  console.log(`Verified ${routes.length} deployed routes with no browser or resource errors`);
} finally {
  await browser.close();
  server.kill();
}
