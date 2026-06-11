import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
  const cockpitState = readFileSync(join(process.cwd(), 'lib/platform-v7/runtime/entry-cockpit-state.ts'), 'utf8');
  const rootSurface = `${page}\n${cockpitState}`;

  it('uses the execution cockpit as the root entry point', () => {
    expect(page).toContain('getPlatformV7EntryCockpitState');
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain('Открыть главный блокер');
  });

  it('keeps the first screen focused on execution, money, route, documents and blockers', () => {
    expect(rootSurface).toContain('Цифровой контур исполнения сделки');
    expect(rootSurface).toContain('От причины к деньгам');
    expect(rootSurface).toContain('Деньги');
    expect(rootSurface).toContain('Документы');
    expect(rootSurface).toContain('Рейс');
    expect(rootSurface).toContain('Спор');
    expect(rootSurface).toContain('Очередь снятия');
    expect(rootSurface).toContain('Без заявлений о live-интеграциях');
  });

  it('keeps role entry points secondary to the blocker queue', () => {
    const blockerQueueIndex = page.indexOf("aria-label='Очередь блокеров'");
    const roleEntryIndex = page.indexOf("aria-label='Ролевой вход'");

    expect(blockerQueueIndex).toBeGreaterThan(-1);
    expect(roleEntryIndex).toBeGreaterThan(blockerQueueIndex);
    expect(cockpitState).toContain('roleEntrypoints');
  });
});
