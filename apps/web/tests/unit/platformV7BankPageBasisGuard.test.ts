import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/bank/page.tsx'), 'utf8');

describe('platform-v7 bank page basis guard', () => {
  it('keeps DL-9106 bank basis blocked until the document and quality matrix is closed', () => {
    expect(source).toContain("releaseNow: '0 ₽'");
    expect(source).toContain('не передавать основание банку');
    expect(source).toContain('Основание для банковской проверки выплаты не сформировано');
    expect(source).toContain('СДИЗ');
    expect(source).toContain('ЭТрН');
    expect(source).toContain('Акт приёмки');
    expect(source).toContain('Протокол качества');
  });

  it('keeps the bank cockpit framed as basis review, not autonomous money movement', () => {
    expect(source).toContain('Сначала основание, потом банковская проверка');
    expect(source).toContain('Деньги не двигаются, пока нет основания');
    expect(source).toContain('Платформа деньги не передаёт без банка');
    expect(source).toContain('к передаче банку 0 ₽');
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
    expect(source).not.toContain('банк подключён');
  });
});
