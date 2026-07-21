import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 canonical public TAI route authority', () => {
  const page = read('app/platform-v7/ai-in-action/page.tsx');
  const layout = read('app/platform-v7/layout.tsx');
  const home = read('app/platform-v7/page.tsx');
  const legacyPage = read('app/platform-v7/demo/ai/page.tsx');
  const nextConfig = read('next.config.js');
  const experience = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');
  const styles = read('components/platform-v7/PublicAiInActionSimpleExperience.module.css');
  const seo = read('lib/platform-v7/public-seo-routes.json');

  it('publishes a dedicated canonical passport route', () => {
    expect(page).toContain("canonical: '/platform-v7/ai-in-action'");
    expect(page).toContain("data-testid='platform-v7-ai-in-action-authority'");
    expect(page).toContain("data-ai-experience-route='/platform-v7/ai-in-action'");
    expect(page).toContain('tai-intelligence-contour-passport');
    expect(layout).toContain("'/platform-v7/ai-in-action',");
    expect(home).toContain("const aiExperienceHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;");
    expect(page).toContain('<PublicAiInActionSimpleExperience locale={locale} />');
    expect(page).not.toContain('PublicDealExplorer');
    expect(page).not.toContain('PublicDealPreview');
    expect(legacyPage).toContain("canonical: '/platform-v7/demo/ai'");
  });

  it('keeps legacy entry routing aligned with the canonical route', () => {
    expect(nextConfig).toContain("source: '/platform-v7/demo/ai'");
    expect(nextConfig).toContain("destination: '/platform-v7/ai-in-action'");
    expect(nextConfig).toContain('permanent: false');
    expect(seo).toContain('"path": "/platform-v7/ai-in-action"');
    expect(seo).not.toContain('"path": "/platform-v7/demo/ai"');
  });

  it('uses bounded interaction instead of autonomous or decorative animation', () => {
    expect(experience).toContain("type RoleKey = 'buyer' | 'seller' | 'bank';");
    expect(experience).toContain('setRole(key)');
    expect(experience).toContain('PublicGovernmentDataContour');
    expect(experience).toContain('Prepared actions');
    expect(experience).not.toContain('window.setInterval');
    expect(experience).not.toContain('playing');
    expect(experience).not.toContain('fetch(');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).not.toContain('infinite');
    expect(styles).not.toContain('radial-gradient');
    expect(styles).not.toContain('corePulse');
    expect(styles).not.toContain('scanOrbit');
  });
});
