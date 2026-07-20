import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 canonical public AI route authority', () => {
  const page = read('app/platform-v7/ai-in-action/page.tsx');
  const layout = read('app/platform-v7/layout.tsx');
  const home = read('app/platform-v7/page.tsx');
  const legacyPage = read('app/platform-v7/demo/ai/page.tsx');
  const nextConfig = read('next.config.js');
  const experience = read('components/platform-v7/PublicAiInActionExperience.tsx');
  const styles = read('components/platform-v7/PublicAiInActionExperience.module.css');
  const seo = read('lib/platform-v7/public-seo-routes.json');

  it('publishes a dedicated route that cannot be confused with the deal walkthrough', () => {
    expect(page).toContain("canonical: '/platform-v7/ai-in-action'");
    expect(page).toContain("data-testid='platform-v7-ai-in-action-authority'");
    expect(page).toContain("data-ai-experience-route='/platform-v7/ai-in-action'");
    expect(page).toContain('interactive-animated-ai-explainer');
    expect(layout).toContain("'/platform-v7/ai-in-action',");
    expect(home).toContain("const aiExperienceHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;");
    expect(page).toContain('<PublicAiInActionExperience locale={locale} />');
    expect(page).not.toContain('PublicDealExplorer');
    expect(page).not.toContain('PublicDealPreview');
    expect(legacyPage).toContain("canonical: '/platform-v7/demo/ai'");
  });

  it('redirects every legacy homepage entry to the canonical animated route', () => {
    expect(nextConfig).toContain("source: '/platform-v7/demo/ai'");
    expect(nextConfig).toContain("destination: '/platform-v7/ai-in-action'");
    expect(nextConfig).toContain('permanent: false');
    expect(seo).toContain('"path": "/platform-v7/ai-in-action"');
    expect(seo).not.toContain('"path": "/platform-v7/demo/ai"');
  });

  it('keeps the actual animated, interactive and explainable AI experience', () => {
    expect(experience).toContain('window.setInterval');
    expect(experience).toContain("name={playing ? 'pause' : 'play'}");
    expect(experience).toContain("type ScenarioKey = 'documents' | 'quality' | 'logistics';");
    expect(experience).toContain("type RoleKey = 'buyer' | 'seller' | 'operator';");
    expect(experience).toContain('scenario.facts.map');
    expect(experience).toContain('className={styles.decisionReason}');
    expect(experience).toContain('className={styles.nextAction}');
    expect(experience).toContain('disabled={phaseIndex < 4 || confirmed}');
    expect(styles).toContain('@keyframes corePulse');
    expect(styles).toContain('@keyframes scanOrbit');
  });
});
