import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('full-screen painted world, edge HUD, synchronized action feedback and render performance', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'evidence/redesign/videos', size: { width: 1280, height: 800 } } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?room=VISUAL01');
  await expect(page.locator('#world')).toHaveAttribute('data-assets', 'ready');
  const world = await page.locator('#world').boundingBox();
  expect(world.width).toBe(1280); expect(world.height).toBe(800);
  const craft = await page.locator('.craft-panel').boundingBox(); expect(craft.width).toBeLessThan(80);
  await expect(page.locator('.scene-heading')).not.toBeVisible();
  await expect(page.locator('.inventory-slots img')).toHaveCount(8);
  // Feed authentic protocol snapshots into the actual renderer to exercise attack/hit/death,
  // without adding privileged test endpoints to the shipped server.
  await page.evaluate(() => {
    const NativeSocket = window.WebSocket;
    const sockets = [];
    window.WebSocket = class extends NativeSocket { constructor(...args) { super(...args); sockets.push(this); } };
    window.__visualSockets = sockets;
  });
  await page.context().setOffline(true); await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => window.__visualSockets.length)).toBeGreaterThan(0);
  await expect(page.locator('#connection')).toHaveText('已连接');
  const feedback = await page.evaluate(async () => {
    const socket = window.__visualSockets.at(-1);
    let snapshot;
    await new Promise(resolve => {
      function received(event) {
        const message = JSON.parse(event.data);
        if (message.type === 'state') { snapshot = message.state; socket.removeEventListener('message', received); resolve(); }
      }
      socket.addEventListener('message', received);
    });
    const p = snapshot.players[0];
    p.inventory.axe = 1; p.action = { kind: 'attack', at: snapshot.time }; p.hurtAt = snapshot.time;
    snapshot.enemies[0].x = p.x + 40; snapshot.enemies[0].y = p.y; snapshot.enemies[0].hitAt = snapshot.time;
    socket.dispatchEvent(new window.MessageEvent('message', { data: JSON.stringify({ type: 'state', state: snapshot }) }));
    await new Promise(resolve => requestAnimationFrame(resolve));
    return { animation: document.querySelector('#world').dataset.animation, snapshot };
  });
  expect(feedback.animation).toBe('attack');
  await page.screenshot({ path: 'evidence/redesign/attack-hit.png' });
  const timing = await page.evaluate(async () => {
    const frames = [];
    let previous = performance.now();
    for (let i = 0; i < 90; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const now = performance.now(); frames.push(now - previous); previous = now;
    }
    frames.sort((a, b) => a - b);
    return { medianMs: frames[45], p95Ms: frames[85], frames: 90 };
  });
  expect(timing.medianMs).toBeLessThan(45);
  await writeFile('evidence/redesign/performance.json', JSON.stringify({ ...timing, viewport: '1280x800', browserErrors: errors }, null, 2));
  expect(errors).toEqual([]);
  await context.close();
});
