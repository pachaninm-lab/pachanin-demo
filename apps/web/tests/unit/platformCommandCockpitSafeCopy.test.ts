import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 command cockpit safe copy', () => {
  it('keeps FGIS as a verification step rather than a confirmed external event', () => {
    const source = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    const forbiddenCopy = [
      'ФГИС и партия',
      'Партия подтверждена',
      'ФГИС / Партия подтверждена',
      'Партия ФГИС-68-2403-001 подтверждена',
    ];

    for (const copy of forbiddenCopy) expect(source).not.toContain(copy);
    expect(source).toContain('ФГИС: сверка партии');
    expect(source).toContain('Запросить сверку ФГИС');
  });

  it('does not imply platform-controlled money release from the cockpit', () => {
    const source = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    const forbiddenMoneyCopy = [
      "block: 'выпуск денег'",
      "label: 'Выпустить деньги'",
      'платформа выпускает деньги',
      'platform releases money',
    ];

    for (const copy of forbiddenMoneyCopy) expect(source).not.toContain(copy);
    expect(source).toContain('основание выплаты');
    expect(source).toContain('выпуск денег банком');
    expect(source).toContain('Передать основание банку');
  });

  it('uses verification-condition wording for cockpit blockers', () => {
    const source = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    expect(source).toContain('условий требуют проверки');
    expect(source).not.toContain('причин остановки:');
  });
});
