import { access, copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

async function requirePath(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    await access(absolutePath);
  } catch {
    throw new Error(`Required build input is missing: ${relativePath}`);
  }
  return absolutePath;
}

async function copyBuiltApp(sourceDirectory, outputDirectory) {
  const source = await requirePath(sourceDirectory);
  await cp(source, path.join(output, outputDirectory), { recursive: true });
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(await requirePath('index.html'), path.join(output, 'index.html'));
await writeFile(path.join(output, '.nojekyll'), '', 'utf8');

await copyBuiltApp(path.join('5.6-sol我的世界', 'dist'), '5.6-sol我的世界');
await copyBuiltApp(path.join('fruit-ninja', 'dist'), 'fruit-ninja');
await copyBuiltApp(path.join('starbound-brothers', 'dist'), 'starbound-brothers');

const staticOutput = path.join(output, 'gpt-5.5我的世界');
await mkdir(staticOutput, { recursive: true });
await copyFile(await requirePath(path.join('gpt-5.5我的世界', 'index.html')), path.join(staticOutput, 'index.html'));
await cp(await requirePath(path.join('gpt-5.5我的世界', 'src')), path.join(staticOutput, 'src'), { recursive: true });

console.log(`Assembled deployable site at ${path.relative(root, output)}`);
