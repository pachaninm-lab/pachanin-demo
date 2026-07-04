#!/usr/bin/env node
// Перегенерирует apps/web/tests/support/theme-token-baseline.json — снимок долга
// «стоячих» цветов (hex/rgb вне var(--token, …)) по theme-aware поверхностям.
// Запускать ТОЛЬКО после снижения долга (миграции цветов на токены), чтобы
// зафиксировать меньшие числа. Храповик (themeTokenRatchet.test.ts) не даёт
// долгу расти между запусками.
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const VAR_FALLBACK_HEX = /var\(\s*--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g;
const RGB_FUNC = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;

function countStandalone(src) {
  let c = 0;
  for (const raw of src.split('\n')) {
    if (raw.includes('theme-exempt')) continue;
    const l = raw.replace(VAR_FALLBACK_HEX, '');
    c += (l.match(HEX)?.length ?? 0) + (l.match(RGB_FUNC)?.length ?? 0);
  }
  return c;
}

const PUBLIC_EXCLUDE =
  /platform-v7\/(page|demo|login|open|register|contact|request|docs|help|pricing|roadmap|status|oferta|terms|privacy|about|security|indexnow|secure-grain-deal|grain-[a-z]+|fgis-zerno|investor)\/?.*page\.tsx$|platform-v7\/page\.tsx$/;

const globs = [
  'apps/web/components/platform-v7/**/*.tsx',
  'apps/web/components/v7r/**/*.tsx',
  'apps/web/app/platform-v7/**/page.tsx',
];
const files = [...new Set(globs.flatMap((g) => globSync(g)))].sort();
const baseline = {};
let total = 0;
for (const f of files) {
  if (PUBLIC_EXCLUDE.test(f)) continue;
  const n = countStandalone(readFileSync(f, 'utf8'));
  if (n > 0) { baseline[f] = n; total += n; }
}
writeFileSync('apps/web/tests/support/theme-token-baseline.json', JSON.stringify(baseline, null, 2) + '\n');
console.log(`baseline refreshed: ${Object.keys(baseline).length} files · ${total} standalone color literals`);
