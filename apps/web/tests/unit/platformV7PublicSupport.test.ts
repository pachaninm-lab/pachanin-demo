import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('platform-v7 public support boundary', () => {
  const widget = read('apps/web/components/platform-v7/PublicSupportWidget.tsx');
  const styles = read('apps/web/components/platform-v7/PublicSupportWidget.module.css');
  const publicLayout = read('apps/web/app/(platform-public)/platform-v7/layout.tsx');
  const legacyGuards = read('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx');

  it('does not use timers, observers or global viewport mutation', () => {
    expect(widget).not.toContain('MutationObserver');
    expect(widget).not.toContain('setTimeout');
    expect(widget).not.toContain('setInterval');
    expect(widget).not.toContain('visualViewport');
    expect(widget).not.toContain('document.documentElement.style');
    expect(widget).not.toContain('<style>');
  });

  it('provides accessible trigger and dialog semantics', () => {
    expect(widget).toContain("aria-controls='public-support-dialog'");
    expect(widget).toContain("role='dialog'");
    expect(widget).toContain("aria-labelledby='public-support-title'");
    expect(widget).toContain("role='alert'");
    expect(widget).toContain("event.key !== 'Escape'");
  });

  it('meets the minimum mobile target and safe-area constraints', () => {
    expect(styles).toContain('inline-size: 56px');
    expect(styles).toContain('block-size: 56px');
    expect(styles).toContain('env(safe-area-inset-bottom)');
    expect(styles).toContain('100dvh');
  });

  it('mounts support only in the isolated public route layout', () => {
    expect(publicLayout).toContain('<PublicSupportWidget />');
    expect(publicLayout).not.toContain('PlatformV7TemplateGuards');
    expect(legacyGuards).not.toContain('PublicSupportWidget');
    expect(legacyGuards).not.toContain('CANONICAL_PUBLIC_ENTRY_PATHS');
    expect(legacyGuards).not.toContain("'/platform-v7/login'");
  });
});
