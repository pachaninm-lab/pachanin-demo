import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/GrainReleaseCockpit.tsx'), 'utf8');

describe('platform-v7 grain release cockpit money copy guard', () => {
  it('keeps cockpit money copy framed as bank basis and held amount', () => {
    expect(source).toContain('банк ждёт подтверждённое основание');
    expect(source).toContain('к банковскому шагу');
    expect(source).toContain('Банковское подтверждение не проводится целиком');
    expect(source).toContain('частичная банковская проверка');
    expect(source).toContain('банковский шаг и удержание денег');
  });

  it('does not render autonomous money-release wording in cockpit', () => {
    expect(source).not.toContain('выпуск ждёт основание банка');
    expect(source).not.toContain('к выпуску через банк');
    expect(source).not.toContain('Деньги не выпускаются целиком');
    expect(source).not.toContain('частичный выпуск денег');
    expect(source).not.toContain('выпуск и удержание денег');
    expect(source).not.toContain('самостоятельном выпуске денег платформой');
    expect(source).not.toMatch(/пилот|демо/i);
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });
});
