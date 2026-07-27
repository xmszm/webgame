import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const requiredFiles = [
  'index.html',
  '.nojekyll',
  '5.6-sol我的世界/index.html',
  'fruit-ninja/index.html',
  'fruit-ninja/assets/apple.svg',
  'fruit-ninja/assets/dojo.svg',
  'gpt-5.5我的世界/index.html',
  'gpt-5.5我的世界/src/main.js',
  'gpt-5.5我的世界/src/styles.css',
  'gpt-5.5我的世界/src/game/renderer.js',
];

for (const relativePath of requiredFiles) {
  try {
    await access(path.join(output, relativePath));
  } catch {
    throw new Error(`Deploy artifact is incomplete: ${relativePath}`);
  }
}

const rootHtml = await readFile(path.join(output, 'index.html'), 'utf8');
for (const gamePath of ['5.6-sol我的世界/', 'fruit-ninja/', 'gpt-5.5我的世界/']) {
  if (!rootHtml.includes(`./${gamePath}`)) throw new Error(`Root index does not link to ${gamePath}`);
}

for (const appPath of ['5.6-sol我的世界', 'fruit-ninja']) {
  const appHtml = await readFile(path.join(output, appPath, 'index.html'), 'utf8');
  if (appHtml.includes('/src/') || appHtml.includes('src="/')) {
    throw new Error(`${appPath} still contains an unbuilt absolute source reference`);
  }
  const assets = await readdir(path.join(output, appPath, 'assets'));
  if (!assets.some((filename) => filename.endsWith('.js'))) {
    throw new Error(`${appPath} has no compiled JavaScript asset`);
  }
}

console.log(`Verified ${requiredFiles.length} required files and all game entry points`);
