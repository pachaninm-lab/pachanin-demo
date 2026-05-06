import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_LEXICON } from '@/lib/platform-v7/lexicon';
import { platformV7NavItems } from '@/lib/platform-v7/navigation';

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

function publicLabels(): string {
  return [
    ...Object.values(PLATFORM_V7_LEXICON.nav),
    ...Object.values(PLATFORM_V7_LEXICON.env),
    ...Object.values(PLATFORM_V7_LEXICON.actions),
    ...Object.values(PLATFORM_V7_LEXICON.breadcrumbs),
    ...roles.flatMap((role) => platformV7NavItems(role).map((item) => item.label)),
  ].join('\n');
}

describe('platform-v7 lexicon and navigation language', () => {
  it('keeps source labels in working Russian execution language', () => {
    const labels = publicLabels();

    expect(labels).toContain('Лоты и запросы');
    expect(labels).toContain('Подключения');
    expect(labels).toContain('Инвесторский обзор');
    expect(labels).toContain('Проверочный сценарий');
    expect(labels).toContain('Тестовый контур');
    expect(labels).toContain('Промышленный контур требует подтверждения');
    expect(labels).toContain('Закупочные запросы');
  });

  it('keeps platform sections connected to execution objects', () => {
    const operatorLabels = platformV7NavItems('operator').map((item) => item.label);
    const sellerLabels = platformV7NavItems('seller').map((item) => item.label);
    const bankLabels = platformV7NavItems('bank').map((item) => item.label);

    expect(operatorLabels).toContain('Центр управления');
    expect(operatorLabels).toContain('Деньги и удержания');
    expect(sellerLabels).toContain('Лоты и запросы');
    expect(bankLabels).toContain('Основания выпуска');
  });
});
