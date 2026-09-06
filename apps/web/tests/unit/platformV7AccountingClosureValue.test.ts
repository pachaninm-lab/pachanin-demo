import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const section = read('components/platform-v7/PlatformV7AccountingClosureValue.tsx');
const styles = read('components/platform-v7/PlatformV7AccountingClosureValue.module.css');
const copy = read('i18n/platform-v7-accounting-value.ts');

describe('platform-v7 accounting closure homepage value', () => {
  it('places the section after the ordinary Deal path and before the illustrative states', () => {
    expect(home).toContain("import { PlatformV7AccountingClosureValue } from './PlatformV7AccountingClosureValue';");
    expect(home).toContain('<PlatformV7AccountingClosureValue locale={locale} />');
    const dealPath = home.indexOf("id='deal-path'");
    const accounting = home.indexOf('<PlatformV7AccountingClosureValue locale={locale} />');
    const live = home.indexOf("id='live'");
    expect(dealPath).toBeGreaterThan(-1);
    expect(accounting).toBeGreaterThan(dealPath);
    expect(live).toBeGreaterThan(accounting);
  });

  it('explains value for producer, accountant and buyer without promising a live external connection', () => {
    expect(copy).toContain("audience: 'Производителю'");
    expect(copy).toContain("audience: 'Бухгалтеру'");
    expect(copy).toContain("audience: 'Покупателю'");
    expect(copy).toContain('Связь с привычным учётом — после подтверждения подключения');
    expect(copy).toContain('До такого подключения платформа не обещает автоматический обмен или отсутствие двойного ввода.');
    expect(copy).toContain('Перечень показывает поддерживаемые направления интеграции, а не подтверждение активного соединения.');
    expect(copy).toContain('доступность конкретного маршрута и фактический обмен подтверждаются отдельно для организации');
  });

  it('keeps Gekta explanatory and treats connection as organisation-specific', () => {
    expect(section).toContain("data-testid='platform-v7-accounting-closure-value'");
    expect(section).toContain('copy.gekta.title');
    expect(section).toContain('copy.connection.title');
    expect(section).toContain('copy.protection.title');
    expect(copy).toContain('Пример показывает, как Гекта может объяснить состояние Сделки');
    expect(copy).toContain('Подключение определяется для конкретной организации');
    expect(copy).toContain('Ошибки и неподтверждённые статусы не скрываются');
    expect(copy).toContain('вместо ложного статуса «готово»');
  });

  it('keeps public maturity language honest in RU EN ZH', () => {
    for (const claim of [
      '1С подключена',
      'ЭДО подключён',
      'Диадок подключён',
      'Saby подключён',
      'платформа гарантирует оплату',
      'without duplicate entry',
      'active connection',
    ]) expect(copy.toLowerCase()).not.toContain(claim.toLowerCase());
    expect(copy).toContain('If a specific accounting or EDI connection is confirmed for the organisation');
    expect(copy).toContain('具体可用性和实际交换需要针对机构单独确认');
  });

  it('is responsive and accessible on the public homepage', () => {
    expect(section).toContain("role='list'");
    expect(section).toContain("aria-labelledby='accounting-close-title'");
    expect(styles).toContain('@media (max-width: 767px)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toContain('@media (forced-colors: active)');
  });
});
