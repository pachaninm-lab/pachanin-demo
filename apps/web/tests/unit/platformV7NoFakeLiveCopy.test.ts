import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Постоянный guard под жёсткий запрет ТЗ: «no fake-live claims».
// Сканирует исходники platform-v7 на абсолютные claim'ы о боевом подключении,
// которые не должны появляться даже после доработок. Фразы подобраны так, чтобы
// не ловить отрицательные формулировки honesty-копий («это не выпуск денег»).

const ROOTS = [
  '../../components/platform-v7',
  '../../app/platform-v7',
  '../../components/v7r',
];

const FORBIDDEN_CLAIMS: RegExp[] = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /fully connected/i,
  /bank connected/i,
  /fgis connected/i,
  /\bedo connected/i,
];

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(tsx?|css)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('no fake-live claims across platform-v7 source', () => {
  const files = ROOTS.flatMap((root) => walk(fileURLToPath(new URL(root, import.meta.url))));

  it('scans a non-trivial number of source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('contains no absolute live/connected claims', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_CLAIMS) {
        if (pattern.test(text)) offenders.push(`${file} :: ${pattern}`);
      }
    }
    expect(offenders, `fake-live claims found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
