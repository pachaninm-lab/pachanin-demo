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
  /банк\s+подключ[её]н/i,
  /банковск(?:ая|ое|ий|ие)\s+интеграц(?:ия|ии|ия)\s+подключен/i,
  /ФГИС\s+подключ[её]н/i,
  /ЭДО\s+подключ[её]н/i,
  /ГИС\s+ЭПД\s+подключ[её]н/i,
  // Only an affirmative "live contour is active" boast is forbidden. Honest
  // controlled-pilot framing must be able to mention "боевой контур"/"боевые
  // интеграции" precisely to disclaim them ("не заявляется", "требует договоров",
  // "missing"), so we require an active-state word rather than the bare mention.
  /боев(?:ой|ая|ое|ые)\s+(?:контур|интеграци\w*|подключени\w*)\s+(?:активн\w*|запущен\w*|включ[её]н\w*|работает|готов\w*\s+к\s+(?:работе|бою))/i,
  /реальн(?:ая|ое|ые)\s+подключени(?:е|я)\s+активн/i,
  /все\s+интеграции\s+готовы/i,
  /юридически\s+значим(?:ый|ая|ое)\s+документооборот\s+полностью/i,
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
