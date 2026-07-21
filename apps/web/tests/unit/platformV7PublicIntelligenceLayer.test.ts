import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');
const exists = (relativePath: string) => existsSync(join(process.cwd(), relativePath));

const componentPaths = [
  'components/platform-v7/PublicHeroIntelligenceStatus.tsx',
  'components/platform-v7/PublicDealIntelligencePanel.tsx',
  'components/platform-v7/PublicStageIntelligenceCoverage.tsx',
  'components/platform-v7/PublicRoleIntelligenceSummary.tsx',
  'components/platform-v7/PublicEvidenceIntelligencePanel.tsx',
  'components/platform-v7/PublicGovernmentDataContour.tsx',
  'components/platform-v7/PublicGovernmentSourceResult.tsx',
  'components/platform-v7/PublicAiGovernanceStrip.tsx',
  'components/platform-v7/PublicContextualAssistantPrompts.tsx',
] as const;

describe('platform-v7 P0 public intelligence layer', () => {
  const page = read('app/platform-v7/page.tsx');
  const preview = read('components/platform-v7/PublicDealPreview.tsx');
  const assistant = read('components/platform-v7/PublicPlatformAssistant.tsx');
  const contextualPrompts = read('components/platform-v7/PublicContextualAssistantPrompts.tsx');
  const government = read('components/platform-v7/PublicGovernmentDataContour.tsx');
  const governmentResult = read('components/platform-v7/PublicGovernmentSourceResult.tsx');
  const css = read('styles/platform-v7-public-intelligence-layer.css');

  it('creates every specified P0 component and one intelligence stylesheet', () => {
    for (const path of componentPaths) expect(exists(path), path).toBe(true);
    expect(exists('styles/platform-v7-public-intelligence-layer.css')).toBe(true);
    expect(page).toContain("import '@/styles/platform-v7-public-intelligence-layer.css'");
  });

  it('keeps existing product sections and adds only the government data section', () => {
    const ordered = [
      page.indexOf("id='deal-example'"),
      page.indexOf("id='participants'"),
      page.indexOf("id='evidence-contour'"),
      page.indexOf('<PublicGovernmentDataContour locale={locale} />'),
      page.indexOf("id='reliability'"),
      page.indexOf("className='pc-ppe-final-cta'"),
    ];
    for (const index of ordered) expect(index).toBeGreaterThan(-1);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(page).toContain('<PublicAiGovernanceStrip locale={locale} />');
  });

  it('updates the TAI summary when the four existing Deal lenses change', () => {
    expect(preview).toContain("type PublicDealLens");
    expect(preview).toContain("['execution', 'documents', 'money', 'risk']");
    expect(preview).toContain('setLens(key)');
    expect(preview).toContain('<PublicDealIntelligencePanel locale={locale} lens={lens} />');
    expect(preview).toContain("role='tab'");
    expect(preview).toContain("aria-live='polite'");
    expect(preview).toContain("emit('deal_intelligence_lens_changed'");
  });

  it('exposes at least seven source categories while failing closed', () => {
    for (const code of ['grain', 'land', 'seed', 'saturn', 'argus', 'accreditation', 'epd', 'vetis']) {
      expect(government).toContain(`${code}:`);
    }
    expect(government).toContain("status: 'OFFICIAL_ACCESS_REQUIRED'");
    expect(government).toContain("status: 'PUBLIC_REGISTRY'");
    expect(government).not.toContain("status: 'CONNECTED'");
    expect(governmentResult).toContain("resultValue: 'Проверка не выполнялась'");
    expect(governmentResult).toContain("trackEvent('government_status_opened'");
    expect(governmentResult).toContain("trackEvent('government_limitation_opened'");
  });

  it('passes only public section context and prompt text to the assistant', () => {
    expect(page).toContain('<PublicContextualAssistantPrompts locale={locale} />');
    expect(contextualPrompts).toContain("type ContextKey = 'platform' | 'deal' | 'roles' | 'evidence' | 'government';");
    expect(contextualPrompts).toContain("window.dispatchEvent(new CustomEvent('pc:public-assistant-context'");
    expect(contextualPrompts).not.toContain('dealId');
    expect(contextualPrompts).not.toContain('tenantId');
    expect(contextualPrompts).not.toContain('documentId');
    expect(assistant).toContain("window.addEventListener('pc:public-assistant-context'");
    expect(assistant).toContain("window.dispatchEvent(new CustomEvent('pc:public-assistant-context-request'));");
    expect(assistant).toContain("trackEvent('contextual_ai_prompt_opened'");
  });

  it('uses bounded CSS and the required responsive and accessibility gates', () => {
    expect(css).toContain('--pc-intelligence-ease: cubic-bezier(.22, 1, .36, 1)');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (max-width: 1024px)');
    expect(css).toContain('@media (max-width: 820px)');
    expect(css).toContain('@media (max-width: 520px)');
    expect(css).toContain('@media (max-width: 350px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('overflow-x: clip');
    expect(css).not.toContain('WebGL');
    expect(css).not.toContain('lottie');
    expect(css).not.toContain('infinite');
    expect(css).not.toContain('parallax');
  });
});
