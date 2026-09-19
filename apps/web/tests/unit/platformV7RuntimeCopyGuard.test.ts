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

describe('platform-v7 runtime copy guard wiring', () => {
  const gate = readRepoFile('components/platform-v7/SystemRouteSummaryGate.tsx');
  const guard = readRepoFile('components/platform-v7/ExternalCopyGuard.tsx');

  it('keeps the runtime copy guard mounted through the platform gate', () => {
    expect(gate).toContain("import { ExternalCopyGuard } from './ExternalCopyGuard';");
    expect(gate).toContain('<ExternalCopyGuard />');
  });

  it('normalizes text through the external copy replacement dictionary', () => {
    expect(guard).toContain('PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS');
    expect(guard).toContain('Object.entries(PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS)');
    expect(guard).toContain('nextText.split(from).join(to)');
  });

  it('does not mutate code-like surfaces', () => {
    expect(guard).toContain("'SCRIPT'");
    expect(guard).toContain("'STYLE'");
    expect(guard).toContain("'CODE'");
    expect(guard).toContain("'PRE'");
  });

  it('observes newly added nodes so async screen content is protected', () => {
    expect(guard).toContain('new MutationObserver');
    expect(guard).toContain('observer.observe(document.body, { childList: true, subtree: true })');
  });
});
