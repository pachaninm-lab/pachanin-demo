import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public AI in-action experience', () => {
  const page = read('app/platform-v7/ai-in-action/page.tsx');
  const home = read('app/platform-v7/page.tsx');
  const experience = read('components/platform-v7/PublicAiInActionExperience.tsx');
  const styles = read('components/platform-v7/PublicAiInActionExperience.module.css');
  const contextual = read('components/platform-v7/ContextualSupportOrAssistant.tsx');
  const seo = read('lib/platform-v7/public-seo-routes.json');

  it('publishes one indexable public page with the simplified editorial navigation', () => {
    expect(page).toContain("data-testid='platform-v7-ai-in-action-authority'");
    expect(page).toContain("canonical: '/platform-v7/ai-in-action'");
    expect(page).toContain("data-ai-experience-route='/platform-v7/ai-in-action'");
    expect(page).toContain("className='pc-ppe-page pc-ai-in-action-page'");
    expect(page).toContain('<PublicAiInActionExperience locale={locale} />');
    expect(page).toContain("name='home_view'");
    expect(page).toContain("<a href='#scenario'");
    expect(page).toContain("<a href='#result'");
    expect(page).toContain("<a href='#boundaries'");
    expect(page).not.toContain("<a href='#principles'");
    expect(seo).toContain('"path": "/platform-v7/ai-in-action"');
    expect(home).toContain("const aiExperienceHref = `/platform-v7/demo/ai?lang=${encodeURIComponent(locale)}`;");
    expect(home).toContain("eventName='ai_in_action_opened'");
  });

  it('places the concrete blocker, deadline and money at risk in the first screen', () => {
    expect(experience).toContain("title: 'ИИ видит блокер сделки до того, как он задержит расчёт'");
    expect(experience).toContain("signal: 'Протокол отсутствует · срок 6 часов · под риском 6,9 млн ₽'");
    expect(experience).toContain("primary: 'Запустить разбор'");
    expect(experience).toContain('className={styles.heroSignalCard}');
    expect(experience).toContain('className={styles.heroResult}');
    expect(experience).toContain('<dd>{scenario.money}</dd>');
    expect(experience).toContain('<dd>{scenario.deadline}</dd>');
  });

  it('keeps scenario, role and five-stage controls while showing one active stage', () => {
    expect(experience).toContain("type ScenarioKey = 'documents' | 'quality' | 'logistics';");
    expect(experience).toContain("type RoleKey = 'buyer' | 'seller' | 'operator';");
    expect(experience).toContain("const SCENARIO_KEYS: ScenarioKey[] = ['documents', 'quality', 'logistics'];");
    expect(experience).toContain("const ROLE_KEYS: RoleKey[] = ['buyer', 'seller', 'operator'];");
    expect(experience).toContain('ui.phases.map');
    expect(experience).toContain("id='scenario'");
    expect(experience).toContain('aria-pressed={scenarioKey === key}');
    expect(experience).toContain('aria-pressed={roleKey === key}');
    expect(experience).toContain('className={styles.stagePanel}');
    expect(experience).toContain('className={styles.factRail}');
    expect(experience).toContain('className={styles.evidenceDetail}');
    expect(experience).toContain("window.setInterval");
    expect(experience).toContain("name={playing ? 'pause' : 'play'}");
    expect(experience).toContain('(current - 1 + ui.phases.length) % ui.phases.length');
    expect(experience).toContain('(current + 1) % ui.phases.length');
    expect(experience).toContain('onClick={reset}');
    expect(experience).not.toContain('fetch(');
    expect(experience).not.toContain('/api/');
    expect(experience).not.toContain('localStorage');
    expect(experience).not.toContain('sessionStorage');
  });

  it('makes the participant result the visual centre and removes duplicate feedback controls', () => {
    expect(experience).toContain("id='result'");
    expect(experience).toContain('className={styles.resultPanel}');
    expect(experience).toContain('className={styles.reasonCard}');
    expect(experience).toContain('className={styles.nextAction}');
    expect(experience).toContain('<dd>{scenario.impact}</dd>');
    expect(experience).toContain('<dd>{roleAction.owner}</dd>');
    expect(experience).toContain('disabled={!ready || confirmed}');
    expect(experience).toContain('onClick={() => setConfirmed(true)}');
    expect(experience).not.toContain('setFeedback');
    expect(experience).not.toContain('className={styles.feedback}');
    expect(experience).not.toContain("id='principles'");
  });

  it('collapses repeated explanations into exactly three compact boundaries', () => {
    expect(experience).toContain("eyebrow: 'Три проверяемые границы'");
    expect(experience).toContain("title: 'Только разрешённые данные'");
    expect(experience).toContain("title: 'Не изменяет сделку сам'");
    expect(experience).toContain("title: 'Показывает основания'");
    expect(experience).toContain('ui.boundary.cards.map');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(styles).not.toContain('min-height: 600px');
  });

  it('suppresses the global floating AI, support and call surfaces on the explainer route', () => {
    expect(contextual).toContain("const AI_IN_ACTION = '/platform-v7/ai-in-action';");
    expect(contextual).toContain('AI_IN_ACTION,');
    expect(contextual).toContain('if (path === AI_IN_ACTION) return null;');
  });

  it('localizes the experience and protects accessibility and motion preferences', () => {
    expect(experience).toContain('ru: {');
    expect(experience).toContain('en: {');
    expect(experience).toContain('zh: {');
    expect(experience).toContain('Он связывает разрешённые факты');
    expect(experience).toContain('It connects permitted facts');
    expect(experience).toContain('它关联获授权事实');
    expect(experience).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(experience).toContain("aria-live='polite'");
    expect(experience).toContain("aria-current={index === phaseIndex ? 'step' : undefined}");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('@media (max-width: 980px)');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('@media (max-width: 420px)');
    expect(styles).toContain('@keyframes corePulse');
    expect(styles).toContain('@keyframes scanOrbit');
  });

  it('uses a compact mobile composition rather than stacking five full cards', () => {
    expect(styles).toContain('grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr)');
    expect(styles).toContain('.phaseTrack {');
    expect(styles).toContain('overflow-x: auto');
    expect(styles).toContain('.factRail {');
    expect(styles).toContain(".pc-ai-in-action-page .pc-site-header");
    expect(styles).toContain('height: 58px');
    expect(styles).toContain('height: 56px');
  });
});
