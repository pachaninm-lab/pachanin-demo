#!/usr/bin/env node
/**
 * Style freeze gate (Phase 0 of the platform completion plan).
 *
 * The web app accumulated 66 CSS files and ~500 unique colors across five
 * competing token systems. Until the cabinets are rebuilt on --ds-* tokens,
 * the debt must not grow: this gate fails CI when the number of CSS files
 * or unique color literals in apps/web exceeds the frozen baseline.
 * Shrinking is always allowed — update the baseline downward as cleanup lands.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = {
  cssFiles: 66,
  uniqueColors: 496,
};

const ROOTS = ['apps/web/app', 'apps/web/components', 'apps/web/styles'];

function cssFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) out.push(...cssFiles(path));
    else if (entry.endsWith('.css')) out.push(path);
  }
  return out;
}

const files = ROOTS.flatMap((root) => cssFiles(root));
const colorPattern = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
const colors = new Set();
for (const file of files) {
  for (const match of readFileSync(file, 'utf8').matchAll(colorPattern)) {
    colors.add(match[0].toLowerCase());
  }
}

const current = { cssFiles: files.length, uniqueColors: colors.size };
const failures = [];
if (current.cssFiles > BASELINE.cssFiles) {
  failures.push(`CSS files: ${current.cssFiles} > baseline ${BASELINE.cssFiles}. Не добавляйте новые CSS-файлы — расширяйте существующие поверхности на --ds-* токенах.`);
}
if (current.uniqueColors > BASELINE.uniqueColors) {
  failures.push(`Unique color literals: ${current.uniqueColors} > baseline ${BASELINE.uniqueColors}. Новые цвета — только через packages/design-tokens (--ds-*).`);
}

console.log(`[style-freeze] css files: ${current.cssFiles}/${BASELINE.cssFiles} · unique colors: ${current.uniqueColors}/${BASELINE.uniqueColors}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`[style-freeze] FAIL: ${failure}`);
  process.exit(1);
}

if (current.cssFiles < BASELINE.cssFiles || current.uniqueColors < BASELINE.uniqueColors) {
  console.log('[style-freeze] Долг сократился — обновите BASELINE вниз в scripts/check-style-freeze.mjs, чтобы зафиксировать прогресс.');
}
console.log('[style-freeze] OK');
