import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');

  it('uses the runtime entry cockpit as the root entry point', () => {
    expect(page).toContain('getPlatformV7EntryCockpitState');
    expect(page).toContain('Цифровой контур исполнения сделки');
  });

  it('keeps the first screen focused on the cause-to-money chain', () => {
    expect(page).toContain('От причины к деньгам за один экран');
    expect(page).toContain('Остановлено сейчас');
    expect(page).toContain('Открыть главный блокер');
  });

  it('keeps maturity honest without live-integration claims', () => {
    expect(readFileSync(join(process.cwd(), 'lib/platform-v7/runtime/entry-cockpit-state.ts'), 'utf8')).toContain('Без заявлений о live-интеграциях');
    expect(page.toLowerCase()).not.toContain('production-ready');
    expect(page.toLowerCase()).not.toContain('fully live');
  });
});
