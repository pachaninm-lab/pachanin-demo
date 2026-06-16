import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 audit surface and money halo copy guard', () => {
  it('keeps MoneyLockHalo framed as bank basis and bank confirmation', () => {
    const source = read('apps/web/components/platform-v7/visual/MoneyLockHalo.tsx');

    expect(source).toContain('основание готово');
    expect(source).toContain('банк подтвердил');
    expect(source).not.toContain('готово к выпуску');
    expect(source).not.toContain('выпущено');
  });

  it('keeps AuditSurfaceSummary framed as bank basis, not fake money release', () => {
    const source = read('apps/web/components/platform-v7/AuditSurfaceSummary.tsx');

    expect(source).toContain('нет ложного банковского подтверждения');
    expect(source).toContain('банковская проверка основания');
    expect(source).toContain('банковский шаг');
    expect(source).not.toContain('нет фальшивой выплаты');
    expect(source).not.toContain('банковская проверка выплаты');
    expect(source).not.toContain('к выпуску');
    expect(source).not.toContain('выпуск не разрешён');
    expect(source).not.toContain('условие выпуска');
    expect(source).not.toContain('кнопка выплаты');
    expect(source).not.toContain('Проверить условия выпуска');
  });
});
