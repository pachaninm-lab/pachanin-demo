import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final mobile density contract', () => {
  const page = read('app/platform-v7/page.tsx');
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');
  const densityCss = read('components/platform-v7/PlatformV7HomeMobileDensity.css');

  it('renders the public homepage without a route-level async boundary', () => {
    expect(page).toContain('export default function PlatformV7RootPage()');
    expect(page).toContain("return <><style>{CRITICAL_HOME_CSS}</style><PlatformV7StrategicHome /></>;");
    expect(page).not.toContain('await PlatformV7StrategicHome()');
  });

  it('loads density rules as an early stylesheet instead of a late inline style', () => {
    expect(enhancements).toContain("import './PlatformV7HomeMobileDensity.css'");
    expect(enhancements).not.toContain('HOME_LAYOUT_POLISH');
    expect(enhancements).not.toContain('<style>');
  });

  it('keeps a compact fixed header without reducing touch targets', () => {
    expect(densityCss).toContain('--entry-public-header-base: 56px !important');
    expect(densityCss).toContain('--pc-public-header-base-height: 56px !important');
    expect(densityCss).toContain('min-height: 44px !important');
    expect(densityCss).toContain('width: 44px !important');
    expect(densityCss).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 56px) + 12px) !important');
  });

  it('limits mobile heading scale and removes excessive vertical rhythm', () => {
    expect(densityCss).toContain('font-size: clamp(26px, 6.9vw, 30px) !important');
    expect(densityCss).toContain('padding-block: 32px !important');
    expect(densityCss).toContain('margin-bottom: 14px !important');
    expect(densityCss).toContain('padding: 30px 12px !important');
  });

  it('renders the TAI reasoning path as a full-width compact sequence', () => {
    expect(enhancements).toContain('pc-v6-tai-workflow');
    expect(densityCss).toContain('.pc-v6-tai-rules > .pc-v6-tai-workflow');
    expect(densityCss).toContain('grid-template-columns: 26px minmax(0, 1fr) !important');
    expect(densityCss).toContain('font-size: 12px !important');
  });

  it('compacts catalogue, integration and assurance blocks without hiding content', () => {
    expect(densityCss).toContain('min-height: 56px !important');
    expect(densityCss).toContain('.pc-v6-pillar-grid');
    expect(densityCss).toContain('border-bottom: 1px solid var(--pc-v6-line) !important');
    expect(densityCss).toContain('.pc-v6-pillar-grid > div:last-child');
    expect(densityCss).not.toContain('display: none !important; /* crop');
  });

  it('keeps the organization conversion path compact and usable', () => {
    expect(densityCss).toContain('#connect-organization form');
    expect(densityCss).toContain('gap: 14px !important');
    expect(densityCss).toContain('padding: 15px !important');
    expect(densityCss).toContain('#connect-organization form input');
    expect(densityCss).toContain('min-height: 48px !important');
  });
});
