import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 strategic five-block public entry', () => {
  const layout = read('app/platform-v7/layout.tsx');
  const page = read('app/platform-v7/page.tsx');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const homeCopy = read('i18n/platform-v7-home-v3.ts');
  const storyCopy = read('i18n/platform-v7-home-story.ts');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');
  const storyCss = read('components/platform-v7/PlatformV7StrategicHomeStory.module.css');
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const explorerAdapter = read('components/platform-v7/PublicDealExplorerV4.tsx');
  const support = read('components/platform-v7/ChatSupportWidget.tsx');

  it('renders exactly one narrative route through the five strategic blocks', () => {
    expect(page).toContain('const home = await PlatformV7StrategicHome();');
    expect(home).toContain('styles.problemMap');
    expect(home).toContain("id='deal-path'");
    expect(home).toContain("id='tai'");
    expect(home).toContain("id='participants'");
    expect(home).toContain("id='maturity'");
    expect(home).toContain('<PublicDealRoleScenario locale={locale} />');
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(home).not.toContain("id='money'");
    expect(home).not.toContain("id='integrations'");
    expect(home).not.toContain('pc-v6-faq');
  });

  it('retains the complete 19-stage Deal model and public walkthrough', () => {
    expect(home).toContain("className='pc-v6-lifecycle' role='list' tabIndex={0}");
    expect(homeCopy).toContain("phases: ['Условия', 'Допуск', 'Торги', 'Победитель'");
    expect(storyCopy).toContain("lifecycleLabel: '19 этапов без разрыва между системами'");
    expect(explorerPage).toContain("stage: 'terms'");
    expect(explorerPage).toContain("perspective: 'buyer'");
    expect(home).toContain('stage=terms&lens=execution&perspective=buyer');
  });

  it('preserves browser history, lenses and informational role routing', () => {
    expect(explorerAdapter).toContain('normalizeTourStateFromSearchParams');
    expect(explorerAdapter).toContain("window.addEventListener('popstate', restorePublicHistoryState)");
    expect(explorer).toContain('TOUR_LENSES.map');
    expect(explorer).toContain('TOUR_PERSPECTIVES.map');
    expect(explorer).toContain('TOUR_SCENARIOS.map');
    expect(entryGate).toContain('не влияет на права доступа');
    expect(home).not.toContain('/platform-v7/login?role=');
  });

  it('shows industrial capability without false maturity language', () => {
    const combined = `${page}\n${home}\n${homeCopy}\n${storyCopy}`.toLowerCase();
    for (const token of [
      'production-ready', 'fully live', 'банк подключён', 'фгис подключён',
      'эдо подключён', 'техническая готовность', 'в реализации', 'websocket',
    ]) expect(combined).not.toContain(token);
    expect(storyCopy).toContain('Private cloud и on-premise');
    expect(storyCopy).toContain('Роль, организация, права и контекст определяются сервером');
    expect(storyCopy).toContain('Доказательства и аудит');
    expect(storyCopy).toContain('Зрелость эксплуатации и статусы интеграций подтверждаются только фактическими результатами');
  });

  it('ships explicit RU EN ZH story copy and problem-first hero', () => {
    expect(storyCopy).toContain('const ru: PlatformV7HomeStoryCopy');
    expect(storyCopy).toContain('const en: PlatformV7HomeStoryCopy');
    expect(storyCopy).toContain('const zh: PlatformV7HomeStoryCopy');
    expect(storyCopy).not.toContain('...ru');
    expect(heroCopy).toContain("title: 'The price is agreed. Now the Deal must be executed.'");
    expect(heroCopy).toContain("title: '价格已经确定。现在需要完成交易履约。'");
  });

  it('preserves mobile, touch-target, reduced-motion and support gates', () => {
    expect(layout).toContain('.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}');
    expect(homeCss).toContain('overflow-x: auto');
    expect(homeCss).toContain('@media (max-width: 767px)');
    expect(homeCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(storyCss).toMatch(/@media\s*\(max-width:\s*767px\)/);
    expect(storyCss).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    expect(storyCss).toContain('min-height: 46px !important');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
  });
});
