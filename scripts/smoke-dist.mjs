import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await preview({
  root,
  preview: { host: '127.0.0.1', port: 0 },
});
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Preview server did not expose a TCP port');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
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

  if (failures.length > 0) throw new Error(`Deployment smoke test failed:\n${failures.join('\n')}`);
  console.log(`Verified ${routes.length} deployed routes with no browser or resource errors`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
