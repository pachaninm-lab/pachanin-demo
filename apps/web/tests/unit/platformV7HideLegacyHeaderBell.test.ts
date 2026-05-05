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

describe('platform-v7 legacy header notification bell guard', () => {
  const enhancer = readRepoFile('components/v7r/AiShellEnhancer.tsx');

  it('hides the legacy shell notification button in header actions', () => {
    expect(enhancer).toContain(".pc-header-actions > button[aria-label^='Уведомления:']");
    expect(enhancer).toContain(".pc-header-actions > div > button[aria-label^='Уведомления:']");
    expect(enhancer).toContain('display: none !important;');
  });

  it('keeps the portal notification button visible', () => {
    expect(enhancer).toContain(".pc-header-actions .pc-header-notifications-slot button[aria-label^='Уведомления:']");
    expect(enhancer).toContain('display: inline-flex !important;');
  });
});
