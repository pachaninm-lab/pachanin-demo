import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLATFORM_V7_PILOT_RUNBOOK_ROUTE, PLATFORM_V7_SHELL_ROUTE_SURFACE } from '@/lib/platform-v7/routes';

const webRoot = existsSync(join(process.cwd(), 'app/platform-v7')) ? process.cwd() : join(process.cwd(), 'apps/web');
const source = readFileSync(join(webRoot, 'app/platform-v7/pilot-runbook/page.tsx'), 'utf8');

describe('pilot-runbook', () => {
  it('registers the pilot runbook route in the platform-v7 shell', () => {
    expect(PLATFORM_V7_PILOT_RUNBOOK_ROUTE).toBe('/platform-v7/pilot-runbook');
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain('/platform-v7/pilot-runbook');
  });

  it('contains pilot composition manual confirmations and success failure criteria', () => {
    expect(source).toContain('Состав пилота');
    expect(source).toContain('Сделка пилота');
    expect(source).toContain('Ручные подтверждения');
    expect(source).toContain('Что считать успехом');
    expect(source).toContain('Что считать провалом');
    expect(source).toContain('Чеклист оператора');
    expect(source).toContain('ФГИС статус вручную');
    expect(source).toContain('Bank callback вручную');
  });

  it('keeps external contours honest', () => {
    expect(source).toContain('ручная проверка');
    expect(source).toContain('ожидание внешнего подтверждения');
    expect(source).not.toMatch(/production-ready|fully live|fully integrated/i);
    expect(source).not.toMatch(/платформа\s+гарантирует|деньги\s+гарантированы/i);
  });
});
