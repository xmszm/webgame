import './style.css';
import { icon, hydrateIcons } from './icons.js';
import { Renderer, drawClock, drawMap } from './renderer.js';
import { ITEMS, RECIPES } from '../server/world.js';

const $ = id => document.getElementById(id);
const assetUrl = key => new URL(`./art/item-${key}.png`, document.baseURI).href;
hydrateIcons();
const renderer = new Renderer($('world'));
const itemKeys = Object.keys(ITEMS);
const objectNames = { tree: '常青树', grass: '干草丛', rock: '岩石', berry: '浆果灌木', sapling: '小树枝' };
const recipeDetails = {
  axe: { category: 'tools', description: '更快采木，更有力地反击' },
  torch: { category: 'survival', description: '带一束光，走进黑夜' },
  campfire: { category: 'survival', description: '黑夜中，你们共同的庇护所' },
  cooked: { category: 'survival', description: '在营火旁，把食物烤熟' },
  fuel: { category: 'survival', description: '让营火再燃烧 60 秒' },
};
let socket;
let state = null;
let worldObjects = [];
let playerId = null;
let category = 'all';
let pendingGather = null;
let lastAutoGather = 0;
let toastTimer;
let reconnectTimer;
let retryDelay = 1000;
let connectedOnce = false;
let dialogPreviouslyFocused;
let audio = null;
let audioEnabled = false;
let lastAudioPhase;
let inputDirection = { x: 0, y: 0 };
let inventorySignature = '';
let recipesSignature = '';
let playersSignature = '';
let eventsSignature = '';
const keys = new Set();
const stored = (() => { try { return JSON.parse(localStorage.getItem('wildwood-profile') || '{}'); } catch { return {}; } })();
const profile = { name: stored.name || '林间旅人', code: new URLSearchParams(location.search).get('room') || stored.code || 'WILD01' };

// Snapshots arrive about ten times a second. Drawing those raw positions makes the
// character lurch forward and then glide, so the renderer is fed positions
// interpolated between two snapshots. The interpolation runs on the *server's*
// clock rather than on arrival times: snapshots reach the client unevenly (bunched
// or delayed by the network), while their server timestamps are evenly spaced, so
// interpolating against them keeps the walking speed constant. A sliding minimum of
// the observed network delay keeps that clock honest, and the render moment stays a
// fixed distance behind the newest snapshot. If the stream stalls long enough to
// outrun the buffer the position holds until data arrives, which the renderer's
// smoothing turns into a short slowdown instead of a jump.
const RENDER_DELAY_MS = 200;
const CLOCK_WINDOW_MS = 2400;
const snapshotHistory = [];
function rememberSnapshot(next) {
  const receivedAt = performance.now();
  const serverMs = next.time * 1000;
  snapshotHistory.push({ serverMs, receivedAt, state: next });
  while (snapshotHistory.length > 2 && snapshotHistory[1].serverMs < serverMs - CLOCK_WINDOW_MS) snapshotHistory.shift();
}
function interpolateEntities(older, newer, key, k) {
  return newer[key].map(entity => {
    const before = older[key].find(item => item.id === entity.id);
    return before ? { ...entity, x: before.x + (entity.x - before.x) * k, y: before.y + (entity.y - before.y) * k } : entity;
  });
}
// The server sends the resource map once and afterwards only the objects whose
// revision changed, so the client keeps one merged list for the whole session.
function mergeObjects(existing, delta) {
  if (!delta || !delta.length) return existing;
  if (!existing || !existing.length) return delta;
  const known = new Map(existing.map(object => [object.id, object]));
  for (const object of delta) {
    const current = known.get(object.id);
    if (current) Object.assign(current, object);
    else { existing.push(object); known.set(object.id, object); }
  }
  return existing;
}
function renderState(now) {
  const newest = snapshotHistory[snapshotHistory.length - 1];
  if (!newest) return state;
  if (snapshotHistory.length < 2) return newest.state;
  // Best-case latency in the recent window: the server clock we can trust.
  let offset = Infinity;
  for (const snapshot of snapshotHistory) offset = Math.min(offset, snapshot.receivedAt - snapshot.serverMs);
  const oldest = snapshotHistory[0];
  const at = Math.max(now - offset - RENDER_DELAY_MS, oldest.serverMs);
  let older = null, newer = null;
  for (let i = snapshotHistory.length - 1; i > 0; i--) {
    if (snapshotHistory[i - 1].serverMs <= at && snapshotHistory[i].serverMs >= at) { older = snapshotHistory[i - 1]; newer = snapshotHistory[i]; break; }
  }
  if (!older || !newer || newer.serverMs === older.serverMs) return newest.state;
  const k = Math.min(1, Math.max(0, (at - older.serverMs) / (newer.serverMs - older.serverMs)));
  return {
    ...newer.state,
    players: interpolateEntities(older.state, newer.state, 'players', k),
    enemies: interpolateEntities(older.state, newer.state, 'enemies', k),
  };
}
$('name-input').value = profile.name;
$('code-input').value = profile.code;

