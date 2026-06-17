import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_LINE =
  "import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(path.join(ROOT, 'app'))) {
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes('rootedStackScreenOptions')) continue;
  if (original.includes("from '@/src/components/navigation/rooted-stack-options'")) continue;

  const firstImport = original.match(/^import .+$/m);
  if (!firstImport) continue;

  const idx = original.indexOf(firstImport[0]) + firstImport[0].length;
  const next = `${original.slice(0, idx)}\n${IMPORT_LINE}${original.slice(idx)}`;
  fs.writeFileSync(file, next);
  changed++;
  console.log('import added:', path.relative(ROOT, file));
}

console.log(`Done. ${changed} files updated.`);
