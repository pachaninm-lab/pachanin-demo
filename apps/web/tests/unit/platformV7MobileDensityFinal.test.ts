import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final mobile density contract', () => {
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');

  it('keeps a compact fixed header without reducing touch targets', () => {
    expect(enhancements).toContain('--entry-public-header-base: 56px !important');
    expect(enhancements).toContain('--pc-public-header-base-height: 56px !important');
    expect(enhancements).toContain('min-height: 44px !important');
    expect(enhancements).toContain('width: 44px !important');
    expect(enhancements).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 56px) + 12px) !important');
  });

  it('limits mobile heading scale and removes excessive vertical rhythm', () => {
    expect(enhancements).toContain('font-size: clamp(26px, 6.9vw, 30px) !important');
    expect(enhancements).toContain('padding-block: 32px !important');
    expect(enhancements).toContain('margin-bottom: 14px !important');
    expect(enhancements).toContain('padding: 30px 12px !important');
  });

  it('renders the TAI reasoning path as a full-width compact sequence', () => {
    expect(enhancements).toContain('pc-v6-tai-workflow');
    expect(enhancements).toContain('.pc-v6-tai-rules > .pc-v6-tai-workflow');
    expect(enhancements).toContain('grid-template-columns: 26px minmax(0, 1fr) !important');
    expect(enhancements).toContain('font-size: 12px !important');
  });

  it('compacts catalogue, integration and assurance blocks without hiding content', () => {
    expect(enhancements).toContain('min-height: 56px !important');
    expect(enhancements).toContain('.pc-v6-pillar-grid');
    expect(enhancements).toContain('border-bottom: 1px solid var(--pc-v6-line) !important');
    expect(enhancements).toContain('.pc-v6-pillar-grid > div:last-child');
    expect(enhancements).not.toContain('display: none !important; /* crop');
  });

  it('keeps the organization conversion path compact and usable', () => {
    expect(enhancements).toContain('#connect-organization form');
    expect(enhancements).toContain('gap: 14px !important');
    expect(enhancements).toContain('padding: 15px !important');
    expect(enhancements).toContain('#connect-organization form input');
    expect(enhancements).toContain('min-height: 48px !important');
  });
});
