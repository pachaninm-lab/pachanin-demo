import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const loginSource = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const guardSource = readFileSync(resolve(process.cwd(), 'apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx'), 'utf8');

describe('platform-v7 single role login', () => {
  it('contains the fixed single entry copy and key roles', () => {
    expect(loginSource).toContain('Единый вход');
    expect(loginSource).toContain('Выберите один рабочий кабинет');
    expect(loginSource).toContain('Водитель');
    expect(loginSource).toContain('Комплаенс');
    expect(loginSource).toContain('Руководитель');
  });

  it('hides foreign cabinet links instead of only redirecting after click', () => {
    expect(guardSource).toContain('hideForeignCabinetLinks');
    expect(guardSource).toContain('link.hidden = true');
    expect(guardSource).toContain('operator: [\'/platform-v7/control-tower\']');
    expect(guardSource).toContain('driver: [\'/platform-v7/driver\']');
    expect(guardSource).not.toContain("driver: ['/platform-v7/driver', '/platform-v7/deals");
    expect(guardSource).not.toContain("buyer: ['/platform-v7/buyer', '/platform-v7/procurement', '/platform-v7/deals', '/platform-v7/bank']");
  });
});
