import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const shellSource = readFileSync(join(root, 'components/v7r/AppShellV4.tsx'), 'utf8');

describe('platform-v7 shell bank navigation copy', () => {
  it('does not imply that the platform releases money from the shell navigation', () => {
    expect(shellSource).not.toContain("note: 'резерв и выпуск'");
    expect(shellSource).not.toContain("note: 'резерв и условия выпуска'");
    expect(shellSource).not.toContain("note: 'резерв, удержание, выпуск'");
    expect(shellSource).not.toContain('платформа выпускает деньги');
    expect(shellSource).not.toContain('платформа сама выпускает деньги');
    expect(shellSource).not.toContain('platform releases money');
    expect(shellSource).not.toContain('release funds');
  });

  it('keeps bank-controlled wording in the shell navigation', () => {
    expect(shellSource).toContain("note: 'резерв и банковская проверка'");
    expect(shellSource).toContain("note: 'резерв и условия банка'");
    expect(shellSource).toContain("note: 'резерв, удержание, подтверждение'");
  });
});
