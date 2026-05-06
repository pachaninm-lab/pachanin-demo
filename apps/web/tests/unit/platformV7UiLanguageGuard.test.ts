import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7NavItems, platformV7RoleStage } from '@/lib/platform-v7/navigation';
import { platformV7EnvironmentInfo, type PlatformEnvironment } from '@/lib/platform-v7/environment';
import { PLATFORM_V7_LEXICON } from '@/lib/platform-v7/lexicon';

const roles: PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

const environments: PlatformEnvironment[] = ['pilot', 'sandbox', 'demo', 'production'];

function userFacingText(): string {
  return [
    ...Object.values(PLATFORM_V7_LEXICON.nav),
    ...Object.values(PLATFORM_V7_LEXICON.env),
    ...Object.values(PLATFORM_V7_LEXICON.actions),
    ...Object.values(PLATFORM_V7_LEXICON.breadcrumbs),
    ...Object.values(PLATFORM_V7_LEXICON.statuses),
    ...roles.flatMap((role) => platformV7NavItems(role).map((item) => item.label)),
    ...roles.map((role) => platformV7RoleStage(role).label),
    ...environments.flatMap((environment) => {
      const info = platformV7EnvironmentInfo(environment);
      return [info.label, info.description];
    }),
  ].join('\n');
}

describe('platform-v7 user-facing language guard', () => {
  it('keeps public labels in the Russian execution-contour language', () => {
    const text = userFacingText();

    expect(text).toContain('Центр управления');
    expect(text).toContain('Лоты и запросы');
    expect(text).toContain('Проверочный сценарий');
    expect(text).toContain('Тестовый контур');
    expect(text).toContain('Ответы банка');
    expect(text).toContain('Доказательный контур');
    expect(text).toContain('Правила сделки');
  });

  it('keeps production boundary explicit', () => {
    const info = platformV7EnvironmentInfo('production');

    expect(info.label).toContain('требует подтверждения');
    expect(info.description).toContain('после подтверждённых подключений');
  });

  it('keeps role stages in business terms', () => {
    expect(platformV7RoleStage('bank').label).toBe('Ответы банка');
    expect(platformV7RoleStage('arbitrator').label).toBe('Доказательный контур');
    expect(platformV7RoleStage('compliance').label).toBe('Правила сделки');
  });
});
