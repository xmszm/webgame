import test from 'node:test';
import assert from 'node:assert/strict';
import { World, phaseAt, RECIPES } from '../server/world.js';

function setup() { const world = new World('TEST01'); return { world, p: world.addPlayer('a', '旅人') }; }
function step(world) { world.tick(0.4); }
test('map is deterministic and phase boundaries are precise', () => {
  assert.deepEqual(new World('X', 1).objects, new World('X', 1).objects);
  assert.notDeepEqual(new World('X', 1).objects, new World('X', 2).objects);
  assert.deepEqual([0, 104.9, 105, 144.9, 145, 179.9, 180].map(phaseAt), ['day', 'day', 'dusk', 'dusk', 'night', 'night', 'day']);
});
test('gather validates proximity, depletion, regenerates and rejects race', () => {
  const { world, p } = setup();
  const target = world.objects.find(o => o.id === 'start0');
  assert.equal(world.command('a', { type: 'gather', id: target.id }).ok, true);
  assert.equal(p.inventory.grass, 1);
  step(world); p.x = 10; p.y = 10;
  assert.equal(world.command('a', { type: 'gather', id: target.id }).ok, false);
  p.x = target.x; p.y = target.y; target.amount = 1;
  assert.equal(world.command('a', { type: 'gather', id: target.id }).ok, true);
  const second = world.addPlayer('b', '同伴'); second.x = target.x; second.y = target.y;
  assert.equal(world.command('b', { type: 'gather', id: target.id }).ok, false);
  world.time = target.regrow; world.tick(0.1); assert.equal(target.amount, 3);
});
test('resource yields and axe bonus are server owned', () => {
  const { world, p } = setup();
  const rock = world.objects.find(o => o.id === 'start3'); p.x = rock.x; p.y = rock.y;
  assert.equal(world.command('a', { type: 'gather', id: rock.id }).ok, true);
  assert.equal(p.inventory.stone, 1); assert.equal(p.inventory.flint, 1);
  step(world); const tree = world.objects.find(o => o.id === 'start4'); p.x = tree.x; p.y = tree.y; p.inventory.axe = 1;
  world.command('a', { type: 'gather', id: tree.id }); assert.equal(p.inventory.wood, 2);
});
test('every recipe spends exact costs, rejects unavailable ingredients and requires fire', () => {
  for (const [name, recipe] of Object.entries(RECIPES)) {
    const { world, p } = setup();
    assert.equal(world.command('a', { type: 'craft', recipe: name }).ok, false);
    for (const [item, count] of Object.entries(recipe.costs)) p.inventory[item] = count;
    if (recipe.needsFire) {
      assert.equal(world.command('a', { type: 'craft', recipe: name }).ok, false);
      world.fires.push({ id: 'f1', x: p.x, y: p.y, until: world.time + 100 });
    }
    assert.equal(world.command('a', { type: 'craft', recipe: name }).ok, true);
    for (const item of Object.keys(recipe.costs)) assert.equal(p.inventory[item], 0);
    if (name === 'campfire') { assert.equal(world.fires.length, 1); assert.equal(p.craftedFire, true); }
    else if (name === 'fuel') assert.equal(world.fires[0].until, world.time + 160);
    else assert.equal(p.inventory[name], 1);
  }
});
test('food and torch are consumed with capped survival benefits', () => {
  const { world, p } = setup();
  p.inventory.berry = 1; p.health = 50; p.hunger = 50;
  assert.equal(world.command('a', { type: 'use', item: 'berry' }).ok, true);
  assert.equal(p.health, 53); assert.equal(p.hunger, 68); assert.equal(p.inventory.berry, 0);
  step(world); assert.equal(world.command('a', { type: 'use', item: 'berry' }).ok, false);
  p.inventory.cooked = 1; p.health = 99; p.hunger = 99;
  world.command('a', { type: 'use', item: 'cooked' }); assert.equal(p.health, 100); assert.equal(p.hunger, 100);
  step(world); p.inventory.torch = 1;
  world.command('a', { type: 'use', item: 'torch' }); assert.equal(p.torchUntil, world.time + 90);
});
test('unlit night damages health and sanity; shared fire protects two players', () => {
  const { world, p } = setup(); const b = world.addPlayer('b', '同行者'); world.enemies = []; world.time = 150;
  world.tick(1); assert.ok(p.health < 100); assert.ok(p.sanity < 100);
  world.fires.push({ id: 'f1', x: 1200, y: 1200, until: 300 });
  const hp = p.health, hpB = b.health; world.tick(1); assert.equal(p.health, hp); assert.equal(b.health, hpB);
  world.fires[0].until = world.time - 1; world.tick(1); assert.ok(p.health < hp);
});
test('starvation, death and revival follow the same authoritative path', () => {
  const { world, p } = setup(); world.enemies = []; p.hunger = 0; p.health = 1;
  world.tick(1); assert.equal(p.dead, true); assert.equal(p.health, 0);
  assert.equal(world.command('a', { type: 'gather', id: 'start0' }).ok, false);
  assert.equal(world.command('a', { type: 'revive' }).ok, true); assert.equal(p.health, 100); assert.equal(p.x, 1200);
  assert.equal(world.command('a', { type: 'revive' }).ok, false);
});
test('movement bounds, normalized speed and invalid inputs', () => {
  const { world, p } = setup();
  assert.equal(world.command('a', { type: 'input', x: Infinity, y: 0 }).ok, false);
  assert.equal(world.command('a', { type: 'move', x: '3', y: 0 }).ok, false);
  world.command('a', { type: 'input', x: 100, y: 100 }); world.tick(1);
  assert.ok(Math.abs(Math.hypot(p.x - 1200, p.y - 1200) - 125) < 0.001);
  p.x = 2330; p.y = 2330; world.tick(1); assert.equal(p.x, 2330); assert.equal(p.y, 2330);
  world.command('a', { type: 'move', x: -999, y: 9999 }); assert.deepEqual(p.target, { x: 70, y: 2330 });
  assert.equal(world.command('a', { type: 'craft', recipe: '__proto__' }).ok, false);
  assert.equal(world.command('a', { type: 'unknown' }).ok, false);
  assert.equal(world.command('missing', { type: 'input', x: 0, y: 0 }).ok, false);
});
test('combat handles range, weapon damage, rewards and fire repulsion', () => {
  const { world, p } = setup(); const enemy = world.enemies[0]; world.enemies = [enemy];
  assert.equal(world.command('a', { type: 'attack' }).ok, false);
  enemy.x = p.x + 20; enemy.y = p.y; p.inventory.axe = 1;
  assert.equal(world.command('a', { type: 'attack' }).ok, true); assert.equal(enemy.health, 30);
  step(world); world.command('a', { type: 'attack' }); assert.equal(enemy.health, 0); assert.equal(p.inventory.berry, 2);
  enemy.health = 60; world.fires.push({ id: 'f', x: p.x, y: p.y, until: world.time + 100 });
  const x = enemy.x; world.tick(1); assert.ok(enemy.x > x);
});
test('room state is isolated, player disconnects and snapshots omit input internals', () => {
  const { world } = setup(); const other = new World('OTHER');
  assert.equal(other.players.size, 0);
  assert.equal('input' in world.snapshot().players[0], false);
  world.removePlayer('a'); assert.equal(world.players.size, 0); assert.match(world.events.at(-1).text, /离开/);
});
test('click-to-move reaches a nearby destination without overshooting', () => {
  const { world, p } = setup();
  world.command('a', { type: 'move', x: 1206, y: 1200 });
  world.tick(0.1); assert.equal(p.x, 1206);
  world.tick(0.1); assert.equal(p.target, null); assert.equal(p.x, 1206);
});
test('chat validates, bounds content and keeps bounded event history', () => {
  const { world } = setup(); assert.equal(world.command('a', { type: 'chat', text: '' }).ok, false);
  for (let i = 0; i < 30; i++) world.command('a', { type: 'chat', text: 'a'.repeat(200) });
  assert.equal(world.events.length, 20); assert.equal(world.events.at(-1).text.length, 103);
});
