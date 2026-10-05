import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

const port = 3137;
async function waitFor(check, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 30)); }
  throw new Error('Condition timed out');
}
async function client() {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const data = { messages: [], state: null, id: null };
  socket.on('message', raw => { const m = JSON.parse(raw); data.messages.push(m); if (m.type === 'state') data.state = m.state; if (m.type === 'joined') data.id = m.id; });
  await once(socket, 'open');
  return { socket, data, send: m => socket.send(JSON.stringify(m)) };
}
test('production transport rejects malformed payloads, isolates rooms, caps players and preserves old room on failure', async () => {
  const server = spawn(process.execPath, ['server/index.js', '--production'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const clients = [];
  try {
    await once(server.stdout, 'data');
    const first = await client(); clients.push(first);
    first.socket.send('{');
    await waitFor(() => first.data.messages.some(m => m.type === 'error'));
    first.send({ type: 'join', code: 'FULL01', name: '先行者' }); await waitFor(() => first.data.state?.players.length === 1);
    first.send({ type: 'craft', recipe: '__proto__' });
    await waitFor(() => first.data.messages.some(m => m.message === '未知配方'));
    for (let i = 0; i < 7; i++) { const c = await client(); clients.push(c); c.send({ type: 'join', code: 'FULL01', name: `旅人${i}` }); await waitFor(() => c.data.id); }
    await waitFor(() => first.data.state.players.length === 8);
    const ninth = await client(); clients.push(ninth); ninth.send({ type: 'join', code: 'OTHER1', name: '第九人' }); await waitFor(() => ninth.data.state?.code === 'OTHER1');
    const id = ninth.data.id;
    ninth.send({ type: 'join', code: 'FULL01' });
    await waitFor(() => ninth.data.messages.some(m => m.message?.includes('已有 8 位')));
    ninth.send({ type: 'chat', text: '原世界仍可用' });
    await waitFor(() => ninth.data.state.events.some(e => e.text.includes('原世界仍可用')));
    assert.equal(ninth.data.id, id); assert.equal(ninth.data.state.code, 'OTHER1');
    assert.equal(first.data.state.events.some(e => e.text.includes('原世界仍可用')), false);
    ninth.send({ type: 'input', x: 'invalid', y: 0 }); await waitFor(() => ninth.data.messages.some(m => m.message === '无效方向'));
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    clients[1].socket.close(); await waitFor(() => first.data.state.players.length === 7);
    const overlarge = await client(); clients.push(overlarge); overlarge.socket.on('error', () => {});
    const closed = once(overlarge.socket, 'close'); overlarge.socket.send('x'.repeat(5000)); await closed;
    assert.equal(overlarge.socket.readyState, WebSocket.CLOSED);
  } finally {
    for (const c of clients) c.socket.terminate();
    server.kill();
    await once(server, 'exit');
  }
});
