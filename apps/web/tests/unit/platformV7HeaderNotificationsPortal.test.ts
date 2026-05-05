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

describe('platform-v7 header notifications portal', () => {
  const enhancer = readRepoFile('components/v7r/AiShellEnhancer.tsx');

  it('uses a React portal into the shell header actions', () => {
    expect(enhancer).toContain("import { createPortal } from 'react-dom';");
    expect(enhancer).toContain("document.querySelector('.pc-header-actions')");
    expect(enhancer).toContain('return createPortal(');
  });

  it('renders the notification center as a header child instead of a fixed bridge', () => {
    expect(enhancer).toContain("className='pc-header-notifications-slot'");
    expect(enhancer).toContain('<PlatformV7NotificationCenter />');
    expect(enhancer).not.toContain('pc-notification-center-bridge');
  });

  it('keeps the slot ordered before theme and role controls on mobile', () => {
    expect(enhancer).toContain('order: -1;');
    expect(enhancer).toContain('@media (max-width: 560px)');
  });
});
