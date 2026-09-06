import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const header = read('apps/web/components/platform-v7/ContactFixedHeader.tsx');
const homeCss = read('apps/web/styles/platform-v7-international-home-fix.css');
const mobileAcceptance = read('apps/web/tests/e2e/platform-v7-production-mobile-acceptance.spec.ts');

describe('platform-v7 final production public regressions', () => {
  it('renders the contact brand home accessible name from locale-native copy', () => {
    expect(header).toContain("brandHome: 'Прозрачная Цена — на главную'");
    expect(header).toContain("brandHome: 'Transparent Price — home'");
    expect(header).toContain("brandHome: '透明价格 — 返回首页'");
    expect(header).toContain('brandHomeLabel={copy.brandHome}');
  });

  it('keeps every homepage section anchor below the live fixed header', () => {
    for (const id of ['participants', 'difference', 'deal-path', 'functions', 'live', 'trust', 'tai', 'faq', 'connect-organization']) {
      expect(homeCss).toContain(`#${id}`);
    }
    expect(homeCss).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 64px) + 18px) !important;');
  });

  it('keeps the original 44px production heading ceiling instead of weakening the gate', () => {
    expect(homeCss).toContain('font-size: clamp(38px, 3.3vw, 44px) !important;');
    expect(mobileAcceptance).toContain('heading.fontSize >= 26 && heading.fontSize <= 44');
    expect(mobileAcceptance).not.toContain('maxHeadingFontSize');
  });
});
