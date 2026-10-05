import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

function observe(page) {
  const data = { state: null, id: null, errors: [], results: [] };
  page.on('pageerror', error => data.errors.push(error.message));
  page.on('websocket', ws => ws.on('framereceived', event => {
    let message; try { message = JSON.parse(event.payload); } catch { return; }
    if (message.type === 'state') data.state = message.state;
    if (message.type === 'joined') data.id = message.id;
    if (message.type === 'result') data.results.push(message);
  }));
  return data;
}
const me = data => data.state?.players.find(p => p.id === data.id);
async function ready(page, data, code) {
  await page.goto(`/?room=${code}`);
  await expect.poll(() => !!me(data)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#world')).toHaveAttribute('data-assets', 'ready');
}
async function clickResource(page, data, id) {
  const object = data.state.objects.find(o => o.id === id);
  const p = me(data), rect = await page.locator('#world').boundingBox();
  // Camera interpolation has settled before screen-space interaction.
  const scale = rect.width < 600 ? 0.72 : 0.93;
  const x = rect.x + rect.width / 2 + (object.x - object.y - p.x + p.y) * 0.82 * scale;
  const y = rect.y + rect.height * 0.51 + (object.x + object.y - p.x - p.y) * 0.43 * scale - 7 * scale;
  // Pick an actual opaque pixel of this target, not a transparent gap near its base.
  // Other trees can overlap it; match renderer hit-test rather than clicking blindly.
  for (const dy of [-10, -20, -32, -45, -60, -80, -105]) {
    for (const dx of [0, -7, 7, -15, 15]) {
      await page.mouse.move(x + dx * scale, y + dy * scale);
      if (await page.locator('#world').getAttribute('data-hover') === id) {
        await page.mouse.click(x + dx * scale, y + dy * scale);
        return;
      }
    }
  }
  throw new Error(`Resource ${id} has no exposed opaque hit point`);
}

test('two real browser clients share movement, gathering, campfire, chat and disconnect', async ({ browser }) => {
  test.setTimeout(180_000);
  await mkdir('evidence', { recursive: true });
  const aContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'evidence/redesign/videos', size: { width: 1440, height: 900 } } });
  const bContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await aContext.newPage(), b = await bContext.newPage();
  const da = observe(a), db = observe(b), code = `T${Date.now().toString(36).toUpperCase()}`;
  await ready(a, da, code); await ready(b, db, code);
  await expect.poll(() => da.state.players.length).toBe(2);
  await expect(b.locator('#room-count')).toContainText('2/8');
  const start = { x: me(da).x, y: me(da).y };
  await a.keyboard.down('d'); await expect.poll(() => me(da).x - start.x).toBeGreaterThan(30);
  await expect(a.locator('#world')).toHaveAttribute('data-animation', 'walk');
  await a.screenshot({ path: 'evidence/redesign/walk-frame.png' });
  await a.keyboard.up('d');
  await expect.poll(() => db.state.players.find(p => p.id === da.id)?.x - start.x).toBeGreaterThan(30);
  await a.keyboard.down('a'); await expect.poll(() => me(da).x, { intervals: [20] }).toBeLessThan(start.x + 6); await a.keyboard.up('a');
  // Gather through actual pointer interactions with scene objects.
  await expect.poll(() => Math.abs(me(da).x - 1200)).toBeLessThan(12);
  for (let i = 0; i < 3; i++) {
    await clickResource(a, da, 'start1');
    await expect.poll(() => me(da).inventory.wood).toBe(i + 1);
    if (i === 0) {
      await expect(a.locator('#world')).toHaveAttribute('data-animation', 'gather');
      await a.screenshot({ path: 'evidence/redesign/gather-frame.png' });
      await expect.poll(() => db.state.players.find(p => p.id === da.id)?.action?.kind).toBe('gather');
    }
    await expect.poll(() => da.state.time - me(da).hurtAt).toBeGreaterThan(0.4);
    await a.waitForTimeout(450);
  }
  for (let i = 0; i < 3; i++) {
    await clickResource(a, da, 'start0');
    await expect.poll(() => me(da).inventory.grass).toBe(i + 1);
    await a.waitForTimeout(450);
  }
  await expect.poll(() => db.state.objects.find(o => o.id === 'start0').amount).toBe(3);
  await a.locator('[data-recipe="campfire"]').click();
  await expect.poll(() => da.state.fires.length).toBe(1);
  await expect.poll(() => db.state.fires.length).toBe(1);
  expect(me(da).inventory.wood).toBe(0); expect(me(da).inventory.grass).toBe(0);
  await expect(a.locator('#objective-count')).toHaveText('完成');
  await a.locator('#chat-button').click();
  await a.locator('#chat-input').fill('一起守住这堆火！');
  await a.locator('#chat-form button').click();
  await expect.poll(() => db.state.events.some(e => e.text.includes('一起守住这堆火'))).toBe(true);
  await b.locator('#chat-button').click();
  await expect(b.locator('#messages')).toContainText('一起守住这堆火');
  await b.locator('#close-chat').click();
  await a.locator('#close-chat').click();
  await a.locator('#help-button').click(); await expect(a.locator('#help-dialog')).toBeVisible(); await a.keyboard.press('Escape');
  await a.locator('#map-button').click(); await expect(a.locator('#map-dialog')).toBeVisible(); await a.keyboard.press('Escape');
  await expect(a.locator('#toast')).not.toBeVisible();
  await a.screenshot({ path: 'evidence/desktop.png', fullPage: true });
  // Shared fire protects both real browser players during the actual server day/night cycle.
  await expect.poll(() => da.state.phase, { timeout: 140_000, intervals: [1000] }).toBe('night');
  const hpA = me(da).health, hpB = me(db).health;
  const sanityA = me(da).sanity;
  await expect.poll(() => da.state.time % 180, { timeout: 15_000 }).toBeGreaterThan(150);
  expect(me(da).health).toBe(hpA); expect(me(db).health).toBe(hpB);
  expect(me(da).sanity).toBeGreaterThanOrEqual(sanityA);
  await a.screenshot({ path: 'evidence/night.png', fullPage: true });
  const evidence = { room: code, players: da.state.players.map(p => ({ name: p.name, id: p.id })), sharedFire: da.state.fires[0], sharedResourceAmount: db.state.objects.find(o => o.id === 'start0').amount, movementSeenByPeer: true, chatSeenByPeer: true, actualNightCycle: true, sharedFireProtectedTwoPlayers: true, browserErrors: [...da.errors, ...db.errors] };
  await bContext.close();
  await expect.poll(() => da.state.players.length).toBe(1);
  evidence.disconnectSeenByPeer = true;
  await writeFile('evidence/multiplayer.json', JSON.stringify(evidence, null, 2));
  expect(da.errors).toEqual([]); expect(db.errors).toEqual([]);
  await aContext.close();
});

