import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 shell bank navigation copy', () => {
  const shellSource = read('components/v7r/AppShellV4.tsx');

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
    // The shell links the bank cabinet and frames it as a verification contour,
    // never as platform-side money release.
    expect(shellSource).toContain("label: 'Банк'");
    expect(shellSource).toContain("'/platform-v7/bank'");
    expect(shellSource).toContain("label: 'Контур проверки'");
  });
});
