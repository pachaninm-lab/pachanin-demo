import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 company and readiness copy guard', () => {
  it('keeps company profile money copy bank-framed', () => {
    const source = read('apps/web/app/platform-v7/companies/[inn]/page.tsx');

    expect(source).toContain('Основание готово к банковской проверке');
    expect(source).toContain('От сделки до банковского подтверждения');
    expect(source).not.toContain('готов к выпуску денег');
    expect(source).not.toContain('Готово к выпуску');
    expect(source).not.toContain('От сделки до выпуска денег');
  });

  it('keeps readiness page framed as execution and bank basis readiness', () => {
    const source = read('apps/web/app/platform-v7/readiness/page.tsx');

    expect(source).toContain('Матрица готовности · контрольный контур');
    expect(source).toContain('Готовность сделки к исполнению и банковскому основанию');
    expect(source).toContain('Готовы к банку');
    expect(source).toContain('Контрольная сделка');
    expect(source).toContain('Банк:');
    expect(source).not.toContain('Матрица готовности · песочница');
    expect(source).not.toContain('Готовность сделки к исполнению и выпуску денег');
    expect(source).not.toContain('Демо-сделка');
    expect(source).not.toContain('Выпуск:');
  });
});
