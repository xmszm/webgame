const noise = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const mix = (a, b, t) => a + (b - a) * t;
const ASSETS = ['tree', 'tree-sparse', 'berry', 'grass', 'rock', 'sapling', 'survivor', 'spider', 'terrain', 'item-axe', 'item-torch'];
const HEIGHTS = { tree: 225, grass: 65, rock: 78, berry: 92, sapling: 100 };
// The renderer follows interpolated targets, so these rates only have to remove the
// remaining jitter. Keeping camera and actors identical stops the world from
// scrolling at a different rhythm than the character walks.
const ACTOR_SMOOTHING = 25;
const CAMERA_SMOOTHING = 25;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 1200, y: 1200 };
    this.width = this.height = 0;
    this.scale = 1;
    this.hover = null;
    this.frame = 0;
    this.lastFrame = 0;
    this.actors = new Map();
    this.darkness = document.createElement('canvas');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.assets = {};
    this.alpha = {};
    this.ready = Promise.all(ASSETS.map(name => new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        this.assets[name] = img;
        if (Object.hasOwn(HEIGHTS, name) || name === 'tree-sparse') {
          const mask = document.createElement('canvas'); mask.width = img.width; mask.height = img.height;
          const context = mask.getContext('2d', { willReadFrequently: true });
          context.drawImage(img, 0, 0);
          this.alpha[name] = context.getImageData(0, 0, img.width, img.height).data;
        }
        resolve();
      };
      img.onerror = () => reject(new Error(`游戏素材加载失败：${name}`));
      img.src = new URL(`./art/${name}.png`, document.baseURI).href;
    }))).then(() => {
      this.makeTerrain();
      this.canvas.dataset.assets = 'ready';
    }).catch(error => { this.canvas.dataset.assets = 'error'; this.assetError = error.message; });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }
  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.width = box.width; this.height = box.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = this.width < 600 ? 0.72 : 0.93;
  }
  project(x, y, z = 0) {
    return { x: this.width / 2 + (x - y - this.camera.x + this.camera.y) * 0.82 * this.scale, y: this.height * 0.51 + (x + y - this.camera.x - this.camera.y) * 0.43 * this.scale - z * this.scale };
  }
  unproject(x, y) {
    const dx = (x - this.width / 2) / (0.82 * this.scale), dy = (y - this.height * 0.51) / (0.43 * this.scale);
    return { x: this.camera.x + (dx + dy) / 2, y: this.camera.y + (dy - dx) / 2 };
  }
  ellipse(x, y, rx, ry, color) {
    const c = this.ctx; c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
  makeTerrain() {
    // Cache painted earth once; no checkerboard tiles or per-frame texture allocation.
    const land = document.createElement('canvas'); land.width = land.height = 2600;
    const c = land.getContext('2d');
    c.fillStyle = '#777348'; c.fillRect(0, 0, 2600, 2600);
    const texture = this.assets.terrain;
    // Mirroring adjacent texture sheets removes hard seams without blurring ink marks.
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      c.save(); c.translate(x * 650 + (x % 2 ? 650 : 0), y * 650 + (y % 2 ? 650 : 0)); c.scale(x % 2 ? -1 : 1, y % 2 ? -1 : 1);
      c.drawImage(texture, 0, 0, 650, 650); c.restore();
    }
    c.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 26; i++) {
      const x = noise(i, 3) * 2600, y = noise(i, 4) * 2600, r = 140 + noise(i, 7) * 260;
      c.beginPath();
      for (let j = 0; j < 36; j++) {
        const a = j / 36 * Math.PI * 2, radius = r * (0.85 + noise(i, j) * 0.3);
        const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius * 0.8;
        j ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath(); c.fillStyle = i % 3 ? '#676e4923' : '#94704439'; c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#bfa67b30'; c.lineWidth = 75; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 1280); c.bezierCurveTo(500, 1000, 900, 1540, 1300, 1280); c.bezierCurveTo(1650, 1060, 2000, 1620, 2600, 1320); c.stroke();
    for (let i = 0; i < 7000; i++) {
      const x = noise(i, 12) * 2600, y = noise(i, 17) * 2600;
      c.strokeStyle = i % 2 ? '#34332220' : '#ded0a321'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + noise(i, 21) * 9, y - 2); c.stroke();
    }
    this.terrain = land;
  }
  actor(player, dt) {
    let actor = this.actors.get(player.id);
    if (!actor) { actor = { x: player.x, y: player.y, lastX: player.x, lastY: player.y, movingUntil: 0, facing: 1, gait: 0 }; this.actors.set(player.id, actor); }
    if (Math.hypot(player.x - actor.lastX, player.y - actor.lastY) > 0.1) {
      actor.movingUntil = this.frame + 0.18;
      const dx = player.x - actor.lastX - (player.y - actor.lastY);
      if (Math.abs(dx) > 0.2) actor.facing = dx > 0 ? 1 : -1;
      actor.lastX = player.x; actor.lastY = player.y;
    }
    actor.x = mix(actor.x, player.x, 1 - Math.exp(-dt * ACTOR_SMOOTHING)); actor.y = mix(actor.y, player.y, 1 - Math.exp(-dt * ACTOR_SMOOTHING));
    if (this.frame < actor.movingUntil) actor.gait += dt * 11;
    return actor;
  }
  render(state, id, time) {
    this.frame = time;
    const dt = Math.min(0.05, Math.max(0.001, time - this.lastFrame)); this.lastFrame = time;
    const c = this.ctx, self = state?.players.find(p => p.id === id);
    if (self) { this.camera.x = mix(this.camera.x, self.x, 1 - Math.exp(-dt * CAMERA_SMOOTHING)); this.camera.y = mix(this.camera.y, self.y, 1 - Math.exp(-dt * CAMERA_SMOOTHING)); }
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = '#77704d'; c.fillRect(0, 0, this.width, this.height);
    if (!this.terrain) {
      c.fillStyle = '#e7d8af'; c.font = '20px "Wildwood Serif", serif'; c.textAlign = 'center';
      c.fillText(this.assetError || '荒野正在苏醒…', this.width / 2, this.height / 2);
      return;
    }
    this.drawTerrain();
    if (!state) return;
    const entities = [...state.objects.map(o => ({ ...o, kind: 'resource' })), ...state.fires.map(o => ({ ...o, kind: 'fire' })), ...state.enemies.filter(o => o.health > 0).map(o => ({ ...o, kind: 'enemy' })), ...state.players.map(o => ({ ...o, kind: 'player' }))].sort((a, b) => a.x + a.y - b.x - b.y);
    const selfPos = self ? this.project(self.x, self.y) : null;
    for (const e of entities) {
      const actor = e.kind === 'player' ? this.actor(e, dt) : null;
      const p = this.project(actor?.x ?? e.x, actor?.y ?? e.y);
      if (p.x < -180 || p.x > this.width + 180 || p.y < -120 || p.y > this.height + 270) continue;
      c.save(); c.translate(p.x, p.y); c.scale(this.scale, this.scale);
      if (e.kind === 'resource') {
        // Foreground trees fade only when they would occlude the playable character.
        if (e.type === 'tree' && selfPos && Math.abs(p.x - selfPos.x) < 65 && p.y > selfPos.y && p.y - selfPos.y < 200) c.globalAlpha = 0.42;
        this.drawResource(e, e.id === this.hover, state.time);
      }
      if (e.kind === 'player') this.drawPlayer(e, actor, state.time);
      if (e.kind === 'fire') this.drawFire(e, state.time);
      if (e.kind === 'enemy') this.drawEnemy(e, state.time);
      c.restore();
    }
    if (state.phase !== 'day') this.drawDarkness(state);
    // Light vignette belongs to world illumination, not a boxed webpage.
    const shade = c.createRadialGradient(this.width * 0.5, this.height * 0.48, this.height * 0.2, this.width * 0.5, this.height * 0.48, Math.max(this.width, this.height) * 0.65);
    shade.addColorStop(0, '#15160f00'); shade.addColorStop(1, '#12140da8'); c.fillStyle = shade; c.fillRect(0, 0, this.width, this.height);
    for (const p of state.players) {
      const a = this.actors.get(p.id), pos = this.project(a?.x ?? p.x, a?.y ?? p.y);
      this.drawName(pos.x, pos.y - 139 * this.scale, p.name, p.id === id);
      if (p.action && state.time - p.action.at < 0.65) this.drawAction(pos, p.action, state.time);
    }
    if (self) this.canvas.dataset.animation = self.dead ? 'dead' : self.action && state.time - self.action.at < 0.6 ? self.action.kind : (this.actors.get(id)?.movingUntil > time ? 'walk' : 'idle');
    if (!this.reducedMotion.matches) for (let i = 0; i < 9; i++) {
      const x = (noise(i, 29) * this.width + time * (4 + noise(i, 8) * 8)) % this.width, y = noise(i, 16) * this.height + Math.sin(time * 0.4 + i) * 12;
      this.ellipse(x, y, 1, 1, state.phase === 'night' ? '#dac88277' : '#e0d0a039');
    }
  }
  drawTerrain() {
    const c = this.ctx, p = this.project(-100, -100);
    c.save(); c.transform(0.82 * this.scale, 0.43 * this.scale, -0.82 * this.scale, 0.43 * this.scale, p.x, p.y);
    c.drawImage(this.terrain, 0, 0); c.restore();
  }
  sprite(name, height, x = 0, y = 0, flip = false) {
    const img = this.assets[name]; if (!img) return;
    const width = img.width / img.height * height, c = this.ctx;
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.drawImage(img, -width / 2, -height, width, height); c.restore();
  }
  drawResource(o, hovered, time) {
    const c = this.ctx, h = HEIGHTS[o.type] * (o.type === 'tree' ? 0.92 + o.variant * 0.12 : 0.95 + o.variant * 0.06);
    this.ellipse(6, 1, o.type === 'tree' ? 44 : 26, o.type === 'tree' ? 15 : 9, '#20201640');
    if (hovered && o.amount) { c.strokeStyle = '#d2c49188'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 30, 13, 0, 0, 6.28); c.stroke(); }
    const hitAge = o.hitAt === undefined ? 2 : time - o.hitAt;
    if (hitAge < 0.45 && !this.reducedMotion.matches) c.rotate(Math.sin(hitAge * 35) * (0.45 - hitAge) * 0.05);
    if (!o.amount) {
      if (o.type === 'tree') { const img = this.assets.tree; c.drawImage(img, 120, img.height - 78, 130, 78, -18, -25, 39, 25); }
      else { c.globalAlpha *= 0.5; this.sprite(o.type === 'rock' ? 'rock' : 'grass', 18); }
      return;
    }
    if (o.type === 'tree' || o.type === 'grass' || o.type === 'sapling') {
      if (!this.reducedMotion.matches) c.transform(1, 0, Math.sin(this.frame * 1.1 + o.x) * 0.009, 1, 0, 0);
    }
    this.sprite(o.type === 'tree' && o.variant === 1 ? 'tree-sparse' : o.type, h, 0, 0, o.variant === 2);
  }
  drawPlayer(p, actor, time) {
    const c = this.ctx, img = this.assets.survivor;
    this.ellipse(2, 0, 21, 8, '#17181160');
    if (p.dead) { c.rotate(-Math.PI / 2); this.sprite('survivor', 90, 34, 0); return; }
    const moving = this.frame < actor.movingUntil;
    const actionAge = p.action ? time - p.action.at : 2;
    const acting = actionAge < 0.5;
    const hit = p.hurtAt >= 0 && time - p.hurtAt < 0.35;
    const stride = moving ? Math.sin(actor.gait) : 0;
    const bodyBob = moving ? Math.abs(stride) * 3 : Math.sin(this.frame * 2.3) * 0.6;
    const s = 128 / img.height;
    c.save(); c.scale(actor.facing, 1); c.translate(hit ? Math.sin(time * 90) * 3 : 0, -bodyBob);
    if (hit) c.filter = 'sepia(1) saturate(3) hue-rotate(325deg)';
    c.scale(s, s);
    // Puppet joints retain the painted texture; each leg swings around its hip.
    for (const [x, sign] of [[40, 1], [108, -1]]) {
      c.save(); c.translate(x + 30 - img.width / 2, -142); c.rotate(stride * sign * 0.28);
      c.drawImage(img, x, 320, 68, 142, -30, 0, 68, 142); c.restore();
    }
    const bend = acting && ['gather', 'craft'].includes(p.action.kind) ? Math.sin(actionAge / 0.5 * Math.PI) * 0.17 : 0;
    c.translate(0, -142); c.rotate(bend);
    c.drawImage(img, 43, 0, 125, 320, 43 - img.width / 2, -320, 125, 320);
    // Left and right arms remain individually animated rather than a wobbling whole cutout.
    for (const [x, sign] of [[0, 1], [164, -1]]) {
      c.save(); c.translate(x + 24 - img.width / 2, -185);
      c.rotate(acting ? sign * Math.sin(actionAge / 0.5 * Math.PI) * 0.85 : stride * sign * 0.28);
      c.drawImage(img, x, 270, 48, 106, -24, -7, 48, 106); c.restore();
    }
    c.restore();
    if (p.inventory.axe) { c.save(); c.translate(23 * actor.facing, -35); c.rotate(acting ? Math.sin(actionAge * 12) * 0.9 : -0.3); this.sprite('item-axe', 46); c.restore(); }
    if (p.torchUntil > time) { this.sprite('item-torch', 51, -24 * actor.facing, -33); this.flame(-24 * actor.facing, -79, 7); }
  }
  flame(x, y, size) {
    const c = this.ctx, pulse = this.reducedMotion.matches ? 0 : Math.sin(this.frame * 13) * size * 0.2;
    c.save(); c.translate(x, y);
    for (let i = 0; i < 3; i++) {
      const s = size * (1 - i * 0.23); c.fillStyle = ['#b54f1f', '#ef9c39', '#ffe6a1'][i]; c.strokeStyle = '#512e1d'; c.lineWidth = i ? 0 : 1.5;
      c.beginPath(); c.moveTo(-s, 8); c.bezierCurveTo(-s * 1.5, -s, s * 0.2 + pulse, -s * 1.5, -s * 0.1, -s * 3.5 - pulse); c.bezierCurveTo(s * 0.9, -s * 2.4, s * 0.4, -s * 0.8, s, -s * 1.6); c.bezierCurveTo(s * 1.7, 0, s, s, 0, s); c.closePath(); c.fill(); if (!i) c.stroke();
    }
    c.restore();
  }
  drawFire(f, time) {
    const active = f.until > time, c = this.ctx;
    if (active) {
      const glow = c.createRadialGradient(0, -10, 5, 0, -10, 75); glow.addColorStop(0, '#e4b15a40'); glow.addColorStop(1, '#e4b15a00'); c.fillStyle = glow; c.fillRect(-75, -85, 150, 150);
    }
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.28; c.save(); c.translate(Math.cos(a) * 27, Math.sin(a) * 13); c.rotate(a / 5); this.sprite('rock', 14); c.restore();
    }
    c.strokeStyle = '#211c14'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(-18, -4); c.lineTo(20, 8); c.moveTo(-18, 9); c.lineTo(16, -5); c.stroke();
    c.strokeStyle = '#6a4d30'; c.lineWidth = 6; c.stroke();
    if (active) {
      this.flame(0, -13, 17);
      for (let i = 0; i < 5; i++) {
        const age = (this.frame * 0.55 + i / 5) % 1;
        c.globalAlpha = 1 - age; this.ellipse(Math.sin(age * 8 + i) * 13, -40 - age * 55, 1.2, 1.8, '#efc37f');
      }
    }
  }
  drawEnemy(e, time) {
    this.ellipse(0, 1, 28, 9, '#17170f50');
    const c = this.ctx;
    const age = e.hitAt === undefined ? 2 : time - e.hitAt;
    c.translate(0, Math.sin(this.frame * 7 + e.x) * 1.5);
    if (age < 0.3) { c.rotate(Math.sin(age * 30) * 0.1); c.filter = 'sepia(1) saturate(3) hue-rotate(325deg)'; }
    this.sprite('spider', 68);
    if (e.health < 60) { c.fillStyle = '#17170f'; c.fillRect(-20, -77, 40, 4); c.fillStyle = '#b86142'; c.fillRect(-20, -77, 40 * e.health / 60, 4); }
  }
  drawAction(pos, action, time) {
    const age = time - action.at, c = this.ctx;
    if (!['gather', 'attack'].includes(action.kind)) return;
    c.save(); c.globalAlpha = Math.max(0, 1 - age / 0.65);
    c.strokeStyle = action.kind === 'attack' ? '#efe0b6' : '#b4a16d'; c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, d = 8 + age * 36;
      c.beginPath(); c.moveTo(pos.x + Math.cos(a) * d, pos.y - 30 + Math.sin(a) * d * 0.5); c.lineTo(pos.x + Math.cos(a) * (d + 5), pos.y - 30 + Math.sin(a) * (d + 5) * 0.5); c.stroke();
    }
    c.restore();
  }
  drawName(x, y, name, self) {
    const c = this.ctx; c.font = '12px "Wildwood Serif", serif'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = '#1b1b14'; c.strokeText(name, x, y); c.fillStyle = self ? '#eadbb7' : '#c8d1c3'; c.fillText(name, x, y);
  }
  drawDarkness(state) {
    const c = this.ctx, overlay = this.darkness;
    if (overlay.width !== Math.ceil(this.width) || overlay.height !== Math.ceil(this.height)) { overlay.width = Math.ceil(this.width); overlay.height = Math.ceil(this.height); }
    const o = overlay.getContext('2d'); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, overlay.width, overlay.height);
    o.fillStyle = state.phase === 'night' ? 'rgba(8,14,25,0.88)' : 'rgba(91,42,25,0.27)'; o.fillRect(0, 0, this.width, this.height); o.globalCompositeOperation = 'destination-out';
    const lights = state.fires.filter(f => f.until > state.time).map(f => ({ ...f, radius: 215 }));
    state.players.filter(p => !p.dead && p.torchUntil > state.time).forEach(p => lights.push({ ...p, radius: 175 }));
    for (const f of lights) {
      const p = this.project(f.x, f.y), radius = (f.radius + Math.sin(this.frame * 5) * 3) * this.scale;
      const g = o.createRadialGradient(p.x, p.y - 20, 15, p.x, p.y, radius); g.addColorStop(0, '#000'); g.addColorStop(0.55, '#000000ee'); g.addColorStop(1, '#00000000');
      o.fillStyle = g; o.beginPath(); o.arc(p.x, p.y, radius, 0, 6.28); o.fill();
    }
    c.drawImage(overlay, 0, 0, this.width, this.height);
  }
  hitTest(state, x, y) {
    if (!state) return null;
    return state.objects.filter(o => o.amount > 0).filter(o => {
      const name = o.type === 'tree' && o.variant === 1 ? 'tree-sparse' : o.type;
      const image = this.assets[name], alpha = this.alpha[name];
      if (!image || !alpha) return false;
      const point = this.project(o.x, o.y);
      const height = HEIGHTS[o.type] * (o.type === 'tree' ? 0.92 + o.variant * 0.12 : 0.95 + o.variant * 0.06) * this.scale;
      const width = image.width / image.height * height;
      const u = (x - point.x + width / 2) / width, v = (y - point.y + height) / height;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
      const ix = Math.min(image.width - 1, Math.floor((o.variant === 2 ? 1 - u : u) * image.width));
      const iy = Math.floor(v * image.height);
      return alpha[(iy * image.width + ix) * 4 + 3] > 80;
    }).sort((a, b) => b.x + b.y - a.x - a.y)[0] || null;
  }
}
export function drawMap(canvas, state, id, full = false) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, pad = full ? 24 : 6;
  c.fillStyle = '#332e22'; c.fillRect(0, 0, w, h);
  const scale = Math.min(w - pad * 2, h - pad * 2) / 2400, ox = (w - 2400 * scale) / 2, oy = (h - 2400 * scale) / 2;
  c.fillStyle = '#a39060'; c.fillRect(ox, oy, 2400 * scale, 2400 * scale);
  for (let i = 0; i < 18; i++) {
    c.fillStyle = i % 2 ? '#615d3950' : '#c9b47a40'; c.beginPath(); c.ellipse(ox + noise(i, 8) * 2400 * scale, oy + noise(i, 19) * 2400 * scale, (70 + noise(i, 5) * 400) * scale, (70 + noise(i, 6) * 350) * scale, noise(i, 7), 0, 6.28); c.fill();
  }
  c.strokeStyle = '#4c40294f'; c.lineWidth = full ? 5 : 2; c.beginPath(); c.moveTo(ox, oy + 1150 * scale); c.bezierCurveTo(ox + 1000 * scale, oy + 850 * scale, ox + 1300 * scale, oy + 1600 * scale, ox + 2400 * scale, oy + 1250 * scale); c.stroke();
  if (!state) return;
  for (const o of state.objects.filter(o => o.amount)) { c.fillStyle = { tree: '#333b23', grass: '#877444', rock: '#e0ccb0', berry: '#844739', sapling: '#49502c' }[o.type]; const s = full ? 3 : 1.4; c.fillRect(ox + o.x * scale, oy + o.y * scale, s, s); }
  for (const e of state.enemies.filter(e => e.health > 0)) { c.fillStyle = '#883f32'; c.beginPath(); c.arc(ox + e.x * scale, oy + e.y * scale, full ? 3 : 2, 0, 6.28); c.fill(); }
  for (const f of state.fires.filter(f => f.until > state.time)) { c.fillStyle = '#f7bd67'; c.fillRect(ox + f.x * scale - 3, oy + f.y * scale - 3, 6, 6); }
  for (const p of state.players) {
    const x = ox + p.x * scale, y = oy + p.y * scale;
    c.fillStyle = p.id === id ? '#ffe0a1' : '#a6c4d7'; c.strokeStyle = '#352d20'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, full ? 6 : 3.5, 0, 6.28); c.fill(); c.stroke();
    if (full) { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#231e15'; c.fillText(p.name, x, y - 11); }
  }
}
export function drawClock(canvas, time) {
  const c = canvas.getContext('2d'), cx = 85, cy = 85;
  c.clearRect(0, 0, 170, 170);
  c.fillStyle = '#302920'; c.strokeStyle = '#17140f'; c.lineWidth = 4;
  c.beginPath(); c.arc(cx, cy, 79, 0, 6.28); c.fill(); c.stroke();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * 6.28 - Math.PI / 2, b = (i + 1) / 24 * 6.28 - Math.PI / 2;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 71, a + 0.015, b - 0.015); c.closePath(); c.fillStyle = i < 14 ? '#bdaa69' : i < 19 ? '#a46543' : '#586073'; c.fill();
  }
  c.fillStyle = '#cdbb87'; c.strokeStyle = '#32281a'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 52, 0, 6.28); c.fill(); c.stroke();
  c.strokeStyle = '#e5d5ac'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, 75, 0, 6.28); c.stroke();
  const a = time % 180 / 180 * 6.28 - Math.PI / 2;
  c.fillStyle = '#221d16'; c.beginPath(); c.moveTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62); c.lineTo(cx + Math.cos(a + 0.13) * 82, cy + Math.sin(a + 0.13) * 82); c.lineTo(cx + Math.cos(a - 0.13) * 82, cy + Math.sin(a - 0.13) * 82); c.closePath(); c.fill();
}