test('mobile touchscreen layout supports actual movement, crafting panel, inventory and map', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage(), data = observe(page);
  await ready(page, data, `M${Date.now().toString(36).toUpperCase()}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.touch-controls')).toBeVisible();
  const x = me(data).x;
  const button = await page.locator('[data-direction="right"]').boundingBox();
  await page.mouse.move(button.x + 15, button.y + 15); await page.mouse.down();
  await expect.poll(() => me(data).x - x).toBeGreaterThan(20); await page.mouse.up();
  await page.locator('#mobile-craft').tap(); await expect(page.locator('.craft-panel')).toBeVisible();
  await page.locator('[data-recipe="axe"]').tap(); await expect(page.locator('#toast')).toContainText('材料不足');
  await page.locator('#mobile-craft').tap();
  await page.locator('#mobile-bag').tap(); await expect(page.locator('.inventory-bar')).toBeVisible();
  await page.locator('#mobile-bag').tap();
  await page.locator('#map-button').tap(); await expect(page.locator('#map-dialog')).toBeVisible();
  await page.locator('[data-close="map-dialog"]').tap();
  await expect(page.locator('#toast')).not.toBeVisible();
  await page.screenshot({ path: 'evidence/mobile.png', fullPage: true });
  expect(data.errors).toEqual([]);
  await writeFile('evidence/mobile.json', JSON.stringify({ noHorizontalOverflow: true, movement: true, craftError: true, bag: true, map: true, browserErrors: data.errors }, null, 2));
  await context.close();
});

test('world creation, room isolation, form validation and safe chat rendering', async ({ page }) => {
  const data = observe(page); await ready(page, data, 'ISOLATE');
  await page.locator('#room-button').click();
  await page.locator('#name-input').fill('<b>旅人</b>');
  await page.locator('#code-input').fill('!');
  await page.locator('#join-form button[type="submit"]').click();
  await expect(page.locator('#room-dialog')).toBeVisible();
  await page.locator('#create-world').click();
  await expect(page.locator('#room-dialog')).not.toBeVisible();
  await expect.poll(() => data.state.code).not.toBe('ISOLATE'); expect(data.state.players.length).toBe(1);
  await page.locator('#chat-button').click();
  await page.locator('#chat-input').fill('<img src=x onerror=alert(1)>'); await page.locator('#chat-form button').click();
  await expect(page.locator('#messages')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#messages img')).toHaveCount(0);
  expect(data.errors).toEqual([]);
});

test('network interruption reconnects without frozen movement', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage(), data = observe(page);
  await ready(page, data, `R${Date.now().toString(36).toUpperCase()}`);
  const oldId = data.id;
  await context.setOffline(true);
  await expect(page.locator('#connection')).not.toHaveText('已连接', { timeout: 40_000 });
  await context.setOffline(false);
  await expect.poll(() => data.id !== oldId, { timeout: 20_000 }).toBe(true);
  await expect(page.locator('#connection')).toHaveText('已连接');
  expect(me(data).x).toBe(1200); expect(me(data).y).toBe(1200);
  expect(data.errors).toEqual([]);
  await context.close();
});
