import { expect, test, type Browser, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const artifactDir = path.resolve('artifacts');

async function recordScreenshot(page: Page, name: string): Promise<{ colors: number; darkRatio: number }> {
  await fs.mkdir(artifactDir, { recursive: true });
  const image = await page.screenshot({ path: path.join(artifactDir, name), fullPage: true, animations: 'disabled' });
  const png = PNG.sync.read(image);
  const colors = new Set<number>();
  let darkPixels = 0;
  let sampled = 0;
  for (let y = 0; y < png.height; y += 6) {
    for (let x = 0; x < png.width; x += 6) {
      const index = (y * png.width + x) * 4;
      const red = png.data[index] ?? 0;
      const green = png.data[index + 1] ?? 0;
      const blue = png.data[index + 2] ?? 0;
      const alpha = png.data[index + 3] ?? 0;
      if (alpha > 0) {
        colors.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
        if (red + green + blue < 90) darkPixels += 1;
        sampled += 1;
      }
    }
  }
  return { colors: colors.size, darkRatio: darkPixels / Math.max(sampled, 1) };
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function expectNoButtonOverflow(page: Page): Promise<void> {
  const overflow = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons
      .filter((button) => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)
      .map((button) => ({ text: button.textContent?.trim(), width: [button.clientWidth, button.scrollWidth], height: [button.clientHeight, button.scrollHeight] })),
  );
  expect(overflow).toEqual([]);
}

async function runMobileCheck(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle('5.6-sol我的世界');
  await expect(page.getByRole('heading', { name: /5.6-sol.*我的世界/ })).toBeVisible();
  await expectNoButtonOverflow(page);
  const menuStats = await recordScreenshot(page, 'menu-mobile.png');
  expect(menuStats.colors).toBeGreaterThan(24);

  await page.getByRole('button', { name: '进入世界' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.getByRole('button', { name: '采掘方块' })).toBeVisible();

  const joystick = await page.locator('#joystick').boundingBox();
  const hotbar = await page.locator('#hotbar').boundingBox();
  const actions = await page.locator('.touch-actions').boundingBox();
  expect(joystick).not.toBeNull();
  expect(hotbar).not.toBeNull();
  expect(actions).not.toBeNull();
  if (joystick && hotbar && actions) {
    expect(joystick.y + joystick.height).toBeLessThanOrEqual(hotbar.y);
    expect(actions.y + actions.height).toBeLessThanOrEqual(hotbar.y + 1);
  }

  const stats = await recordScreenshot(page, 'world-mobile.png');
  expect(stats.colors).toBeGreaterThan(24);
  expect(stats.darkRatio).toBeLessThan(0.8);
  await expectNoButtonOverflow(page);

  const mobilePosition = await page.locator('#position-readout').textContent();
  if (joystick) {
    const centerX = joystick.x + joystick.width / 2;
    const centerY = joystick.y + joystick.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY - 36, { steps: 4 });
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect.poll(() => page.locator('#position-readout').textContent()).not.toBe(mobilePosition);
  }
  await page.getByRole('button', { name: '跳跃' }).click();
  await page.getByRole('button', { name: '采掘方块' }).click();
  await expect(page.locator('#toast')).not.toBeEmpty();
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续游戏' })).toBeFocused();
  expect(errors).toEqual([]);
  await context.close();
}

test('desktop core sandbox flow renders and persists', async ({ page }) => {
  const errors = watchErrors(page);
  await fs.mkdir(artifactDir, { recursive: true });
  await page.goto('/');
  await expect(page).toHaveTitle('5.6-sol我的世界');
  await expect(page.getByRole('heading', { name: /5.6-sol.*我的世界/ })).toBeVisible();
  await expect(page.locator('#world-summary')).toContainText('世界 #');
  await expectNoButtonOverflow(page);

  const menuStats = await recordScreenshot(page, 'menu-desktop.png');
  expect(menuStats.colors).toBeGreaterThan(24);
  expect(menuStats.darkRatio).toBeLessThan(0.8);

  await page.getByRole('button', { name: '进入世界' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#start-screen')).toHaveClass(/is-hidden/);
  await page.waitForTimeout(300);

  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id ?? '')).toBe('game-canvas');
  const before = await page.locator('#position-readout').textContent();
  for (const key of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(1_500);
    await page.keyboard.up(key);
    if (await page.locator('#position-readout').textContent() !== before) break;
  }
  await expect.poll(() => page.locator('#position-readout').textContent()).not.toBe(before);

  await page.mouse.move(720, 650);
  await expect.poll(() => page.locator('#target-label').textContent()).not.toBe('');
  await page.mouse.click(720, 650, { button: 'right' });
  await page.waitForTimeout(180);
  await page.mouse.click(720, 650, { button: 'right' });
  await expect(page.locator('#toast')).toContainText('放置');
  await page.mouse.click(720, 650, { button: 'left' });
  await page.waitForTimeout(180);
  await page.mouse.click(720, 650, { button: 'left' });
  await expect(page.locator('#toast')).toContainText('采掘');

  const gameStats = await recordScreenshot(page, 'world-desktop.png');
  expect(gameStats.colors).toBeGreaterThan(24);
  expect(gameStats.darkRatio).toBeLessThan(0.8);
  await expectNoButtonOverflow(page);

  const saved = await page.evaluate(() => localStorage.getItem('sol56-minecraft-world-v1'));
  expect(saved).toContain('edits');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续游戏' })).toBeFocused();
  await page.screenshot({ path: path.join(artifactDir, 'pause-desktop.png'), fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: '重建世界' }).click();
  await expect(page.getByRole('dialog', { name: '创建新世界？' })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消' })).toBeFocused();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('dialog', { name: '游戏暂停' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续游戏' })).toBeFocused();

  await page.getByRole('button', { name: '保存并退出' }).click();
  await expect(page.locator('#start-screen')).not.toHaveClass(/is-hidden/);
  const savedWorldLabel = await page.locator('#world-summary').textContent();
  await page.reload();
  await expect(page.locator('#world-summary')).toHaveText(savedWorldLabel ?? '');
  await expect(page.locator('#world-summary')).toContainText('已保存');
  expect(errors).toEqual([]);
});

test('mobile controls and safe-area layout remain usable', async ({ browser }) => {
  await runMobileCheck(browser);
});
