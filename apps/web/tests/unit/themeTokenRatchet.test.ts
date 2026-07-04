import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'glob';
import { countStandaloneColors } from '../support/standalone-hex-scan';
import baseline from '../support/theme-token-baseline.json';

// Дизайн-долг тёмной темы под храповиком: считаем «стоячие» цветовые литералы
// (hex/rgb вне var(--token, …)) в theme-aware поверхностях. Число может только
// СНИЖАТЬСЯ. Любой новый стоячий цвет валит тест — так мы не даём долгу расти,
// пока сжигаем его по кабинетам. Понизил долг → перегенерируй baseline
// (scripts/refresh-theme-baseline.mjs) и закоммить меньшие числа.

const ROOT = resolve(__dirname, '../../../..');
const WEB = resolve(ROOT, 'apps/web');

const PUBLIC_EXCLUDE =
  /platform-v7\/(page|demo|login|open|register|contact|request|docs|help|pricing|roadmap|status|oferta|terms|privacy|about|security|indexnow|secure-grain-deal|grain-[a-z]+|fgis-zerno|investor)\/?.*page\.tsx$|platform-v7\/page\.tsx$/;

const GLOBS = [
  'apps/web/components/platform-v7/**/*.tsx',
  'apps/web/components/v7r/**/*.tsx',
  'apps/web/app/platform-v7/**/page.tsx',
];

function scan(): Record<string, number> {
  const files = [...new Set(GLOBS.flatMap((g) => globSync(g, { cwd: ROOT })))].sort();
  const out: Record<string, number> = {};
  for (const f of files) {
    if (PUBLIC_EXCLUDE.test(f)) continue;
    const n = countStandaloneColors(readFileSync(resolve(ROOT, f), 'utf8'));
    if (n > 0) out[f] = n;
  }
  return out;
}

const base = baseline as Record<string, number>;

describe('theme-token debt ratchet (dark-mode readiness)', () => {
  const current = scan();

  it('no themed surface exceeds its recorded standalone-color baseline', () => {
    const regressions: string[] = [];
    for (const [file, count] of Object.entries(current)) {
      const allowed = base[file] ?? 0;
      if (count > allowed) regressions.push(`${file}: ${count} > baseline ${allowed}`);
    }
    expect(regressions, `Стоячие цвета выросли — используйте токены --pc-*:\n${regressions.join('\n')}`).toEqual([]);
  });

  it('global standalone-color debt does not grow beyond baseline total', () => {
    const currentTotal = Object.values(current).reduce((s, n) => s + n, 0);
    const baseTotal = Object.values(base).reduce((s, n) => s + n, 0);
    expect(currentTotal, `Суммарный долг стоячих цветов вырос: ${currentTotal} > ${baseTotal}`).toBeLessThanOrEqual(baseTotal);
  });

  it('baseline stays honest — files fixed to zero are removed from it', () => {
    const stale = Object.keys(base).filter((f) => (current[f] ?? 0) === 0);
    expect(stale, `Файлы больше не содержат стоячих цветов — уберите из baseline:\n${stale.join('\n')}`).toEqual([]);
  });
});
