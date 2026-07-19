import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const entryLayout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');
const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const dock = read('apps/web/components/platform-v7/PublicContactDock.tsx');

describe('platform-v7 public entry contact dock mount', () => {
  it('renders the three-action dock in initial entry HTML before the deferred support runtime', () => {
    expect(entryLayout).toContain("import { PublicContactDock } from '@/components/platform-v7/PublicContactDock'");
    expect(entryLayout).toContain("data-public-entry-contact-dock-mounted='true'");
    expect(entryLayout).toContain('<PublicContactDock />');
    expect(entryLayout).toContain('<HydrationSafeChatSupport />');
    expect(entryLayout.indexOf('<PublicContactDock />'))
      .toBeLessThan(entryLayout.indexOf('<HydrationSafeChatSupport />'));
  });

  it('keeps the deferred assistant and support panels without mounting a duplicate public dock', () => {
    expect(contextual).toContain('const externalPublicDock =');
    expect(contextual).toContain("document.querySelector('[data-public-entry-contact-dock-mounted=\"true\"]')");
    expect(contextual).toContain('{externalPublicDock ? null : <PublicContactDock />}');
    expect(contextual).toContain('<PublicPlatformAssistant />');
    expect(contextual).toContain('<ChatSupportWidget />');
  });

  it('ships the launcher-hiding CSS with the server-rendered dock boundary', () => {
    expect(dock).toContain('.p7-support-chat-button {');
    expect(dock).toContain('width: 1px !important');
    expect(dock).toContain('opacity: 0 !important');
    expect(dock).toContain('pointer-events: none !important');
  });
});
