import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const artifactDir = path.resolve('artifacts');

function watchPage(page: Page): { errors: string[]; failed: string[] } {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => failed.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  return { errors, failed };
}

async function screenshotStats(page: Page, filename: string): Promise<{ colors: number; darkRatio: number }> {
  await fs.mkdir(artifactDir, { recursive: true });
  const image = await page.screenshot({ path: path.join(artifactDir, filename), fullPage: true, animations: 'disabled' });
  const png = PNG.sync.read(image);
  const colors = new Set<number>();
  let dark = 0;
  let sampled = 0;
  for (let y = 0; y < png.height; y += 5) {
    for (let x = 0; x < png.width; x += 5) {
      const offset = (y * png.width + x) * 4;
      const red = png.data[offset] ?? 0;
      const green = png.data[offset + 1] ?? 0;
      const blue = png.data[offset + 2] ?? 0;
      colors.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
      if (red + green + blue < 75) dark += 1;
      sampled += 1;
    }
  }
  return { colors: colors.size, darkRatio: dark / Math.max(sampled, 1) };
}

async function expectNoOverflow(page: Page): Promise<void> {
  const overflow = await page.locator('button:visible, a:visible').evaluateAll((elements) =>
    elements
      .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
      .map((element) => ({ text: element.textContent?.trim(), width: [element.clientWidth, element.scrollWidth], height: [element.clientHeight, element.scrollHeight] })),
  );
  expect(overflow).toEqual([]);
}

async function sliceWithMouse(page: Page): Promise<void> {
  const canvas = await page.locator('#game-stage canvas').boundingBox();
  if (!canvas) throw new Error('Game canvas has no visible bounds');
  await page.waitForTimeout(650);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.move(canvas.x + canvas.width * 0.04, canvas.y + canvas.height * 0.12);
    await page.mouse.down();
    for (let row = 1; row <= 9; row += 1) {
      const y = canvas.y + canvas.height * (row / 10);
      const x = canvas.x + canvas.width * (row % 2 === 0 ? 0.04 : 0.96);
      await page.mouse.move(x, y, { steps: 3 });
    }
    await page.mouse.up();
    const score = Number((await page.locator('#score-value').textContent())?.replaceAll(',', '') ?? '0');
    if (score > 0) return;
    await page.waitForTimeout(350);
  }
  throw new Error('Mouse swipe did not intersect a spawned fruit');
}

test('desktop game supports mode selection, slicing, audio and pause flow', async ({ page }) => {
  const observed = watchPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page).toHaveTitle('水果忍者：刀锋果园');
  await expect(page.getByRole('heading', { name: /水果忍者/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /冒险/ })).toHaveAttribute('aria-selected', 'true');
  await expectNoOverflow(page);

  const menuStats = await screenshotStats(page, 'fruit-menu-desktop.png');
  expect(menuStats.colors).toBeGreaterThan(40);
  expect(menuStats.darkRatio).toBeLessThan(0.88);

  await page.getByRole('tab', { name: /街机/ }).click();
  await expect(page.locator('#quick-panel')).toContainText('90 秒高分');
  await page.getByRole('tab', { name: /冒险/ }).click();
  await page.getByRole('button', { name: '第 1 关 初试锋芒，达到 500 分' }).click();
  await page.getByRole('button', { name: '开始第 1 关' }).click();

  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#game-stage canvas')).toBeVisible();
  await expect(page.locator('#run-name')).toHaveText('初试锋芒');
  await sliceWithMouse(page);
  await expect.poll(async () => Number((await page.locator('#score-value').textContent())?.replaceAll(',', '') ?? '0')).toBeGreaterThan(0);

  await page.getByRole('button', { name: '关闭声音' }).click();
  await expect(page.getByRole('button', { name: '开启声音' })).toBeVisible();
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeHidden();

  const gameStats = await screenshotStats(page, 'fruit-game-desktop.png');
  expect(gameStats.colors).toBeGreaterThan(50);
  expect(gameStats.darkRatio).toBeLessThan(0.88);
  await expectNoOverflow(page);

  await expect(page.getByRole('dialog', { name: /重整刀锋/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#result-score')).not.toBeEmpty();
  await screenshotStats(page, 'fruit-result-desktop.png');
  await page.getByRole('button', { name: '再来一次' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(observed.errors).toEqual([]);
  expect(observed.failed).toEqual([]);
});

test('mobile layout and touch swipe remain playable', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const observed = watchPage(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /水果忍者/ })).toBeVisible();
  await expectNoOverflow(page);
  const menuStats = await screenshotStats(page, 'fruit-menu-mobile.png');
  expect(menuStats.colors).toBeGreaterThan(35);

  await page.getByRole('tab', { name: /禅境/ }).click();
  await page.getByRole('button', { name: '开始禅境模式' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#objective-value')).toContainText('无炸弹');
  await page.waitForTimeout(850);

  const canvas = await page.locator('#game-stage canvas').boundingBox();
  expect(canvas).not.toBeNull();
  if (canvas) {
    const session = await context.newCDPSession(page);
    const points: Array<{ x: number; y: number }> = [];
    for (let row = 1; row <= 9; row += 1) {
      const y = canvas.y + canvas.height * (row / 10);
      const left = { x: canvas.x + canvas.width * 0.06, y };
      const right = { x: canvas.x + canvas.width * 0.94, y };
      points.push(...(row % 2 === 0 ? [right, left] : [left, right]));
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0]!, radiusX: 4, radiusY: 4 }] });
    for (const point of points.slice(1)) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, radiusX: 4, radiusY: 4 }] });
      await page.waitForTimeout(35);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await expect.poll(async () => Number((await page.locator('#score-value').textContent())?.replaceAll(',', '') ?? '0')).toBeGreaterThan(0);

  const stats = await screenshotStats(page, 'fruit-game-mobile.png');
  expect(stats.colors).toBeGreaterThan(40);
  expect(stats.darkRatio).toBeLessThan(0.9);
  await expectNoOverflow(page);

  const hudBox = await page.locator('.hud-top').boundingBox();
  const actionsBox = await page.locator('.hud-actions').boundingBox();
  expect(hudBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  if (hudBox && actionsBox) expect(hudBox.y + hudBox.height).toBeLessThan(actionsBox.y);
  expect(observed.errors).toEqual([]);
  expect(observed.failed).toEqual([]);
  await context.close();
});
