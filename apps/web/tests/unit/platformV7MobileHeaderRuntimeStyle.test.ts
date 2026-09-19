import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  const candidates = [join(process.cwd(), relativePath), join(process.cwd(), 'apps/web', relativePath)];
  const path = candidates.find((candidate) => existsSync(candidate));

  if (!path) {
    throw new Error(`Cannot find ${relativePath}. Checked: ${candidates.join(', ')}`);
  }

  return readFileSync(path, 'utf8');
}

describe('platform-v7 mobile header runtime style', () => {
  const gate = readRepoFile('components/platform-v7/SystemRouteSummaryGate.tsx');

  it('mounts the runtime mobile header override inside the platform gate', () => {
    expect(gate).toContain('function MobileHeaderRuntimeStyle()');
    expect(gate).toContain('<MobileHeaderRuntimeStyle />');
  });

  it('removes non-critical mobile header pressure below 560px', () => {
    expect(gate).toContain('@media (max-width: 560px)');
    expect(gate).toContain('.pc-brand-copy,');
    expect(gate).toContain('.pc-mobile-role,');
    expect(gate).toContain('display: none !important;');
  });

  it('keeps critical icon buttons inside the visible safe area', () => {
    expect(gate).toContain('max-width: calc(100vw - 148px) !important;');
    expect(gate).toContain('flex: 0 0 44px !important;');
    expect(gate).toContain('overflow: visible !important;');
    expect(gate).toContain('env(safe-area-inset-right)');
  });

  it('has a fallback for narrow 390px screens', () => {
    expect(gate).toContain('@media (max-width: 390px)');
    expect(gate).toContain('max-width: calc(100vw - 136px) !important;');
    expect(gate).toContain('flex-basis: 42px !important;');
  });
});
