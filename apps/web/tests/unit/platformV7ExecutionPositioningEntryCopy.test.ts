import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = existsSync(join(process.cwd(), 'app/platform-v7')) ? process.cwd() : join(process.cwd(), 'apps/web');

const read = (relativePath: string) => readFileSync(join(webRoot, relativePath), 'utf8');

const entryFiles = [
  'app/platform-v7/not-found.tsx',
  'components/v7r/AppShellV4.tsx',
];

const forbiddenEntryCopy = [
  '/platform-v7/marketplace',
  'Витрина лотов',
  'Демо-сценарий',
  "href='/platform-v7/demo'",
  'href="/platform-v7/demo"',
  'SLA',
  'ETA',
  'выпуск денег',
  'деньги к выпуску',
  'резерв и выпуск',
  'резерв, удержание, выпуск',
  'предпилотный сценарий',
  'безопасная оплата',
  'рынок заявок',
];

describe('platform-v7 execution positioning entry copy', () => {
  it('keeps not-found and shell entry points out of marketplace/demo/release wording', () => {
    const source = entryFiles.map(read).join('\n');

    for (const copy of forbiddenEntryCopy) {
      expect(source, `entry copy must not contain "${copy}"`).not.toContain(copy);
    }
  });

  it('routes entry recovery to execution surfaces', () => {
    const notFound = read('app/platform-v7/not-found.tsx');
    const shell = read('components/v7r/AppShellV4.tsx');

    expect(notFound).toContain('/platform-v7/lots');
    expect(notFound).toContain('Лоты исполнения');
    expect(shell).toContain('/platform-v7/execution-map');
    expect(shell).toContain('Карта исполнения');
  });
});
