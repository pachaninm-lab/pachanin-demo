import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../components/platform-v7/ScopedShellGuard.tsx'), 'utf8');

describe('ScopedShellGuard mobile header policy', () => {
  it('keeps mobile header free from duplicated role chip and select', () => {
    expect(source).toContain('function OperatorShellPolicy(');
    expect(source).toContain('.pc-v4-mobile-role');
    expect(source).toContain('.pc-v4-select');
    expect(source).toMatch(/\.pc-v4-mobile-role,\.pc-v4-select[^{]*\{display:none!important\}/);
  });
});
