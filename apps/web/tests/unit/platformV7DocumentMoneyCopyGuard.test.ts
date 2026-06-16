import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 document money copy guard', () => {
  it('keeps document page framed as bank basis, not platform-side money release', () => {
    const source = read('apps/web/app/platform-v7/deals/[id]/documents/page.tsx');

    expect(source).toContain('готовность основания для банка');
    expect(source).toContain('Основание готово для банка');
    expect(source).toContain('До банка');
    expect(source).toContain('банковской проверки основания');
    expect(source).toContain('Передать основание банку');
  });

  it('keeps reason code copy framed around bank review and external confirmation', () => {
    const source = read('apps/web/lib/i18n/reason-codes.ts');

    expect(source).toContain('Банк проверяет основание');
    expect(source).toContain('внешним банковским подтверждением');
    expect(source).toContain('банковский шаг заблокирован');
    expect(source).toContain('перед банковским шагом');
  });

  it('does not reintroduce old autonomous money-release copy in document/reason paths', () => {
    const combined = [
      read('apps/web/app/platform-v7/deals/[id]/documents/page.tsx'),
      read('apps/web/lib/i18n/reason-codes.ts'),
    ].join('\n');

    expect(combined).not.toContain('готовность к выпуску денег');
    expect(combined).not.toContain('Документы готовы к выпуску');
    expect(combined).not.toContain('До выпуска');
    expect(combined).not.toContain('Запрос на выпуск');
    expect(combined).not.toContain('Нельзя запросить выпуск');
    expect(combined).not.toContain('банковской проверки выплаты');
    expect(combined).not.toContain('перед выпуском денег');
    expect(combined).not.toContain('выпуск денег заблокирован');
    expect(combined).not.toContain('перед выпуском');
    expect(combined).not.toMatch(/пилот|демо/i);
    expect(combined).not.toContain('платформа гарантирует оплату');
    expect(combined).not.toContain('деньги автоматически выпускаются');
  });
});
