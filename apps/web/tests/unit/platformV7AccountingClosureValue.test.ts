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

  it('explains value for producer, accountant and buyer without connection-state marketing', () => {
    expect(copy).toContain("audience: 'Производителю'");
    expect(copy).toContain("audience: 'Бухгалтеру'");
    expect(copy).toContain("audience: 'Покупателю'");
    expect(copy).toContain('Связь с привычным учётом через управляемый маршрут данных');
    expect(copy).toContain('В Сделку попадают только данные, полученные из разрешённого источника в пределах прав организации');
    expect(copy).toContain('Перечень показывает возможные направления интеграции, а не факт обмена с конкретной организацией.');
    expect(copy).toContain('каждый внешний факт должен иметь соответствующий источник и основание обмена');
  });

  it('keeps Gekta explanatory and external data source-based', () => {
    expect(section).toContain("data-testid='platform-v7-accounting-closure-value'");
    expect(section).toContain('copy.gekta.title');
    expect(section).toContain('copy.connection.title');
    expect(section).toContain('copy.protection.title');
    expect(copy).toContain('Пример показывает, как Гекта может объяснить факты Сделки, имеющиеся основания и следующий шаг');
    expect(copy).toContain('Маршрут обмена определяется для конкретной организации');
    expect(copy).toContain('Пробелы в основаниях не скрываются');
    expect(copy).toContain('вместо положительного предположения');
  });

  it('keeps public external-system language status-free in RU EN ZH', () => {
    for (const claim of [
      '1С подключена',
      'ЭДО подключён',
      'Диадок подключён',
      'Saby подключён',
      'платформа гарантирует оплату',
      'active connection',
      'verified statuses',
      'settlement-ground status',
      'unconfirmed route',
      '未经确认的状态',
      '活动连接',
    ]) expect(copy.toLowerCase()).not.toContain(claim.toLowerCase());
    expect(copy).toContain('Accounting or EDI data can enter this context only through an organisation-authorised exchange route with a clear source.');
    expect(copy).toContain('只有通过机构获授权的数据交换路径并带有明确来源时');
  });

  it('is responsive and accessible on the public homepage', () => {
    expect(section).toContain("role='list'");
    expect(section).toContain("aria-labelledby='accounting-close-title'");
    expect(styles).toContain('@media (max-width: 767px)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toContain('@media (forced-colors: active)');
  });
});
