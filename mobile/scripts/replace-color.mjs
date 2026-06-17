import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = '#84a98c';
const TO = '#9CAF88';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

let count = 0;
for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]) {
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(FROM)) continue;
  fs.writeFileSync(file, original.split(FROM).join(TO));
  count++;
  console.log(path.relative(ROOT, file));
}
console.log(`Replaced in ${count} files.`);