function saveProfile() {
  try { localStorage.setItem('wildwood-profile', JSON.stringify(profile)); } catch { /* Browsing without storage still permits play. */ }
  const url = new URL(location.href);
  url.searchParams.set('room', profile.code);
  history.replaceState(null, '', url);
}
function toast(message, error = false) {
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  $('toast').classList.toggle('error', error);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3000);
}
function send(message) {
  if (socket?.readyState !== WebSocket.OPEN || !playerId && message.type !== 'join') {
    toast('连接尚未就绪，正在重新连接…', true);
    return false;
  }
  socket.send(JSON.stringify(message));
  return true;
}
function self() { return state?.players.find(p => p.id === playerId); }
function connection(text, offline = false) {
  $('connection').textContent = text;
  $('connection').classList.toggle('offline', offline);
}
function connect() {
  clearTimeout(reconnectTimer);
  connection(connectedOnce ? '正在重连…' : '正在连接…', true);
  const endpoint = new URL(import.meta.env.VITE_GAME_SERVER_URL || './ws', document.baseURI);
  endpoint.protocol = endpoint.protocol === 'https:' || endpoint.protocol === 'wss:' ? 'wss:' : 'ws:';
  socket = new WebSocket(endpoint.href);
  socket.addEventListener('open', () => {
    retryDelay = 1000;
    send({ type: 'join', ...profile, v: 2 });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.type === 'joined') {
      playerId = message.id;
      profile.code = message.code;
      profile.name = message.name;
      worldObjects = message.objects || [];
      $('code-input').value = message.code;
      $('name-input').value = message.name;
      saveProfile();
      connection('已连接');
      if (connectedOnce) toast(`已进入世界 ${message.code}`);
      connectedOnce = true;
      inventorySignature = recipesSignature = playersSignature = eventsSignature = '';
      pendingGather = null;
      closeDialog($('room-dialog'));
    }
    if (message.type === 'state') {
      worldObjects = mergeObjects(worldObjects, message.state.objects);
      state = { ...message.state, objects: worldObjects };
      rememberSnapshot(state);
      updateUI();
      if (pendingGather && self()) {
        const target = state.objects.find(o => o.id === pendingGather);
        if (!target || !target.amount) pendingGather = null;
        else if (Math.hypot(target.x - self().x, target.y - self().y) < 91 && Date.now() - lastAutoGather > 450) {
          send({ type: 'input', x: 0, y: 0 });
          send({ type: 'gather', id: target.id });
          lastAutoGather = Date.now();
          pendingGather = null;
        }
      }
    }
    if (message.type === 'error' || message.type === 'result') {
      if (message.message) toast(message.message, message.type === 'error' || !message.ok);
      if (message.ok) playChime();
      if (message.type === 'error' && !playerId) openDialog($('room-dialog'));
    }
  });
  socket.addEventListener('close', () => {
    playerId = null;
    keys.clear();
    inputDirection = { x: 0, y: 0 };
    connection('连接中断', true);
    $('world-alert').classList.remove('hidden');
    $('world-alert').textContent = '连接已中断，正在重连。重连后将以新旅人身份出发。';
    if (navigator.onLine) reconnectTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(10000, retryDelay * 2);
  });
  socket.addEventListener('error', () => connection('无法连接', true));
}
function nearest() {
  const p = self();
  if (!p || p.dead) return null;
  return state.objects.filter(o => o.amount > 0 && Math.hypot(o.x - p.x, o.y - p.y) <= 105).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
}
function updateUI() {
  const p = self();
  if (!p) return;
  const timeInDay = state.time % 180;
  const seconds = Math.ceil((state.phase === 'day' ? 105 : state.phase === 'dusk' ? 145 : 180) - timeInDay);
  $('header-day').textContent = `第 ${state.day} 天`;
  $('clock-day').textContent = state.day;
  $('phase-name').textContent = { day: '白昼', dusk: '黄昏', night: '黑夜' }[state.phase];
  $('phase-countdown').textContent = `${seconds}s 后${state.phase === 'day' ? '黄昏' : state.phase === 'dusk' ? '入夜' : '天亮'}`;
  $('phase-icon').innerHTML = icon(state.phase === 'night' ? 'moon' : 'sun');
  $('player-name').textContent = p.name;
  $('room-count').textContent = `联机世界 · ${state.players.length}/8`;
  $('online-count').textContent = `${state.players.length} 在线`;
  $('coordinates').textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
  $('location-label').textContent = Math.hypot(p.x - 1200, p.y - 1200) < 350 ? '林间空地' : p.y < 950 ? '暗影密林' : p.x > 1600 ? '东部荒原' : '苔草森林';
  $('mobile-stats').textContent = `生命 ${Math.ceil(p.health)} · 饥饿 ${Math.ceil(p.hunger)}`;
  for (const key of ['health', 'hunger', 'sanity']) {
    $(`stat-${key}-value`).textContent = Math.ceil(p[key]);
    $(`stat-${key}-bar`).style.transform = `scaleX(${p[key] / 100})`;
    $(`stat-${key}`).setAttribute('aria-label', `${{ health: '生命', hunger: '饥饿', sanity: '理智' }[key]} ${Math.ceil(p[key])} / 100`);
  }
  const inv = JSON.stringify(p.inventory);
  if (inv !== inventorySignature) {
    inventorySignature = inv;
    itemKeys.forEach((key, i) => {
      const el = $(`item-${key}`), count = p.inventory[key];
      el.classList.toggle('filled', count > 0);
      el.disabled = count < 1;
      el.querySelector('.slot-count').textContent = count || '';
      el.setAttribute('aria-label', `${ITEMS[key].name}，${count} 个。${ITEMS[key].description}`);
      el.title = `${i + 1} · ${ITEMS[key].name}\n${ITEMS[key].description}`;
    });
    $('inventory-summary').textContent = `${Object.values(p.inventory).reduce((a, b) => a + b, 0)} 件物品 · 8 种材料与工具`;
  }
  const nearbyFire = state.fires.some(f => f.until > state.time && Math.hypot(f.x - p.x, f.y - p.y) < 170);
  const sig = `${inv}/${nearbyFire}/${category}`;
  if (sig !== recipesSignature) { recipesSignature = sig; renderRecipes(p, nearbyFire); }
  const ps = JSON.stringify(state.players.map(({ id, name, dead, color }) => ({ id, name, dead, color })));
  if (ps !== playersSignature) {
    playersSignature = ps;
    $('players').replaceChildren();
    state.players.forEach(player => {
      const row = document.createElement('div'); row.className = 'player-row';
      const avatar = document.createElement('span'); avatar.className = 'player-avatar'; avatar.textContent = player.name[0];
      const name = document.createElement('span'); name.textContent = player.name;
      const label = document.createElement('span'); label.className = 'self-label'; label.textContent = player.dead ? '已倒下' : player.id === playerId ? '你' : '同行中';
      row.append(avatar, name, label); $('players').append(row);
    });
  }
  const es = state.events.at(-1)?.id;
  if (es !== eventsSignature) {
    eventsSignature = es;
    const shouldScroll = $('messages').scrollHeight - $('messages').scrollTop - $('messages').clientHeight < 35;
    $('messages').replaceChildren();
    state.events.forEach(event => { const el = document.createElement('p'); el.textContent = event.text; el.className = event.kind; $('messages').append(el); });
    if (shouldScroll) $('messages').scrollTop = $('messages').scrollHeight;
  }
  const gathered = p.craftedFire ? 6 : Math.min(3, p.inventory.wood) + Math.min(3, p.inventory.grass);
  $('objective-count').textContent = p.craftedFire ? '完成' : `${gathered}/6`;
  $('objective-progress').style.transform = `scaleX(${gathered / 6})`;
  $('objective-text').textContent = p.craftedFire ? '火光已亮起，记得添柴与分享食物' : '采集木材与干草，制作第一堆营火';
  const n = nearest();
  $('interaction').classList.toggle('hidden', !n);
  if (n) $('interaction-name').textContent = objectNames[n.type];
  $('death-panel').classList.toggle('hidden', !p.dead);
  const lit = p.torchUntil > state.time || nearbyFire;
  $('torch-state').textContent = p.torchUntil > state.time ? `火把还剩 ${Math.ceil(p.torchUntil - state.time)} 秒` : '点击食物食用';
  if (state.phase === 'night' && !lit && !p.dead) {
    $('world-alert').textContent = '黑暗正在吞噬生命。立即点燃火把或靠近营火！';
    $('world-alert').classList.remove('hidden');
  } else if (playerId) $('world-alert').classList.add('hidden');
  drawClock($('clock'), state.time);
  drawMap($('minimap'), state, playerId);
  if ($('map-dialog').open) drawMap($('fullmap'), state, playerId, true);
  if (audioEnabled && lastAudioPhase !== state.phase) { lastAudioPhase = state.phase; playChime(); }
}
function renderRecipes(p, fire) {
  $('recipes').replaceChildren();
  for (const [key, recipe] of Object.entries(RECIPES)) {
    if (category !== 'all' && recipeDetails[key].category !== category) continue;
    const enough = Object.entries(recipe.costs).every(([item, count]) => p.inventory[item] >= count);
    const available = enough && (!recipe.needsFire || fire);
    const button = document.createElement('button');
    button.className = `recipe${available ? ' active' : ''}`;
    button.dataset.recipe = key;
    button.setAttribute('aria-label', `制作${recipe.name}，${Object.entries(recipe.costs).map(([item, count]) => `${count} ${ITEMS[item].name}`).join('，')}${recipe.needsFire ? '，需要营火' : ''}`);
    button.title = available ? `点击制作${recipe.name}` : recipe.needsFire && !fire ? '需要靠近燃烧的营火' : '材料不足，点击查看提示';
    button.innerHTML = `<span class="recipe-icon">${key === 'campfire' ? icon('campfire') : `<img src="${assetUrl(key === 'fuel' ? 'wood' : key)}" alt="" />`}</span><span class="recipe-copy"><span class="recipe-title">${recipe.name}${icon('arrow')}</span><span class="recipe-cost">${Object.entries(recipe.costs).map(([item, count]) => `<span class="${p.inventory[item] >= count ? 'enough' : 'short'}">${ITEMS[item].name} ${p.inventory[item]}/${count}</span>`).join('')}</span><span class="recipe-desc">${recipeDetails[key].description}</span></span>`;
    button.addEventListener('click', () => send({ type: 'craft', recipe: key }));
    $('recipes').append(button);
  }
}
$('stats').innerHTML = [['health', 'heart', '生命'], ['hunger', 'hunger', '饥饿'], ['sanity', 'sanity', '理智']].map(([key, symbol, name]) => `<div class="stat ${key}" id="stat-${key}" role="img" aria-label="${name} 100 / 100"><span class="stat-icon">${icon(symbol)}</span><div class="stat-info"><div class="stat-label"><span>${name}</span><span><strong id="stat-${key}-value">100</strong><small> / 100</small></span></div><div class="stat-track"><span id="stat-${key}-bar" style="width:100%"></span></div></div></div>`).join('');
itemKeys.forEach((key, index) => {
  const button = document.createElement('button');
  button.className = 'slot'; button.id = `item-${key}`; button.disabled = true;
  button.innerHTML = `<span class="slot-index">${index + 1}</span><img src="${assetUrl(key)}" alt="" /><span class="slot-count"></span><span class="slot-name">${ITEMS[key].name}</span>`;
  button.addEventListener('click', () => useItem(key));
  $('inventory').append(button);
});
function useItem(key) {
  if (['berry', 'cooked', 'torch'].includes(key)) send({ type: 'use', item: key });
  else toast(`${ITEMS[key].name}：${ITEMS[key].description}`);
}
function openDialog(dialog) {
  if (dialog.open) return;
  keys.clear(); updateInput();
  dialogPreviouslyFocused = document.activeElement;
  dialog.showModal();
}
function closeDialog(dialog) {
  if (!dialog.open) return;
  dialog.close();
  dialogPreviouslyFocused?.focus();
}
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => closeDialog($(el.dataset.close))));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(dialog); });
  dialog.addEventListener('close', () => dialogPreviouslyFocused?.focus());
});
$('room-button').addEventListener('click', () => openDialog($('room-dialog')));
for (const id of ['help-button', 'guide-link']) $(id).addEventListener('click', () => openDialog($('help-dialog')));
for (const id of ['map-button', 'expand-map', 'minimap-button']) $(id).addEventListener('click', () => { openDialog($('map-dialog')); drawMap($('fullmap'), state, playerId, true); });
function joinWorld(create = false) {
  if (!$('name-input').reportValidity() || !create && !$('code-input').reportValidity()) return;
  profile.name = $('name-input').value.trim() || '旅人';
  profile.code = $('code-input').value.trim().toUpperCase() || 'WILD01';
  keys.clear();
  updateInput();
  if (send({ type: 'join', ...profile, create, v: 2 })) pendingGather = null;
}
$('join-form').addEventListener('submit', event => { event.preventDefault(); joinWorld(); });
$('create-world').addEventListener('click', () => joinWorld(true));
async function copyInvite() {
  const url = new URL(location.href); url.searchParams.set('room', profile.code);
  try { await navigator.clipboard.writeText(url.href); toast(`世界 ${profile.code} 的邀请链接已复制`); }
  catch { openDialog($('room-dialog')); $('code-input').select(); toast(`世界代码：${profile.code}。复制地址栏链接即可邀请朋友。`); }
}
for (const id of ['copy-code', 'invite-button']) $(id).addEventListener('click', copyInvite);
$('chat-button').addEventListener('click', toggleChat);
$('close-chat').addEventListener('click', () => $('chat-panel').classList.add('hidden'));
function toggleChat() {
  $('chat-panel').classList.toggle('hidden');
  if (!$('chat-panel').classList.contains('hidden')) { keys.clear(); updateInput(); $('chat-input').focus(); $('messages').scrollTop = $('messages').scrollHeight; }
  else $('world').focus();
}
$('chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const text = $('chat-input').value.trim();
  if (text && send({ type: 'chat', text })) $('chat-input').value = '';
});
function updateInput() {
  const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  // Keyboard directions map to the screen axes of the isometric world.
  const vector = { x: (x + y) / Math.SQRT2, y: (y - x) / Math.SQRT2 };
  if (vector.x !== inputDirection.x || vector.y !== inputDirection.y) {
    inputDirection = vector;
    pendingGather = null;
    if (playerId) send({ type: 'input', ...vector });
  }
}
const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
window.addEventListener('keydown', event => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (movementKeys.includes(key)) { event.preventDefault(); keys.add(key); updateInput(); }
  if (event.repeat) return;
  if (key === 'e') { event.preventDefault(); gather(); }
  if (key === 'f') { event.preventDefault(); send({ type: 'attack' }); }
  if (key === 'enter') { event.preventDefault(); toggleChat(); }
  if (key === 'm') { event.preventDefault(); openDialog($('map-dialog')); drawMap($('fullmap'), state, playerId, true); }
  if (/^[1-8]$/.test(key)) useItem(itemKeys[Number(key) - 1]);
  if (key === 'escape') { $('chat-panel').classList.add('hidden'); document.querySelector('.craft-panel').classList.remove('mobile-open'); document.querySelector('.inventory-bar').classList.remove('mobile-open'); }
});
window.addEventListener('keyup', event => { keys.delete(event.key.toLowerCase()); updateInput(); });
window.addEventListener('blur', () => { keys.clear(); updateInput(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); updateInput(); } });
function gather() { const n = nearest(); send({ type: 'gather', ...(n ? { id: n.id } : {}) }); }
$('gather-button').addEventListener('click', gather);
$('touch-gather').addEventListener('click', gather);
$('touch-attack').addEventListener('click', () => send({ type: 'attack' }));
$('revive-button').addEventListener('click', () => send({ type: 'revive' }));
$('world').addEventListener('pointermove', event => {
  const rect = $('world').getBoundingClientRect();
  renderer.hover = renderer.hitTest(state, event.clientX - rect.left, event.clientY - rect.top)?.id || null;
  $('world').dataset.hover = renderer.hover || '';
  $('world').style.cursor = renderer.hover ? 'pointer' : 'crosshair';
});
$('world').addEventListener('pointerleave', () => { renderer.hover = null; $('world').dataset.hover = ''; });
$('world').addEventListener('pointerdown', event => {
  if (event.button !== 0 || !self() || self().dead) return;
  document.querySelector('.craft-panel').classList.remove('mobile-open');
  document.querySelector('.inventory-bar').classList.remove('mobile-open');
  $('world').focus();
  const rect = $('world').getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
  const target = renderer.hitTest(state, x, y);
  if (target) {
    if (Math.hypot(self().x - target.x, self().y - target.y) <= 105) send({ type: 'gather', id: target.id });
    else { pendingGather = target.id; send({ type: 'move', x: target.x, y: target.y }); }
  } else { pendingGather = null; send({ type: 'move', ...renderer.unproject(x, y) }); }
});
const touchDirections = { up: 'w', left: 'a', down: 's', right: 'd' };
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(touchDirections[button.dataset.direction]); updateInput(); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => { keys.delete(touchDirections[button.dataset.direction]); updateInput(); });
});
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.category;
  document.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b === button));
  if (self()) updateUI();
}));
$('mobile-craft').addEventListener('click', () => { document.querySelector('.craft-panel').classList.toggle('mobile-open'); document.querySelector('.inventory-bar').classList.remove('mobile-open'); });
$('mobile-bag').addEventListener('click', () => { document.querySelector('.inventory-bar').classList.toggle('mobile-open'); document.querySelector('.craft-panel').classList.remove('mobile-open'); });
function playChime() {
  if (!audioEnabled || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(310, audio.currentTime); oscillator.frequency.exponentialRampToValueAtTime(460, audio.currentTime + 0.12);
  gain.gain.setValueAtTime(0.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.36);
}
$('sound-button').addEventListener('click', async () => {
  try {
    audio ??= new window.AudioContext();
    await audio.resume();
    audioEnabled = !audioEnabled;
    $('sound-button').innerHTML = icon(audioEnabled ? 'sound' : 'muted');
    $('sound-button').setAttribute('aria-label', audioEnabled ? '关闭环境音效' : '开启环境音效');
    $('sound-button').title = audioEnabled ? '关闭环境音效' : '开启环境音效';
    toast(audioEnabled ? '已开启轻量环境提示音' : '音效已关闭'); playChime();
  } catch { toast('浏览器不支持音效，仍可正常游玩', true); }
});
function frame(time) {
  renderer.render(renderState(time), playerId, time / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('offline', () => {
  clearTimeout(reconnectTimer);
  connection('网络已离线', true);
  socket?.close();
});
window.addEventListener('online', () => {
  if (!socket || socket.readyState === WebSocket.CLOSED) connect();
  else if (socket.readyState === WebSocket.CLOSING) reconnectTimer = setTimeout(connect, 1000);
});
connect();
