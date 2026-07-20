#!/usr/bin/env node
/**
 * Anti-pattern ratchet — Phase 0 of the design-system consolidation.
 *
 * The platform's CSS accreted five design generations glued together with
 * `!important`, hard-coded colours and arbitrary z-index values (see
 * AUDIT_design-visual_2026-07-19.md). We cannot fix all of that at once, but
 * we can *freeze the pit*: this guard counts the anti-patterns and fails only
 * when a change makes any count go up. The numbers can go down freely and the
 * baseline is re-pinned with `--update`; they may never silently climb.
 *
 *   node scripts/check-antipattern-ratchet.mjs           # check against baseline
 *   node scripts/check-antipattern-ratchet.mjs --update  # re-pin baseline (only after a real reduction)
 *
 * Dependency-free. Presentation-layer only — it never blocks on logic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(repoRoot, 'design-antipattern-baseline.json');

const ROOTS = ['apps/web/app', 'apps/web/components', 'apps/web/styles', 'packages'];
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage', '.git']);

/** Recursively collect files with the given extensions under a root. */
function collect(root, exts, out = []) {
  const abs = path.join(repoRoot, root);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      collect(path.join(root, entry.name), exts, out);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(path.join(root, entry.name));
    }
  }
  return out;
}

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const countMatches = (text, re) => (text.match(re) || []).length;

const cssFiles = [...new Set(ROOTS.flatMap((r) => collect(r, ['.css'])))];
const tsxFiles = [...new Set(ROOTS.flatMap((r) => collect(r, ['.tsx'])))];

const metrics = {
  // `!important` across all stylesheets and inline <style> in components.
  importantRules: 0,
  // Hard-coded hex colours living inside TSX instead of tokens.
  hexInTsx: 0,
  // Raw numeric z-index values (the named --ds-z-* scale is exempt).
  rawZIndex: 0,
};

const IMPORTANT = /!important/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
// numeric z-index, but not `z-index: var(--...)`
const ZINDEX = /z-index\s*:\s*-?\d+/g;

for (const f of cssFiles) {
  const t = read(f);
  metrics.importantRules += countMatches(t, IMPORTANT);
  metrics.rawZIndex += countMatches(t, ZINDEX);
}
for (const f of tsxFiles) {
  const t = read(f);
  metrics.importantRules += countMatches(t, IMPORTANT);
  metrics.hexInTsx += countMatches(t, HEX);
  metrics.rawZIndex += countMatches(t, ZINDEX);
}

const update = process.argv.includes('--update');

if (update || !fs.existsSync(baselinePath)) {
  fs.writeFileSync(
    baselinePath,
    JSON.stringify(
      { note: 'Ratchet baseline. Counts may only DECREASE. Re-pin with --update after a reduction.', metrics },
      null,
      2,
    ) + '\n',
  );
  console.log(`${update ? 're-pinned' : 'created'} baseline:`, metrics);
  process.exit(0);
}

const baseline = JSON.parse(read('design-antipattern-baseline.json')).metrics;
const rows = Object.keys(metrics);
const regressions = [];
const improvements = [];
for (const k of rows) {
  const now = metrics[k];
  const base = baseline[k] ?? 0;
  if (now > base) regressions.push(`  ✗ ${k}: ${base} → ${now}  (+${now - base})`);
  else if (now < base) improvements.push(`  ✓ ${k}: ${base} → ${now}  (−${base - now})`);
}

console.log('Anti-pattern ratchet');
for (const k of rows) console.log(`  ${k}: ${metrics[k]} (baseline ${baseline[k] ?? 0})`);

if (improvements.length) {
  console.log('\nImprovements since baseline (run with --update to re-pin):');
  improvements.forEach((l) => console.log(l));
}

if (regressions.length) {
  console.error('\nRegression — these anti-pattern counts increased:');
  regressions.forEach((l) => console.error(l));
  console.error('\nUse a design token (var(--ds-*)) instead of a hard-coded colour, drop the');
  console.error('!important, or use the named z-index scale. The platform only gets cleaner.');
  process.exit(1);
}

console.log('\nOK — no new anti-patterns.');
