import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 premium money copy safety', () => {
  it('keeps the premium command money rail bank-safe', () => {
    const source = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    const forbidden = [
      'К выпуску',
      'Выпущено',
      'основания для выпуска денег',
      'platform releases money',
      'release funds',
      'платформа выпускает деньги',
      'платформа сама выпускает деньги',
    ];

    for (const copy of forbidden) expect(source).not.toContain(copy);

    expect(source).toContain('На банковскую проверку');
    expect(source).toContain('Подтверждено банком');
    expect(source).toContain('Банк подтвердил');
    expect(source).toContain('основания для банковской проверки');
  });

  it('keeps platform-v7 not-found navigation out of standalone money-release copy', () => {
    const source = read('apps/web/app/platform-v7/not-found.tsx');

    expect(source).not.toContain('деньги к выпуску');
    expect(source).not.toContain('выпуск денег');
    expect(source).toContain('банковская проверка');
    expect(source).toContain('банковские подтверждения');
  });
});
