import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 support chat mobile viewport', () => {
  it('keeps support chat inside visual viewport on mobile', () => {
    const css = read('apps/web/styles/platform-v7-support-chat-polish.css');

    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('top: var(--p7-support-top, 8px)');
    expect(css).toContain('bottom: auto');
    expect(css).toContain('height: var(--p7-support-height, calc(100dvh - 16px))');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('-webkit-overflow-scrolling: touch');
  });

  it('keeps the support polish stylesheet loaded by the platform template', () => {
    const template = read('apps/web/app/platform-v7/template.tsx');
    expect(template).toContain('platform-v7-support-chat-polish.css');
  });
});
