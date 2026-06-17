import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [path.join(ROOT, 'app'), path.join(ROOT, 'src')];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

function transform(content) {
  let c = content;

  if (!c.includes('ActivityIndicator') && !c.includes('#2d6a4f') && !c.includes('#f8faf8') && !c.includes('border-red-200') && !c.includes('border-forest')) {
    return null;
  }

  const hadActivityIndicator = c.includes('ActivityIndicator');

  c = c.replace(/<ActivityIndicator[^/]*\/>/g, (match) => {
    if (match.includes('size="small"') || match.includes("size='small'")) {
      return '<LoadingIndicator size="small" />';
    }
    return '<LoadingIndicator />';
  });

  c = c.replace(/import\s*\{([^}]*)\}\s*from\s*['"]react-native['"];/g, (full, imports) => {
    const parts = imports
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'ActivityIndicator');
    if (parts.length === 0) return full;
    return `import { ${parts.join(', ')} } from 'react-native';`;
  });

  if (hadActivityIndicator && !c.includes("from '@/src/components/ui/loading-indicator'")) {
    const firstImport = c.match(/^import .+$/m);
    if (firstImport) {
      const idx = c.indexOf(firstImport[0]) + firstImport[0].length;
      c = `${c.slice(0, idx)}\nimport { LoadingIndicator } from '@/src/components/ui/loading-indicator';${c.slice(idx)}`;
    }
  }

  c = c.replace(/#2d6a4f/g, '#228B22');
  c = c.replace(/#52796f/g, '#228B22');
  c = c.replace(/#1b4332/g, '#228B22');
  c = c.replace(/#40916c/g, '#50C878');
  c = c.replace(/#f8faf8/g, '#FFFFFF');

  c = c.replace(/border-red-200 bg-red-50/g, 'bg-red-50');
  c = c.replace(/border-forest-300 bg-forest-100/g, 'bg-honeydew');
  c = c.replace(/border-forest-200 bg-forest-50/g, 'bg-honeydew');
  c = c.replace(/border-amber-200 bg-amber-50/g, 'bg-honeydew');
  c = c.replace(/border-2 border-forest/g, 'border-2 border-primary');
  c = c.replace(/border-t border-forest-200/g, 'border-t border-honeydew');
  c = c.replace(/border-t border-line/g, 'border-t border-honeydew');
  c = c.replace(/border border-line bg-white/g, 'bg-honeydew');
  c = c.replace(/border border-line bg-canvas/g, 'bg-honeydew');
  c = c.replace(/rounded-xl border border-line/g, 'rounded-input bg-honeydew');
  c = c.replace(/trackColor=\{\{\s*true:\s*'#228B22',\s*false:\s*'#d8e2dc'\s*\}\}/g, "trackColor={{ true: '#228B22', false: '#E5E7EB' }}");

  c = c.replace(
    /headerStyle:\s*\{\s*backgroundColor:\s*'#FFFFFF'\s*\},\s*headerTintColor:\s*'#228B22',\s*headerShadowVisible:\s*false,/g,
    '...rootedStackScreenOptions,',
  );

  if (c.includes('rootedStackScreenOptions') && !c.includes("from '@/src/components/navigation/rooted-stack-options'")) {
    const firstImport = c.match(/^import .+$/m);
    if (firstImport) {
      const idx = c.indexOf(firstImport[0]) + firstImport[0].length;
      c = `${c.slice(0, idx)}\nimport { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';${c.slice(idx)}`;
    }
  }

  c = c.replace(/rounded-xl border border-line bg-white/g, 'rounded-input bg-honeydew');
  c = c.replace(/border-sage-200 bg-sage-50/g, 'bg-honeydew');
  c = c.replace(/border-stone-100/g, 'border-honeydew');

  return c === content ? null : c;
}

let changed = 0;
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    const original = fs.readFileSync(file, 'utf8');
    const next = transform(original);
    if (next) {
      fs.writeFileSync(file, next);
      changed++;
      console.log('updated:', path.relative(ROOT, file));
    }
  }
}

console.log(`Done. ${changed} files updated.`);
