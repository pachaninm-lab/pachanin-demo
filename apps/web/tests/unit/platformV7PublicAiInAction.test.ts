import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public AI in-action experience', () => {
  const page = read('app/platform-v7/demo/ai/page.tsx');
  const home = read('app/platform-v7/page.tsx');
  const experience = read('components/platform-v7/PublicAiInActionExperience.tsx');
  const styles = read('components/platform-v7/PublicAiInActionExperience.module.css');
  const seo = read('lib/platform-v7/public-seo-routes.json');

  it('publishes one indexable public page and links the homepage AI status to it', () => {
    expect(page).toContain("data-testid='platform-v7-public-ai-in-action'");
    expect(page).toContain("canonical: '/platform-v7/demo/ai'");
    expect(page).toContain("<PublicAiInActionExperience locale={locale} />");
    expect(page).toContain("name='ai_in_action_view'");
    expect(page).toContain("<a href='#scenario'");
    expect(page).toContain("<a href='#principles'");
    expect(page).toContain("<a href='#boundaries'");
    expect(seo).toContain('"path": "/platform-v7/demo/ai"');
    expect(home).toContain("const aiExperienceHref = `/platform-v7/demo/ai?lang=${encodeURIComponent(locale)}`;");
    expect(home).toContain("eventName='ai_in_action_opened'");
    expect(home).toContain("params={{ source: 'home_ai_status' }}");
  });

  it('offers scenario, role and five-step interactive controls without live public APIs', () => {
    expect(experience).toContain("type ScenarioKey = 'documents' | 'quality' | 'logistics';");
    expect(experience).toContain("type RoleKey = 'buyer' | 'seller' | 'operator';");
    expect(experience).toContain("const SCENARIO_KEYS: ScenarioKey[] = ['documents', 'quality', 'logistics'];");
    expect(experience).toContain("const ROLE_KEYS: RoleKey[] = ['buyer', 'seller', 'operator'];");
    expect(experience).toContain('ui.phases.map');
    expect(experience).toContain("id='scenario'");
    expect(experience).toContain('aria-pressed={scenarioKey === key}');
    expect(experience).toContain('aria-pressed={roleKey === key}');
    expect(experience).toContain('window.setInterval');
    expect(experience).toContain("name={playing ? 'pause' : 'play'}");
    expect(experience).toContain('(current - 1 + ui.phases.length) % ui.phases.length');
    expect(experience).toContain('(current + 1) % ui.phases.length');
    expect(experience).toContain('onClick={reset}');
    expect(experience).not.toContain('fetch(');
    expect(experience).not.toContain('/api/');
    expect(experience).not.toContain('localStorage');
    expect(experience).not.toContain('sessionStorage');
  });

  it('shows evidence, explanation, human confirmation and granular feedback', () => {
    expect(experience).toContain('scenario.facts.map');
    expect(experience).toContain('className={styles.evidenceDetail}');
    expect(experience).toContain('className={styles.decisionReason}');
    expect(experience).toContain('className={styles.nextAction}');
    expect(experience).toContain('disabled={phaseIndex < 4 || confirmed}');
    expect(experience).toContain('onClick={() => setConfirmed(true)}');
    expect(experience).toContain("setFeedback('useful')");
    expect(experience).toContain("setFeedback('adjust')");
    expect(experience).toContain('<dd>confirmation_required</dd>');
    expect(experience).toContain('read_only');
  });

  it('localizes the experience and protects accessibility and motion preferences', () => {
    expect(experience).toContain('ru: {');
    expect(experience).toContain('en: {');
    expect(experience).toContain('zh: {');
    expect(experience).toContain('как ИИ собирает разрешённые факты');
    expect(experience).toContain('how AI collects permitted facts');
    expect(experience).toContain('AI 如何收集获授权事实');
    expect(experience).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(experience).toContain("aria-live='polite'");
    expect(experience).toContain("aria-current={index === phaseIndex ? 'step' : undefined}");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('@media (max-width: 900px)');
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('@media (max-width: 380px)');
    expect(styles).toContain('@keyframes corePulse');
    expect(styles).toContain('@keyframes scanOrbit');
  });
});
