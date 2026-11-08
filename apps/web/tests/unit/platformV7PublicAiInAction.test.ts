import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public Gekta passport', () => {
  const page = read('app/platform-v7/ai-in-action/page.tsx');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const experience = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');
  const styles = read('components/platform-v7/PublicAiInActionSimpleExperience.module.css');
  const contextual = read('components/platform-v7/ContextualSupportOrAssistant.tsx');
  const government = read('components/platform-v7/PublicGovernmentDataContour.tsx');
  const seo = read('lib/platform-v7/public-seo-routes.json');

  it('publishes one indexable Gekta route in the same public design system', () => {
    expect(page).toContain("data-testid='platform-v7-ai-in-action-authority'");
    expect(page).toContain("canonical: '/platform-v7/ai-in-action'");
    expect(page).toContain("data-ai-experience-route='/platform-v7/ai-in-action'");
    expect(page).toContain('gekta-intelligence-contour-passport');
    expect(page).toContain("className='pc-ppe-page pc-ai-in-action-page'");
    expect(page).toContain('<PublicAiInActionSimpleExperience locale={locale} />');
    expect(page).toContain("name='ai_in_action_opened'");
    expect(page).toContain("import '@/styles/platform-v7-public-intelligence-layer.css'");
    expect(seo).toContain('"path": "/platform-v7/ai-in-action"');
    expect(home).toContain("const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(normalizedLocale)}`;");
    expect(page).toContain("href={`/platform-v7/trust${suffix}`}");
    expect(page).not.toContain("href={`/platform-v7/status${suffix}`}");
  });

  it('implements the ten explanatory sections required by the public positioning', () => {
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

  it('uses human boundaries instead of visitor-facing status codes', () => {
    expect(experience).not.toContain("status: 'NOT_ATTESTED'");
    expect(experience).toContain("hidden aria-hidden='true' data-release-compat='ai-passport'");
    expect(experience).toContain('Гекта не придумывает данные внешней системы, если не получила их из разрешённого источника.');
    expect(experience).toContain('Гекта не назначает роль и не меняет права доступа.');
    expect(experience).toContain('Гекта не подписывает, не отправляет и не выпускает деньги без разрешённого человеческого действия.');
    expect(experience).toContain('Данные государственных личных кабинетов не извлекаются обходным screen scraping.');
    expect(experience).toContain("boundary: 'Проверяемые границы'");
    expect(experience).toContain("title: 'Гекта объясняет, что происходит в Сделке и что делать дальше'");
    expect(experience).not.toContain("title: 'Гекта объясняет состояние Сделки");
    expect(experience).not.toContain('внутренних технических статусов');
    expect(experience).not.toContain('Production остаётся в собственном VPS-контуре платформы');
    expect(experience).not.toContain('Vercel');
    expect(experience).not.toContain('Netlify');
    expect(experience).not.toContain('llama.cpp');
    expect(experience).not.toContain('embeddings');
  });

  it('provides exactly nine public role perspectives without live data or autonomous writes', () => {
    expect(experience).toContain("type RoleKey = 'seller' | 'buyer' | 'logistics' | 'driver' | 'storage' | 'laboratory' | 'surveyor' | 'bank' | 'employee';");
    expect(experience).toContain("const ROLE_ORDER: RoleKey[] = ['seller', 'buyer', 'logistics', 'driver', 'storage', 'laboratory', 'surveyor', 'bank', 'employee'];");
    expect(experience).toContain("employee: { tab: 'Сотрудник платформы'");
    expect(experience).toContain("role='tablist'");
    expect(experience).toContain('aria-selected={role === key}');
    expect(experience).toContain("aria-live='polite'");
    expect(experience).toContain("trackEvent('role_intelligence_opened'");
    expect(experience).not.toContain('fetch(');
    expect(experience).not.toContain('/api/');
    expect(experience).not.toContain('localStorage');
    expect(experience).not.toContain('sessionStorage');
  });

  it('retains fail-closed government source metadata while hiding connection statuses from the visitor presentation', () => {
    expect(government).toContain("status: 'OFFICIAL_ACCESS_REQUIRED'");
    expect(government).toContain("status: 'PUBLIC_REGISTRY'");
    expect(government).not.toContain("status: 'CONNECTED'");
    expect(government).toContain('Текущая проверка не выполнялась');
    expect(government).toContain('Screen scraping запрещён');
    expect(government).toContain('ACCREDITED_OPERATOR_API');
    expect(government).toContain('CONDITIONAL_OFFICIAL_API');
    expect(page).toContain('AI_PUBLIC_CLEANUP_CSS');
    expect(page).toContain('.pc-public-government-source-grid button small');
    expect(page).toContain('.pc-public-government-result-unchecked');
    expect(page).toContain('.pc-public-government-status-button');
    expect(page).toContain('.pc-public-government-result dl > div:has(code)');
    expect(page).toContain('display: none !important');
  });

  it('preserves the unified public AI, support and call dock on the Gekta route', () => {
    expect(contextual).toContain("const AI_IN_ACTION = '/platform-v7/ai-in-action';");
    expect(contextual).toContain('AI_IN_ACTION,');
    expect(contextual).not.toContain('if (path === AI_IN_ACTION) return null;');
    expect(contextual).toContain('{renderDock ? <PublicContactDock /> : null}');
  });

  it('localizes RU EN ZH, registers directly and supports mobile, focus and reduced motion', () => {
    expect(experience).toContain('ru: {');
    expect(experience).toContain('en: {');
    expect(experience).toContain('zh: {');
    expect(experience).toContain('Gekta explains what is happening in the Deal and what comes next');
    expect(experience).toContain('Gekta 解释交易中正在发生什么，以及下一步做什么');
    expect(experience).toContain('const registerHref = `/platform-v7/register${localeSuffix}`;');
    expect(experience).toContain('<a href={registerHref} className={styles.primary}');
    expect(page).toContain("href={`/platform-v7/register${suffix}`}");
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
