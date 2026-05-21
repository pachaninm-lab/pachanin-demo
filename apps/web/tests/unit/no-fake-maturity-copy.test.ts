import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB_ROOT = existsSync(join(process.cwd(), 'app/platform-v7')) ? process.cwd() : join(process.cwd(), 'apps/web');

const SOURCE_ROOTS = [
  'app/platform-v7',
  'components/platform-v7',
  'components/v7r',
  'lib/platform-v7',
] as const;

const ALLOWED_GUARDRAIL_FILES = new Set([
  'lib/platform-v7/domain/canonical.ts',
  'lib/platform-v7/external-copy-guardrails.ts',
]);

const FORBIDDEN_COPY = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /платформа\s+гарантирует\s+оплату/i,
  /платформа\s+выпустила/i,
  /деньги\s+гарантированы/i,
  /Деньги по сделке выпущены/i,
  /Запускаем выпуск денег/i,
] as const;

describe('no-fake-maturity-copy', () => {
  it('keeps platform-v7 source copy in controlled-pilot framing', () => {
    const matches: string[] = [];

    for (const filePath of sourceFiles()) {
      const text = readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_COPY) {
        if (pattern.test(text)) {
          matches.push(`${relative(process.cwd(), filePath)} :: ${pattern.source}`);
        }
      }
    }

    expect(matches).toEqual([]);
  });
});

function sourceFiles(): string[] {
  return SOURCE_ROOTS.flatMap((root) => collectFiles(join(WEB_ROOT, root)))
    .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
    .filter((filePath) => !ALLOWED_GUARDRAIL_FILES.has(relative(WEB_ROOT, filePath)));
}

function collectFiles(dirPath: string): string[] {
  return readdirSync(dirPath).flatMap((entry) => {
    const entryPath = join(dirPath, entry);
    const stats = statSync(entryPath);
    return stats.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}
