import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 money route copy safety', () => {
  const pageSource = read('apps/web/app/platform-v7/money/page.tsx');

  it('does not expose release-oriented money wording', () => {
    expect(pageSource).not.toContain('К выпуску');
    expect(pageSource).not.toContain('к выпуску');
    expect(pageSource).not.toContain('Выпущено');
    expect(pageSource).not.toContain('платформа выпускает деньги');
    expect(pageSource).not.toContain('платформа сама выпускает деньги');
    expect(pageSource).not.toContain('platform releases money');
    expect(pageSource).not.toContain('release funds');
  });

  it('keeps the money route framed as a bank-controlled review contour', () => {
    expect(pageSource).toContain('На банковскую проверку');
    expect(pageSource).toContain('ожидается подтверждение банка');
    expect(pageSource).toContain('Платформа не подменяет банк');
    expect(pageSource).toContain('Проверка основания банком');
    expect(pageSource).toContain('Денежный контур сделки');
  });
});
