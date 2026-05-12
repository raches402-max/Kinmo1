import { readFile, writeFile } from 'node:fs/promises';

const indexPath = new URL('../dist/public/index.html', import.meta.url);
const original = await readFile(indexPath, 'utf8');
const updated = original
  .replace(/ crossorigin/g, '')
  .replace(/ type="module"/g, '')
  .replace(/<script /g, '<script defer ');

if (updated !== original) {
  await writeFile(indexPath, updated, 'utf8');
}
