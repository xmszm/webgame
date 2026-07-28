import { expect, test, type Browser, type Page } from '@playwright/test';
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

async function screenshotStats(page: Page, filename: string): Promise<{ colors: number; transparentRatio: number }> {
  await fs.mkdir(artifactDir, { recursive: true });
  const image = await page.screenshot({ path: path.join(artifactDir, filename), fullPage: true, animations: 'disabled' });
  const png = PNG.sync.read(image);
  const colors = new Set<number>();
  let transparent = 0;
  let sampled = 0;
  for (let y = 0; y < png.height; y += 5) {
    for (let x = 0; x < png.width; x += 5) {
      const offset = (y * png.width + x) * 4;
      const red = png.data[offset] ?? 0;
      const green = png.data[offset + 1] ?? 0;
      const blue = png.data[offset + 2] ?? 0;
      const alpha = png.data[offset + 3] ?? 0;
      colors.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
      if (alpha < 10) transparent += 1;
      sampled += 1;
    }
  }
  return { colors: colors.size, transparentRatio: transparent / Math.max(sampled, 1) };
}

async function expectCanvasPainted(page: Page): Promise<void> {
  const canvas = page.locator('#game-stage canvas');
  await expect(canvas).toBeVisible();
  const image = await canvas.screenshot({ animations: 'disabled' });
  const png = PNG.sync.read(image);
  const colors = new Set<number>();
  let opaque = 0;
  for (let y = 0; y < png.height; y += 8) {
    for (let x = 0; x < png.width; x += 8) {
      const offset = (y * png.width + x) * 4;
      const red = png.data[offset] ?? 0;
      const green = png.data[offset + 1] ?? 0;
      const blue = png.data[offset + 2] ?? 0;
      const alpha = png.data[offset + 3] ?? 0;
      if (alpha > 0) opaque += 1;
      colors.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
    }
  }
  expect(colors.size).toBeGreaterThan(8);
  expect(opaque).toBeGreaterThan(500);
}

async function expectNoControlOverflow(page: Page): Promise<void> {
  const overflow = await page.locator('button:visible, a:visible').evaluateAll((elements) => elements
    .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
    .map((element) => ({ text: element.textContent?.trim(), size: [element.clientWidth, element.scrollWidth, element.clientHeight, element.scrollHeight] })));
  expect(overflow).toEqual([]);
}

async function playForward(page: Page, cycles: number): Promise<void> {
  await page.keyboard.down('ArrowRight');
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(130);
    await page.keyboard.up('Space');
    await page.waitForTimeout(230);
  }
  await page.keyboard.up('ArrowRight');
}

async function sprintToGoal(page: Page): Promise<void> {
  await page.keyboard.down('ArrowRight');
  for (let cycle = 0; cycle < 82; cycle += 1) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(80);
    await page.keyboard.up('Space');
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('ArrowRight');
}

test('desktop flow renders, plays, reports status, and supports pause controls', async ({ page }) => {
  const observed = watchPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page).toHaveTitle('星跃兄弟：横版闯关');
  await expect(page.getByRole('heading', { name: '星跃兄弟' })).toBeVisible();
  await expect(page.getByRole('button', { name: /第 2 关.*尚未解锁/ })).toBeDisabled();
  await expectCanvasPainted(page);
  await expectNoControlOverflow(page);

  const menuStats = await screenshotStats(page, 'platform-menu-desktop.png');
  expect(menuStats.colors).toBeGreaterThan(30);
  expect(menuStats.transparentRatio).toBeLessThan(0.01);

  await page.getByRole('button', { name: '开始冒险' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#level-name')).toContainText('青草启程');
  await expect(page.locator('#touch-controls')).toBeHidden();

  const initialProgress = await page.locator('#run-progress').getAttribute('style');
  await playForward(page, 5);
  await expect.poll(() => page.locator('#run-progress').getAttribute('style')).not.toBe(initialProgress);
  const activity = await Promise.all([
    page.locator('#score-value').textContent(),
    page.locator('#lives-value').textContent(),
  ]);
  expect(Number(activity[0]) > 0 || Number(activity[1]) < 3).toBe(true);

  await page.getByRole('button', { name: '关闭声音' }).click();
  await expect(page.getByRole('button', { name: '开启声音' })).toBeVisible();
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeHidden();

  const gameStats = await screenshotStats(page, 'platform-game-desktop.png');
  expect(gameStats.colors).toBeGreaterThan(35);
  await expectCanvasPainted(page);
  await expectNoControlOverflow(page);
  expect(observed.errors).toEqual([]);
  expect(observed.failed).toEqual([]);
});

test('a playable run reaches the goal and unlocks the next stage', async ({ page }) => {
  const observed = watchPage(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: '开始冒险' }).click();
  await sprintToGoal(page);

  await expect(page.getByRole('dialog', { name: '旗帜升起' })).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('#result-score')).not.toHaveText('0');
  await expect(page.locator('#result-coins')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: '下一关' })).toBeVisible();
  await screenshotStats(page, 'platform-result-desktop.png');
  expect(await page.evaluate(() => localStorage.getItem('starbound-brothers-unlocked'))).toBe('2');

  await page.getByRole('button', { name: '下一关' }).click();
  await expect(page.locator('#level-name')).toContainText('落日高塔');
  await expect(page.locator('#hud')).toBeVisible();
  expect(observed.errors).toEqual([]);
  expect(observed.failed).toEqual([]);
});

async function mobileFlow(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const observed = watchPage(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '星跃兄弟' })).toBeVisible();
  await expectNoControlOverflow(page);
  const menuStats = await screenshotStats(page, 'platform-menu-mobile.png');
  expect(menuStats.colors).toBeGreaterThan(25);

  await page.getByRole('button', { name: '开始冒险' }).click();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.getByRole('button', { name: '向左移动' })).toBeVisible();
  await expect(page.getByRole('button', { name: '跳跃' })).toBeVisible();

  const progressBefore = await page.locator('#run-progress').getAttribute('style');
  const right = page.getByRole('button', { name: '向右移动' });
  const jump = page.getByRole('button', { name: '跳跃' });
  await right.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await jump.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false });
  await page.waitForTimeout(180);
  await jump.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
  await page.waitForTimeout(950);
  await right.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  await expect.poll(() => page.locator('#run-progress').getAttribute('style')).not.toBe(progressBefore);

  const stats = await screenshotStats(page, 'platform-game-mobile.png');
  expect(stats.colors).toBeGreaterThan(30);
  await expectCanvasPainted(page);
  await expectNoControlOverflow(page);

  const hud = await page.locator('#hud').boundingBox();
  const jumpBox = await jump.boundingBox();
  expect(hud).not.toBeNull();
  expect(jumpBox).not.toBeNull();
  if (hud && jumpBox) expect(hud.y + hud.height).toBeLessThan(jumpBox.y);

  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeVisible();
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeVisible();
  expect(observed.errors).toEqual([]);
  expect(observed.failed).toEqual([]);
  await context.close();
}

test('mobile touch controls stay playable without layout overlap', async ({ browser }) => {
  await mobileFlow(browser);
});
