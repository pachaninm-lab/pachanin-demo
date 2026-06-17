import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/CommandPalette.tsx'), 'utf8');

function block(name: string, next: string) {
  return file.slice(file.indexOf(`${name}: [`), file.indexOf(`${next}: [`));
}

describe('platform-v7 command palette role boundaries', () => {
  it('does not expose shared deal/bank/dispute links to field roles', () => {
    const driver = block('driver', 'surveyor');
    const elevator = block('elevator', 'lab');
    const lab = block('lab', 'bank');
    expect(driver).not.toContain('/platform-v7/deals');
    expect(driver).not.toContain('/platform-v7/bank');
    expect(driver).not.toContain('/platform-v7/disputes');
    expect(elevator).not.toContain('/platform-v7/deals');
    expect(elevator).not.toContain('/platform-v7/bank');
    expect(lab).not.toContain('/platform-v7/deals');
    expect(lab).not.toContain('/platform-v7/disputes');
  });

  it('keeps operator and executive broad command access', () => {
    const operator = block('operator', 'buyer');
    const executive = file.slice(file.indexOf('executive: ['), file.indexOf('};', file.indexOf('executive: [')));
    expect(operator).toContain('/platform-v7/deals');
    expect(operator).toContain('/platform-v7/bank');
    expect(operator).toContain('/platform-v7/disputes');
    expect(executive).toContain('/platform-v7/deals');
    expect(executive).toContain('/platform-v7/bank');
    expect(executive).toContain('/platform-v7/disputes');
  });

  it('uses role-aware commands instead of global base commands', () => {
    expect(file).toContain('ROLE_COMMANDS');
    expect(file).not.toContain('const base: Command[]');
    expect(file).toContain("placeholder=\"Найти экран своей роли…\"");
  });
});
