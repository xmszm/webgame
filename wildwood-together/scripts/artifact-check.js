import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

await mkdir('evidence', { recursive: true });
const html = await readFile('dist/index.html', 'utf8');
assert.match(html, /lang="zh-CN"/);
assert.match(html, /\.\/assets\/index-/);
const font = await readFile('dist/fonts/zcool-xiaowei.woff2');
assert.equal(font.subarray(0, 4).toString(), 'wOF2');
assert.match(await readFile('dist/fonts/OFL.txt', 'utf8'), /SIL OPEN FONT LICENSE/);
const assets = await readdir('dist/assets');
for (const filename of assets) {
  const content = await readFile(path.join('dist/assets', filename), 'utf8');
  assert.equal(/TODO|FIXME|Direction contract|FIRST VIEWPORT|0923de17/.test(content), false, `Development-only metadata leaked in ${filename}`);
}
const results = JSON.parse(await readFile('evidence/e2e-results.json', 'utf8'));
assert.equal(results.stats.unexpected, 0);
assert.equal(results.stats.expected, 5);
const multiplayer = JSON.parse(await readFile('evidence/multiplayer.json', 'utf8'));
for (const key of ['movementSeenByPeer', 'chatSeenByPeer', 'actualNightCycle', 'sharedFireProtectedTwoPlayers', 'disconnectSeenByPeer']) assert.equal(multiplayer[key], true);
assert.deepEqual(multiplayer.browserErrors, []);
for (const file of ['desktop.png', 'mobile.png', 'night.png']) {
  const image = await readFile(path.join('evidence', file));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.ok(image.length > 20000);
}
const spriteFiles = (await readdir('public/art')).filter(file => file.endsWith('.png') && !file.includes('atlas'));
for (const file of spriteFiles) {
  const image = await readFile(`dist/art/${file}`);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.ok(image.length > 1000);
}
assert.ok(spriteFiles.length >= 17);
const performanceResult = JSON.parse(await readFile('evidence/redesign/performance.json', 'utf8'));
assert.ok(performanceResult.medianMs < 45);
assert.ok((await readdir('evidence/redesign/videos')).some(file => file.endsWith('.webm')));
const sources = ['index.html', 'package.json', '../package-lock.json', 'vite.config.js', 'INTEGRATION.md', 'eslint.config.js', 'playwright.config.js', 'README.md', 'PRODUCT.md', 'PLAN.md', 'DESIGN.md', ...await readdir('server').then(files => files.map(f => `server/${f}`)), ...await readdir('src').then(files => files.map(f => `src/${f}`)), ...await readdir('tests').then(files => files.map(f => `tests/${f}`)), 'scripts/artifact-check.js', 'scripts/extract-art.py', ...await readdir('public/art').then(files => files.map(file => `public/art/${file}`)), 'public/fonts/fonts.css', 'public/fonts/OFL.txt', 'public/fonts/zcool-xiaowei.woff2'];
const manifest = [];
let diff = '';
for (const filename of sources) {
  const bytes = await readFile(filename);
  manifest.push({ path: filename, size: (await stat(filename)).size, sha256: createHash('sha256').update(bytes).digest('hex') });
  if (!filename.endsWith('.woff2') && !filename.endsWith('.png') && !filename.endsWith('package-lock.json')) {
    const lines = bytes.toString('utf8').trimEnd().split('\n');
    diff += `diff --git a/${filename} b/${filename}\nnew file mode 100644\n--- /dev/null\n+++ b/${filename}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}`).join('\n')}\n`;
  }
}
await writeFile('evidence/source-manifest.json', JSON.stringify({ generatedAt: new Date().toISOString(), baseline: 'Imported game workspace; parent repository package-lock.json included for dependency provenance.', files: manifest }, null, 2));
await writeFile('evidence/new-files.diff', diff);
console.log(`Artifact audit passed: 5 browser cases, 3 screenshots, 17+ integrated sprites, animation video, render timing, licensed WOFF2, built assets, ${manifest.length} source hashes, imported workspace manifest.`);
