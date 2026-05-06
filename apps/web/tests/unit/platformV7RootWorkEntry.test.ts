import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
  const hub = readFileSync(join(process.cwd(), 'components/v7r/PlatformCommandCenterHub.tsx'), 'utf8');

  it('uses the command center hub as the root entry point', () => {
    expect(page).toContain('PlatformCommandCenterHub');
  });

  it('keeps the first screen focused on execution, money, cargo, documents and blockers', () => {
    expect(hub).toContain('Центр исполнения сделки');
    expect(hub).toContain('Деньги');
    expect(hub).toContain('Груз');
    expect(hub).toContain('Документы');
    expect(hub).toContain('Блокер');
    expect(hub).toContain('Следующий шаг');
    expect(hub).toContain('Рабочий контур сделки');
  });

  it('keeps role entry points secondary and hidden behind details', () => {
    expect(hub).toContain('<details');
    expect(hub).toContain('Открыть список ролей');
    expect(hub).toContain('Ролевые входы скрыты в меню');
  });
});
