import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../components/platform-v7/ScopedShellGuard.tsx', import.meta.url), 'utf8');

describe('ScopedShellGuard mobile header policy', () => {
  it('keeps operator mobile header to one role control instead of duplicated role chip and select', () => {
    expect(source).toContain('function OperatorShellPolicy()');
    expect(source).toContain('.pc-v4-mobile-role');
    expect(source).toContain('display: none !important;');
    expect(source).toContain('.pc-v4-select');
    expect(source).toContain('display: inline-block !important;');
  });
});
