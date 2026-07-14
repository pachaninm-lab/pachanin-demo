import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const serverLayout = read('apps/web/app/platform-v7/layout.tsx');
const guard = read('apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const supportMount = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
const headerCss = read('apps/web/app/platform-v7/_styles/public-header-accessibility.css');
const rootLayout = read('apps/web/app/layout.tsx');

describe('platform-v7 browser acceptance repairs', () => {
  it('keeps protected route authority exclusively in the verified server layout', () => {
    expect(serverLayout).toContain('readVerifiedCabinetSessionRole');
    expect(serverLayout).toContain('canRoleAccessCabinet(role, pathname)');
    expect(guard).toContain('return null');
    for (const forbidden of [
      'useRouter',
      'usePathname',
      'sessionStorage.getItem',
      'router.replace',
      'roleAllows(',
    ]) expect(guard).not.toContain(forbidden);
  });

  it('mounts interactive support only after the initial hydration tree is committed', () => {
    expect(publicHeader).toContain('<HydrationSafeChatSupport />');
    expect(publicHeader).not.toContain('<ChatSupportWidget />');
    expect(supportMount).toContain('const [mounted, setMounted] = React.useState(false)');
    expect(supportMount).toContain('React.useEffect');
    expect(supportMount).toContain('return mounted ? <ChatSupportWidget /> : null');
  });

  it('reserves independent public header tracks and WCAG-sized controls', () => {
    expect(rootLayout).toContain("import './platform-v7/_styles/public-header-accessibility.css'");
    expect(headerCss).toContain('grid-template-columns: auto minmax(0, 1fr) auto');
    expect(headerCss).toContain('.pc-site-header .pc-site-nav > a');
    expect(headerCss).toContain('min-height: 44px');
    expect(headerCss).toContain('padding-inline: 6px');
    expect(headerCss).toContain('.pc-site-header .pc-site-locale-switch');
    expect(headerCss).toContain('min-width: 56px');
  });
});
