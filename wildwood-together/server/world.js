export const WORLD_SIZE = 2400;
export const CYCLE_SECONDS = 180;
export const ITEMS = {
  wood: { name: '木材', description: '制作工具与营火的基础材料' },
  grass: { name: '干草', description: '从草丛采集，用于火把与营火' },
  stone: { name: '石头', description: '从岩石采集，用于加固营火' },
  flint: { name: '燧石', description: '锐利的石片，用于制作斧头' },
  berry: { name: '浆果', description: '食用恢复 18 饥饿与 3 生命' },
  axe: { name: '石斧', description: '树木采集翻倍，攻击伤害提升' },
  torch: { name: '火把', description: '使用后照亮周围 90 秒' },
  cooked: { name: '烤浆果', description: '食用恢复 28 饥饿与 8 生命' },
};
export const RECIPES = {
  axe: { name: '石斧', costs: { wood: 2, flint: 2 } },
  torch: { name: '火把', costs: { grass: 2, wood: 1 } },
  campfire: { name: '营火', costs: { wood: 3, grass: 3 } },
  cooked: { name: '烤浆果', costs: { berry: 1 }, needsFire: true },
  fuel: { name: '添柴', costs: { wood: 1 }, needsFire: true },
};
const TYPES = ['tree', 'grass', 'rock', 'berry', 'sapling'];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function phaseAt(time) {
  const value = ((time % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  return value < 105 ? 'day' : value < 145 ? 'dusk' : 'night';
}
function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
export class World {
  constructor(code, seed = 137) {
    this.code = code;
    this.time = 24;
    this.players = new Map();
    this.objects = [];
    this.fires = [];
    this.enemies = [];
    this.events = [];
    this.sequence = 0;
    this.lastActive = Date.now();
    const random = randomGenerator(seed);
    for (let i = 0; i < 210; i++) {
      const x = 100 + random() * 2200;
      const y = 100 + random() * 2200;
      if (Math.hypot(x - 1200, y - 1200) < 160) continue;
      this.objects.push({ id: `o${i}`, type: TYPES[Math.floor(random() * TYPES.length)], x, y, amount: 3, regrow: 0, variant: Math.floor(random() * 3) });
    }
    // A reproducible clearing ensures every new expedition has reachable basics.
    const clearing = [['grass', 1250, 1180], ['sapling', 1150, 1200], ['grass', 1260, 1250], ['rock', 1130, 1130], ['tree', 1340, 1160], ['berry', 1170, 1280]];
    clearing.forEach(([type, x, y], i) => this.objects.push({ id: `start${i}`, type, x, y, amount: 6, regrow: 0, variant: i % 3 }));
    for (let i = 0; i < 7; i++) this.enemies.push({ id: `e${i}`, x: 420 + random() * 1550, y: 300 + random() * 550, health: 60, cooldown: 0, respawn: 0 });
  }
  addPlayer(id, name) {
    const player = { id, name, x: 1200, y: 1200, health: 100, hunger: 100, sanity: 100, inventory: Object.fromEntries(Object.keys(ITEMS).map(key => [key, 0])), input: { x: 0, y: 0 }, target: null, torchUntil: 0, actionAt: -1, hurtAt: -1, dead: false, collected: 0, craftedFire: false, color: this.players.size % 4 };
    this.players.set(id, player);
    this.lastActive = Date.now();
    this.event(`${name} 来到了荒野`, 'join');
    return player;
  }
  event(text, kind = 'info') {
    this.events.push({ id: ++this.sequence, text, kind });
    if (this.events.length > 20) this.events.shift();
  }
  removePlayer(id) {
    const player = this.players.get(id);
    if (player) this.event(`${player.name} 离开了世界`, 'leave');
    this.players.delete(id);
    this.lastActive = Date.now();
  }
  fail(message) { return { ok: false, message }; }
  command(id, message) {
    const p = this.players.get(id);
    if (!p) return this.fail('请先加入世界');
    if (message.type === 'chat') {
      const text = typeof message.text === 'string' ? message.text.trim().slice(0, 100) : '';
      if (!text) return this.fail('消息不能为空');
      this.event(`${p.name}：${text}`, 'chat');
      return { ok: true };
    }
    if (message.type === 'revive') {
      if (!p.dead) return this.fail('你还活着');
      Object.assign(p, { x: 1200, y: 1200, health: 100, hunger: 80, sanity: 80, dead: false, target: null, input: { x: 0, y: 0 } });
      return { ok: true, message: '你在出生地重新醒来' };
    }
    if (p.dead) return this.fail('你已倒下，请重新出发');
    if (message.type === 'input') {
      if (!Number.isFinite(message.x) || !Number.isFinite(message.y)) return this.fail('无效方向');
      const length = Math.max(1, Math.hypot(message.x, message.y));
      p.input = { x: message.x / length, y: message.y / length };
      p.target = null;
      return { ok: true };
    }
    if (message.type === 'move') {
      if (!Number.isFinite(message.x) || !Number.isFinite(message.y)) return this.fail('无效位置');
      p.target = { x: clamp(message.x, 70, WORLD_SIZE - 70), y: clamp(message.y, 70, WORLD_SIZE - 70) };
      p.input = { x: 0, y: 0 };
      return { ok: true };
    }
    if (this.time - p.actionAt < 0.32) return this.fail('动作太快，请稍候');
    if (message.type === 'gather') {
      const object = this.objects.find(o => o.id === message.id) ?? this.objects.filter(o => o.amount > 0 && distance(p, o) <= 105).sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (!object || object.amount <= 0) return this.fail('附近没有可采集的资源');
      if (distance(p, object) > 105) return this.fail('再靠近一点才能采集');
      const resource = { tree: 'wood', sapling: 'wood', grass: 'grass', rock: 'stone', berry: 'berry' }[object.type];
      const count = object.type === 'tree' && p.inventory.axe > 0 ? 2 : 1;
      p.inventory[resource] += count;
      if (object.type === 'rock') p.inventory.flint++;
      object.amount--;
      if (!object.amount) object.regrow = this.time + 90;
      p.collected += count;
      p.actionAt = this.time;
      p.action = { kind: 'gather', at: this.time, target: object.id };
      object.hitAt = this.time;
      return { ok: true, message: `获得 ${ITEMS[resource].name} ×${count}${object.type === 'rock' ? '、燧石 ×1' : ''}` };
    }
    if (message.type === 'craft') {
      const recipe = Object.hasOwn(RECIPES, message.recipe) ? RECIPES[message.recipe] : null;
      if (!recipe) return this.fail('未知配方');
      const fire = this.fires.find(f => f.until > this.time && distance(p, f) < 170);
      if (recipe.needsFire && !fire) return this.fail('需要靠近燃烧的营火');
      if (Object.entries(recipe.costs).some(([key, count]) => p.inventory[key] < count)) return this.fail('材料不足，请先采集');
      if (message.recipe === 'campfire' && this.fires.some(f => distance(p, f) < 70)) return this.fail('营火之间需要留出一点距离');
      for (const [key, count] of Object.entries(recipe.costs)) p.inventory[key] -= count;
      if (message.recipe === 'campfire') {
        this.fires.push({ id: `f${++this.sequence}`, x: p.x, y: p.y + 24, until: this.time + 150 });
        p.craftedFire = true;
        this.event(`${p.name} 生起了一堆营火`, 'craft');
      } else if (message.recipe === 'fuel') fire.until = Math.max(fire.until, this.time) + 60;
      else p.inventory[message.recipe]++;
      p.actionAt = this.time;
      p.action = { kind: 'craft', at: this.time };
      return { ok: true, message: `${recipe.name}已${message.recipe === 'fuel' ? '完成' : '制作'}` };
    }
    if (message.type === 'use') {
      const item = message.item;
      if (!['berry', 'cooked', 'torch'].includes(item)) return this.fail('该物品无需手动使用');
      if (p.inventory[item] < 1) return this.fail('背包里没有该物品');
      p.inventory[item]--;
      if (item === 'torch') p.torchUntil = this.time + 90;
      else {
        p.hunger = Math.min(100, p.hunger + (item === 'berry' ? 18 : 28));
        p.health = Math.min(100, p.health + (item === 'berry' ? 3 : 8));
      }
      p.actionAt = this.time;
      p.action = { kind: 'use', at: this.time };
      return { ok: true, message: item === 'torch' ? '火把已点燃，可持续 90 秒' : `食用了${ITEMS[item].name}` };
    }
    if (message.type === 'attack') {
      const enemy = this.enemies.filter(e => e.health > 0 && distance(p, e) < 120).sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (!enemy) return this.fail('附近没有可攻击的怪物');
      enemy.health -= p.inventory.axe ? 30 : 15;
      enemy.hitAt = this.time;
      p.action = { kind: 'attack', at: this.time, target: enemy.id };
      if (enemy.health <= 0) { enemy.respawn = this.time + 150; p.inventory.berry += 2; this.event(`${p.name} 击退了暗影爬虫`, 'combat'); }
      p.actionAt = this.time;
      return { ok: true, message: enemy.health > 0 ? '命中暗影爬虫' : '击败爬虫，获得浆果 ×2' };
    }
    return this.fail('未知操作');
  }
  tick(dt) {
    this.time += dt;
    const phase = phaseAt(this.time);
    for (const o of this.objects) if (!o.amount && this.time >= o.regrow) o.amount = 3;
    this.fires = this.fires.filter(f => f.until + 30 > this.time);
    for (const p of this.players.values()) {
      if (p.dead) continue;
      let vector = p.input;
      if (p.target) {
        const d = distance(p, p.target);
        if (d < 5) p.target = null;
        else vector = { x: (p.target.x - p.x) / d, y: (p.target.y - p.y) / d };
      }
      if (p.target || Math.hypot(vector.x, vector.y) > 0) {
        const travel = p.target ? Math.min(125 * dt, distance(p, p.target)) : 125 * dt;
        p.x = clamp(p.x + vector.x * travel, 70, WORLD_SIZE - 70);
        p.y = clamp(p.y + vector.y * travel, 70, WORLD_SIZE - 70);
      }
      const lit = p.torchUntil > this.time || this.fires.some(f => f.until > this.time && distance(p, f) < 185);
      p.hunger = Math.max(0, p.hunger - dt * 0.13);
      p.sanity = clamp(p.sanity + dt * (phase === 'night' && !lit ? -1.1 : lit ? 0.25 : 0.03), 0, 100);
      if (p.hunger <= 0) p.health -= dt * 1.2;
      if (phase === 'night' && !lit) { p.health -= dt * 1.8; p.hurtAt = this.time; }
      if (p.health <= 0) { p.health = 0; p.dead = true; p.target = null; p.input = { x: 0, y: 0 }; this.event(`${p.name} 倒在了荒野中`, 'death'); }
    }
    for (const enemy of this.enemies) {
      if (enemy.health <= 0) { if (this.time > enemy.respawn) enemy.health = 60; continue; }
      const prey = [...this.players.values()].filter(p => !p.dead).sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
      if (!prey || distance(prey, enemy) > (phase === 'night' ? 650 : 210)) continue;
      const repelled = this.fires.some(f => f.until > this.time && distance(enemy, f) < 190);
      const d = Math.max(1, distance(prey, enemy));
      const sign = repelled ? -1 : 1;
      enemy.x = clamp(enemy.x + sign * (prey.x - enemy.x) / d * 48 * dt, 80, 2320);
      enemy.y = clamp(enemy.y + sign * (prey.y - enemy.y) / d * 48 * dt, 80, 2320);
      if (d < 36 && !repelled && this.time > enemy.cooldown) { prey.health = Math.max(0, prey.health - 8); prey.hurtAt = this.time; enemy.cooldown = this.time + 1.5; }
    }
  }
  snapshot() {
    return { code: this.code, time: this.time, day: Math.floor(this.time / CYCLE_SECONDS) + 1, phase: phaseAt(this.time), objects: this.objects, fires: this.fires, enemies: this.enemies, events: this.events, players: [...this.players.values()].map(({ input: _input, target: _target, actionAt: _actionAt, ...p }) => p) };
  }
}
