import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const publicEntryPage = read('apps/web/app/pc-public-entry/platform-v7/page.tsx');
const approvedDock = read('apps/web/styles/platform-v7-home-approved-contact-dock.css');
const sharedDock = read('apps/web/components/platform-v7/PublicContactDock.tsx');

describe('platform-v7 homepage approved contact dock', () => {
  it('scopes the approved visual to the rewritten public homepage', () => {
    expect(publicEntryPage).toContain("import '@/styles/platform-v7-home-approved-contact-dock.css'");
    expect(publicEntryPage).toContain("data-contact-dock-visual='approved'");
    expect(publicEntryPage).toContain('<PlatformV7RootPage />');
    expect(approvedDock).toContain("[data-contact-dock-visual='approved']");
    expect(approvedDock).toContain('display: contents');
  });

  it('restores the last approved balanced glass composition', () => {
    expect(approvedDock).toContain('width: min(390px');
    expect(approvedDock).toContain('gap: 2px');
    expect(approvedDock).toContain('padding: 3px');
    expect(approvedDock).toContain('border: 1px solid rgba(8, 122, 59, .42)');
    expect(approvedDock).toContain('border-radius: 20px');
    expect(approvedDock).toContain('backdrop-filter: blur(18px) saturate(135%)');
    expect(approvedDock).toContain('0 18px 42px rgba(9, 33, 24, .16)');
  });

  it('restores the approved mobile size and lower safe-area placement', () => {
    expect(approvedDock).toContain('min-height: 54px');
    expect(approvedDock).toContain('min-height: 52px');
    expect(approvedDock).toContain('width: 30px');
    expect(approvedDock).toContain('width: 28px');
    expect(approvedDock).toContain('font-size: 12.5px');
    expect(approvedDock).toContain('font-size: 11.5px');
    expect(approvedDock).toContain('bottom: max(6px, calc(env(safe-area-inset-bottom, 0px) + 4px))');
    expect(approvedDock).toContain('bottom: max(2px, calc(env(safe-area-inset-bottom, 0px) + 2px))');
  });

  it('keeps three equal actions and the phone number visually hidden', () => {
    expect(approvedDock).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(approvedDock).toContain('.pc-public-contact-dock-assistant strong');
    expect(approvedDock).toContain('color: inherit');
    expect(approvedDock).toContain('font-weight: 720');
    expect(sharedDock).toContain("assistant: 'ИИ'");
    expect(sharedDock).toContain("support: 'Поддержка'");
    expect(sharedDock).toContain("call: 'Позвонить'");
    expect(sharedDock).not.toContain('<small>{SUPPORT_PHONE_DISPLAY}</small>');
  });
});
