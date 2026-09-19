import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('platform-v7 spacing and contact dock regression', () => {
  const root = resolve(process.cwd());
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

  it('keeps the unified AI/support/call dock mounted on public entry', () => {
    const layout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');

    expect(layout).toContain("import { PublicContactDock } from '@/components/platform-v7/PublicContactDock'");
    expect(layout).toContain('<PublicContactDock />');
    expect(layout).toContain('<HydrationSafeChatSupport renderDock={false} />');
  });

  it('does not let the canonical spacing layer hide or reposition the contact dock', () => {
    const spacing = read('apps/web/styles/platform-v7-spacing-system.css');

    expect(spacing).not.toMatch(/\.pc-public-contact-dock\s*\{[^}]*display\s*:\s*none/is);
    expect(spacing).not.toMatch(/\.pc-public-contact-dock\s*\{[^}]*position\s*:/is);
    expect(spacing).not.toMatch(/\.pc-public-contact-dock\s*\{[^}]*bottom\s*:/is);
  });
});
