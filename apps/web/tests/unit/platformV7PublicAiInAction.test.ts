import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public TAI passport', () => {
  const page = read('app/platform-v7/ai-in-action/page.tsx');
  const home = read('app/platform-v7/page.tsx');
  const experience = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');
  const styles = read('components/platform-v7/PublicAiInActionSimpleExperience.module.css');
  const contextual = read('components/platform-v7/ContextualSupportOrAssistant.tsx');
  const government = read('components/platform-v7/PublicGovernmentDataContour.tsx');
  const seo = read('lib/platform-v7/public-seo-routes.json');

  it('publishes one indexable passport route in the same public design system', () => {
    expect(page).toContain("data-testid='platform-v7-ai-in-action-authority'");
    expect(page).toContain("canonical: '/platform-v7/ai-in-action'");
    expect(page).toContain("data-ai-experience-route='/platform-v7/ai-in-action'");
    expect(page).toContain('tai-intelligence-contour-passport');
    expect(page).toContain("className='pc-ppe-page pc-ai-in-action-page'");
    expect(page).toContain('<PublicAiInActionSimpleExperience locale={locale} />');
    expect(page).toContain("name='ai_in_action_opened'");
    expect(page).toContain("import '@/styles/platform-v7-public-intelligence-layer.css'");
    expect(seo).toContain('"path": "/platform-v7/ai-in-action"');
    expect(home).toContain("const aiExperienceHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;");
  });

  it('implements the ten passport sections required by the public positioning', () => {
    expect(experience).toContain("id='role'");
    expect(experience).toContain("id='role-analysis'");
    expect(experience).toContain("id='documents'");
    expect(experience).toContain('<PublicGovernmentDataContour locale={localeKey} />');
    expect(experience).toContain("id='risks-money'");
    expect(experience).toContain("id='prepared-actions'");
    expect(experience).toContain("id='evidence'");
    expect(experience).toContain("id='security'");
    expect(experience).toContain("id='limitations'");
    expect(experience).toContain("id='connection'");
  });

  it('keeps the operational boundary explicit and does not overstate maturity', () => {
    expect(experience).toContain("status: 'NOT_ATTESTED'");
    expect(experience).toContain('Ни один неподтверждённый источник не показывается подключённым');
    expect(experience).toContain('Неподключённая государственная система не отображается как подключённая');
    expect(experience).toContain('TAI не подписывает');
    expect(experience).toContain('Screen scraping государственных личных кабинетов запрещён');
    expect(experience).toContain('Production остаётся в собственном VPS-контуре платформы');
    expect(experience).not.toContain('llama.cpp');
    expect(experience).not.toContain('embeddings');
  });

  it('provides role-aware interactive results without live data or autonomous writes', () => {
    expect(experience).toContain("type RoleKey = 'buyer' | 'seller' | 'bank';");
    expect(experience).toContain("const ROLE_ORDER: RoleKey[] = ['buyer', 'seller', 'bank'];");
    expect(experience).toContain("role='tablist'");
    expect(experience).toContain('aria-selected={role === key}');
    expect(experience).toContain("aria-live='polite'");
    expect(experience).toContain("trackEvent('role_intelligence_opened'");
    expect(experience).not.toContain('fetch(');
    expect(experience).not.toContain('/api/');
    expect(experience).not.toContain('localStorage');
    expect(experience).not.toContain('sessionStorage');
  });

  it('shows safe government source statuses instead of fabricated live checks', () => {
    expect(government).toContain("status: 'OFFICIAL_ACCESS_REQUIRED'");
    expect(government).toContain("status: 'PUBLIC_REGISTRY'");
    expect(government).not.toContain("status: 'CONNECTED'");
    expect(government).toContain('Текущая проверка не выполнялась');
    expect(government).toContain('Screen scraping запрещён');
    expect(government).toContain('ACCREDITED_OPERATOR_API');
    expect(government).toContain('CONDITIONAL_OFFICIAL_API');
  });

  it('preserves the unified public AI, support and call dock on the passport route', () => {
    expect(contextual).toContain("const AI_IN_ACTION = '/platform-v7/ai-in-action';");
    expect(contextual).toContain('AI_IN_ACTION,');
    expect(contextual).not.toContain('if (path === AI_IN_ACTION) return null;');
    expect(contextual).toContain('{renderDock ? <PublicContactDock /> : null}');
  });

  it('localizes RU EN ZH and supports mobile, focus and reduced motion', () => {
    expect(experience).toContain('ru: {');
    expect(experience).toContain('en: {');
    expect(experience).toContain('zh: {');
    expect(experience).toContain('TAI is the evidence layer of deal execution');
    expect(experience).toContain('TAI 是交易执行的证据层');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('@media (max-width: 1024px)');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('@media (max-width: 430px)');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('overflow-x: clip');
    expect(styles).not.toContain('corePulse');
    expect(styles).not.toContain('scanOrbit');
  });
});
