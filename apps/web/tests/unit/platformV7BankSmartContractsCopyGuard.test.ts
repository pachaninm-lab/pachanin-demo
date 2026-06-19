import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/BankSmartContractsPanel.tsx'), 'utf8');

describe('platform-v7 bank smart contracts copy guard', () => {
  it('keeps smart-contract panel framed as bank step and bank review', () => {
    expect(source).toContain('Условия банковского шага');
    expect(source).toContain('основание готово к банковской проверке');
    expect(source).toContain('Банк подтвердил');
    expect(source).not.toContain('Условия выпуска');
    expect(source).not.toContain('Выпущено');
    expect(source).not.toContain('готово к банковому выпуску');
    expect(source).not.toContain('выпуск денег');
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });
});
