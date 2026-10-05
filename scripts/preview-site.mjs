import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [path.join(root, 'wildwood-together/server/index.js'), '--production'], {
  cwd: root,
  env: { ...process.env, PORT: process.env.PORT || '4173', SITE_ROOT: path.join(root, 'dist'), GAME_BASE_PATH: '/wildwood-together/' },
  stdio: 'inherit',
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
