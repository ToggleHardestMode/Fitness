import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = file => readFileSync(file, 'utf8');
const matches = (value, expression) => [...value.matchAll(expression)].map(match => match[1]);

/** Read-only pre-release check for source assets, not HTTP delivery or device behavior. */
export function verifyPreviewAssets(root) {
  const directory = resolve(root, 'preview-v101');
  const html = source(join(directory, 'index.html'));
  const manifest = JSON.parse(source(join(directory, 'manifest.webmanifest')));
  const worker = source(join(directory, 'sw.js'));
  const errors = [];
  const banner = html.match(/FITNESSPILOT (V\d+\.\d+(?:\.\d+)*) PREVIEW/);
  if (!banner) errors.push('Preview HTML banner lacks a version.');
  else if (!manifest.name?.includes(banner[1])) errors.push('Manifest version differs from the HTML banner.');
  if (!worker.includes("fitnesspilot-preview-v")) errors.push('Service worker is not using a preview-scoped cache.');
  if (banner && !worker.includes(`fitnesspilot-preview-${banner[1].toLowerCase().replaceAll('.', '')}`)) {
    errors.push('Service worker cache version differs from the HTML banner.');
  }
  if (!source(join(directory, 'core.js')).includes('fitnesspilot.preview.v101.v1')) {
    errors.push('Preview storage key changed or is missing.');
  }
  const required = new Set([
    'index.html', 'app.js', 'manifest.webmanifest',
    ...matches(html, /(?:href|src)="\.\/([^"?#]+\.(?:css|js|svg))"/g),
  ]);
  const precache = new Set(matches(worker, /'\.\/([^']+)'/g));
  for (const file of required) {
    if (!precache.has(file)) errors.push(`HTML asset not precached: ${file}`);
  }
  for (const file of precache) {
    if (file === '') continue;
    if (file.startsWith('/') || file.split('/').includes('..')) {
      errors.push(`Unsafe precache path: ${file}`);
    } else if (!existsSync(join(directory, file))) {
      errors.push(`Missing precache asset: ${file}`);
    }
  }
  const visited = new Set();
  function checkModule(filename) {
    const absolute = resolve(directory, filename);
    if (!absolute.startsWith(directory + sep) || visited.has(absolute)) return;
    visited.add(absolute);
    if (!existsSync(absolute)) {
      errors.push(`Missing JavaScript module: ${filename}`);
      return;
    }
    for (const relative of matches(source(absolute), /\bfrom\s+['"](\.[^'"]+)['"]/g)) {
      const imported = resolve(dirname(absolute), relative);
      if (!imported.startsWith(directory + sep)) {
        errors.push(`Module import escapes preview directory: ${relative}`);
      } else {
        checkModule(imported.slice(directory.length + 1));
      }
    }
  }
  checkModule('app.js');
  for (const absolute of visited) {
    const relative = absolute.slice(directory.length + 1);
    if (!precache.has(relative)) errors.push(`App module not precached: ${relative}`);
  }
  return {ok: errors.length === 0, errors, version: banner?.[1] ?? null,
    precached: precache.size, checkedModules: visited.size};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const report = verifyPreviewAssets(root);
    console.log(`${report.version ?? 'Unknown preview'}: ${report.precached} cached assets, ${report.checkedModules} modules inspected`);
    for (const error of report.errors) console.error(`FAIL: ${error}`);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
