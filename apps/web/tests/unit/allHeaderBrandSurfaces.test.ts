import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('canonical logo coverage across header surfaces', () => {
  it('uses the shared owner-approved BrandMark in every active web shell', () => {
    const surfaces = [
      '../../components/platform-v7/PublicSiteHeader.tsx',
      '../../components/v7r/AppShellV4.tsx',
      '../../components/platform-v7/staff/StaffPlatformShell.tsx',
      '../../app/platform-v7/loading.tsx',
      '../../components/v9/layout/Header.tsx',
      '../../components/v9/layout/Sidebar.tsx',
    ];

    for (const surface of surfaces) {
      expect(read(surface), `${surface} must use the canonical BrandMark`).toContain('BrandMark');
    }
  });

  it('does not retain the v9 placeholder logo', () => {
    const sidebar = read('../../components/v9/layout/Sidebar.tsx');
    const header = read('../../components/v9/layout/Header.tsx');

    expect(sidebar).toContain('<BrandMark size={32} shadow={false} />');
    expect(sidebar).not.toContain('<Layers size={18} color="#fff" />');
    expect(header).toContain('<BrandMark size={32} shadow={false} />');
  });

  it('reuses the same canonical asset in the separate landing application', () => {
    const landing = read('../../../landing/app/components/HeaderLogo.tsx');

    expect(landing).toContain("import { BRAND_LOGO_DATA_URI } from '../../../web/components/v7r/brand-logo-asset'");
    expect(landing).toContain('src={BRAND_LOGO_DATA_URI}');
    expect(landing).not.toContain('data:image/');
  });
});
