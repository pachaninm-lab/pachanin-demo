import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

const scenarioFiles = [
  'apps/web/lib/platform-v7/deal-execution-source-of-truth.ts',
  'apps/web/components/v7r/PlatformCommandCenterHub.tsx',
];

describe('platform-v7 command scenario honesty', () => {
  it('does not present FGIS or grain party as externally confirmed', () => {
    const source = scenarioFiles.map(read).join('\n');

    const forbiddenConfirmedFgisCopy = [
      'Партия подтверждена',
      'ФГИС и партия',
      'ФГИС: выполнено',
      'ФГИС — выполнено',
      'ФГИС — Выполнено',
    ];

    for (const copy of forbiddenConfirmedFgisCopy) expect(source).not.toContain(copy);

    expect(source).toContain('ФГИС: сверка партии');
    expect(source).toContain('Партия отправлена на сверку');
    expect(source).toContain('сверка партии ФГИС');
    expect(source).toContain('Запросить сверку ФГИС');
  });

  it('keeps the first blocker model aligned with five review conditions', () => {
    const source = scenarioFiles.map(read).join('\n');

    expect(source).not.toContain('4 причин остановки');
    expect(source).toContain("blockers.length} условий требуют проверки");
    expect(source).toContain("status: 'проверить', blocker: 'сверка партии ФГИС'");
  });

  it('does not imply platform-controlled money release in the command scenario', () => {
    const source = scenarioFiles.map(read).join('\n');

    const forbiddenUnsafeMoneyCopy = [
      'отгрузку и выпуск денег',
      'К выпуску',
      'Выпущено',
      'платформа выпускает деньги',
      'платформа сама выпускает деньги',
      'platform releases money',
      'release funds',
    ];

    for (const copy of forbiddenUnsafeMoneyCopy) expect(source).not.toContain(copy);

    expect(source).toContain('отгрузку и основание выплаты');
    expect(source).toContain('проверку выплаты');
    expect(source).toContain('выпуск денег банком');
    expect(source).toContain('Передать основание банку');
  });
});
