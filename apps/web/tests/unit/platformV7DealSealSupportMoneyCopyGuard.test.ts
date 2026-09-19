import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 deal seal and support money copy guard', () => {
  it('keeps DealSeal framed as bank basis and external bank confirmation', () => {
    const source = read('apps/web/components/platform-v7/DealSeal.tsx');

    expect(source).toContain('К банковскому шагу');
    expect(source).toContain('Платформа фиксирует момент и основание сделки');
    expect(source).toContain('Банковское подтверждение выполняет внешний банк');
    expect(source).not.toContain('К выплате');
    expect(source).not.toContain('выпуск денег подтверждает банк');
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });

  it('keeps support-data money cases framed as blocked bank step, not platform money release', () => {
    const source = read('apps/web/lib/platform-v7/support-data.ts');

    expect(source).toContain('Банковский шаг остановлен из-за незакрытой приёмки');
    expect(source).toContain('сумма к банковской проверке');
    expect(source).not.toContain('Выпуск денег остановлен');
    expect(source).not.toContain('сумма к выпуску');
    expect(source).not.toMatch(/пилот|демо/i);
  });
});
