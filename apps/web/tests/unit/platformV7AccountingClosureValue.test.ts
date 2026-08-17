import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const section = read('components/platform-v7/PlatformV7AccountingClosureValue.tsx');
const styles = read('components/platform-v7/PlatformV7AccountingClosureValue.module.css');
const copy = read('i18n/platform-v7-accounting-value.ts');

describe('platform-v7 accounting closure homepage value', () => {
  it('places the section after the Deal path and before the live scenario', () => {
    expect(home).toContain("import { PlatformV7AccountingClosureValue } from './PlatformV7AccountingClosureValue';");
    expect(home).toContain('<PlatformV7AccountingClosureValue locale={locale} />');

    const dealPath = home.indexOf("id='deal-path'");
    const accounting = home.indexOf('<PlatformV7AccountingClosureValue locale={locale} />');
    const live = home.indexOf("id='live'");

    expect(dealPath).toBeGreaterThan(-1);
    expect(accounting).toBeGreaterThan(dealPath);
    expect(live).toBeGreaterThan(accounting);
  });

  it('explains value for producer, accountant and buyer without replacing external systems', () => {
    expect(copy).toContain("audience: 'Фермеру'");
    expect(copy).toContain("audience: 'Бухгалтеру'");
    expect(copy).toContain("audience: 'Покупателю'");
    expect(copy).toContain('Привычная 1С без двойного ввода');
    expect(copy).toContain('Платформа не заменяет 1С, Диадок, Saby или 1С-ЭДО.');
    expect(copy).toContain('Доступность конкретного маршрута подтверждается при подключении организации.');
  });

  it('adds the Gekta explanation, self-service connection and evidence-bound control value', () => {
    expect(section).toContain("data-testid='platform-v7-accounting-closure-value'");
    expect(section).toContain('copy.gekta.title');
    expect(section).toContain('copy.connection.title');
    expect(section).toContain('copy.protection.title');
    expect(copy).toContain('Подключение — один раз для организации');
    expect(copy).toContain('Ошибки и неподтверждённые статусы не скрываются');
    expect(copy).toContain('вместо ложного статуса «готово»');
  });

  it('keeps public maturity language honest', () => {
    const forbidden = [
      '1С подключена',
      'ЭДО подключён',
      'Диадок подключён',
      'Saby подключён',
      'платформа гарантирует оплату',
    ];

    for (const claim of forbidden) expect(copy.toLowerCase()).not.toContain(claim.toLowerCase());
  });

  it('is responsive and accessible on the public homepage', () => {
    expect(section).toContain("role='list'");
    expect(section).toContain("aria-labelledby='accounting-close-title'");
    expect(styles).toContain('@media (max-width: 767px)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toContain('@media (forced-colors: active)');
  });
});
