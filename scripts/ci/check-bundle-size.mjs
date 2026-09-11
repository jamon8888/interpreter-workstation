#!/usr/bin/env node

/**
 * CI gate: checks renderer bundle gzip sizes against thresholds.
 *
 * Usage: node scripts/ci/check-bundle-size.mjs [--build]
 *
 * Without --build, checks existing dist/ output.
 * With --build, runs `pnpm run build:renderer` first.
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST_ASSETS = join(ROOT, 'dist', 'assets');

const THRESHOLDS = {
  // Main entry chunk (index-*.js) — must be ≤ 600 KB gzip
  main: 600 * 1024,
  // Any single lazy chunk — must be ≤ 1200 KB gzip
  lazy: 1200 * 1024,
};

const args = process.argv.slice(2);
if (args.includes('--build')) {
  console.log('Building renderer...');
  execSync('pnpm run build:renderer', { cwd: ROOT, stdio: 'inherit' });
}

function getGzipSize(filePath) {
  const raw = statSync(filePath).size;
  const compressed = gzipSync(readFileSync(filePath)).length;
  return { raw, compressed };
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let failed = false;
const results = [];

for (const file of readdirSync(DIST_ASSETS)) {
  if (!file.endsWith('.js')) continue;
  const filePath = join(DIST_ASSETS, file);
  const { raw, compressed } = getGzipSize(filePath);
  const isMain = file.startsWith('index-') && !file.includes('index.es-');
  const threshold = isMain ? THRESHOLDS.main : THRESHOLDS.lazy;
  const status = compressed <= threshold ? 'PASS' : 'FAIL';

  if (status === 'FAIL') failed = true;

  results.push({
    file,
    raw: formatKB(raw),
    gzip: formatKB(compressed),
    threshold: formatKB(threshold),
    status,
    isMain,
  });
}

// Sort: main first, then by gzip size descending
results.sort((a, b) => {
  if (a.isMain && !b.isMain) return -1;
  if (!a.isMain && b.isMain) return 1;
  return 0;
});

console.log('\nBundle Size Report');
console.log('='.repeat(80));
console.log(
  'File'.padEnd(50) +
  'Raw'.padStart(10) +
  'Gzip'.padStart(10) +
  'Limit'.padStart(10) +
  'Status'.padStart(8)
);
console.log('-'.repeat(88));

for (const r of results) {
  const name = r.isMain ? `${r.file} (main)` : r.file;
  console.log(
    name.padEnd(50) +
    r.raw.padStart(10) +
    r.gzip.padStart(10) +
    r.threshold.padStart(10) +
    r.status.padStart(8)
  );
}

const totalGzip = results.reduce((sum, r) => sum + gzipSync(readFileSync(join(DIST_ASSETS, r.file))).length, 0);
console.log('-'.repeat(88));
console.log(`Total gzip: ${formatKB(totalGzip)}`);
console.log(`Chunks: ${results.length}`);

if (failed) {
  console.error('\n❌ Bundle size check FAILED — one or more chunks exceed thresholds');
  process.exit(1);
} else {
  console.log('\n✅ Bundle size check passed');
}
