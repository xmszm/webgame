import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { World } from './world.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const basePath = process.env.GAME_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) throw new Error('GAME_BASE_PATH must start and end with /');
const staticRoot = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.join(root, 'dist');
const rooms = new Map();
const vite = production ? null : await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === `${basePath}health`) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    return;
  }
  if (vite) { vite.middlewares(req, res, () => { res.writeHead(404); res.end('Not found'); }); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(staticRoot, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(staticRoot + path.sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const wss = new WebSocketServer({ server, path: `${basePath}ws`, maxPayload: 4096 });
function send(socket, data) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data)); }
function code() { return randomBytes(3).toString('hex').toUpperCase(); }
function join(socket, message) {
  const requested = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
  if (!message.create && requested && !/^[A-Z0-9]{4,12}$/.test(requested)) return send(socket, { type: 'error', message: '房间码须为 4–12 位字母或数字' });
  const roomCode = message.create ? code() : requested || 'WILD01';
  let room = rooms.get(roomCode);
  if (!room) {
    if (rooms.size >= 100) return send(socket, { type: 'error', message: '服务器世界数量已满，请进入现有世界或稍后重试' });
    room = new World(roomCode, [...roomCode].reduce((sum, ch) => sum + ch.charCodeAt(0), 0));
    rooms.set(roomCode, room);
  }
  if (room.players.size >= 8 && socket.room !== room) return send(socket, { type: 'error', message: '该世界已有 8 位玩家，请创建新世界' });
  if (socket.room) socket.room.removePlayer(socket.playerId);
  socket.room = room;
  socket.playerId = randomUUID();
  const name = typeof message.name === 'string' ? message.name.replace(/[\x00-\x1f]/g, '').trim().slice(0, 12) : '';
  const player = room.addPlayer(socket.playerId, name || '旅人');
  // Clients that announce the delta protocol get the resource map once here and
  // only revisions afterwards; older clients keep receiving it in every state.
  socket.deltaProtocol = message.v >= 2;
  socket.sentRevisions = new Map();
  const joined = { type: 'joined', id: socket.playerId, code: roomCode, name: player.name };
  if (socket.deltaProtocol) {
    room.seedRevisions(socket.sentRevisions);
    joined.objects = room.serializeObjects();
  }
  send(socket, joined);
  send(socket, { type: 'state', state: roomState(socket) });
}
function roomState(socket) {
  const state = socket.room.snapshot();
  state.objects = socket.deltaProtocol ? socket.room.deltaObjects(socket.sentRevisions) : socket.room.serializeObjects();
  return state;
}
wss.on('connection', socket => {
  socket.alive = true;
  socket.rateStart = Date.now();
  socket.rateCount = 0;
  socket.lastChat = 0;
  socket.on('pong', () => { socket.alive = true; });
  socket.on('message', raw => {
    if (Date.now() - socket.rateStart > 1000) { socket.rateStart = Date.now(); socket.rateCount = 0; }
    if (++socket.rateCount > 40) return;
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return send(socket, { type: 'error', message: '无法识别消息' }); }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    if (message.type === 'join') { join(socket, message); return; }
    if (!socket.room) return send(socket, { type: 'error', message: '请先加入世界' });
    if (message.type === 'chat') {
      if (Date.now() - socket.lastChat < 800) return send(socket, { type: 'error', message: '请稍候再发送消息' });
      socket.lastChat = Date.now();
    }
    const result = socket.room.command(socket.playerId, message);
    if (message.type !== 'input' && message.type !== 'move' || !result.ok) send(socket, { type: 'result', ...result });
  });
  socket.on('close', () => { socket.room?.removePlayer(socket.playerId); socket.room = null; });
  socket.on('error', () => {});
});
let lastTick = performance.now();
const tick = setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  for (const room of rooms.values()) if (room.players.size) room.tick(dt);
  for (const socket of wss.clients) {
    if (socket.room && socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 128_000) send(socket, { type: 'state', state: roomState(socket) });
  }
}, 50);
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.alive) { socket.terminate(); continue; }
    socket.alive = false;
    socket.ping();
  }
  for (const [key, room] of rooms) if (!room.players.size && Date.now() - room.lastActive > 30 * 60 * 1000) rooms.delete(key);
}, 30_000);
server.listen(port, host, () => console.log(`荒野同行 · ${production ? 'production' : 'development'} http://${host}:${server.address().port}`));
function shutdown() {
  clearInterval(tick);
  clearInterval(heartbeat);
  for (const socket of wss.clients) socket.close(1001, 'Server shutting down');
  wss.close();
  vite?.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
