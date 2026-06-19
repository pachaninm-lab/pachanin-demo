import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 single role login', () => {
  it('contains the fixed single entry copy and key roles', () => {
    expect(source).toContain('Единый вход');
    expect(source).toContain('Выберите один рабочий кабинет');
    expect(source).toContain('Водитель');
    expect(source).toContain('Комплаенс');
    expect(source).toContain('Руководитель');
  });
});
