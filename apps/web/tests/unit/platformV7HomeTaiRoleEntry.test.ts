import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 Gekta and nine-role public value scenario', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const roleScenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const roleCss = read('components/platform-v7/PublicDealRoleScenario.module.css');
  const storyCopy = read('i18n/platform-v7-home-story-product.ts');
  const aiExperience = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');

  it('covers exactly nine public roles without granting access authority', () => {
    for (const key of ['seller', 'buyer', 'logistics', 'driver', 'storage', 'laboratory', 'surveyor', 'bank', 'employee']) {
      expect(roleScenario).toContain(`| '${key}'`);
    }
    for (const retiredPublicKey of ['operator', 'compliance', 'arbitrator', 'executive']) {
      expect(roleScenario).not.toContain(`| '${retiredPublicKey}'`);
    }
    expect(roleScenario).toContain("role='tablist'");
    expect(roleScenario).toContain("role='tabpanel'");
    expect(roleScenario).toContain('aria-selected={role === key}');
    expect(roleScenario).toContain('реальные полномочия определяются системой после регистрации и проверки организации');
    expect(roleScenario).not.toContain('accessToken');
    expect(roleScenario).not.toContain('tenantId');
    expect(roleScenario).not.toContain('fetch(');
  });

  it('keeps registration as the only primary hero conversion', () => {
    const firstHero = home.slice(home.indexOf("className='pc-final-hero'"), home.indexOf('<PublicMarketTeaser'));
    expect(firstHero.match(/className='pc-final-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='registration_open'");
    expect(firstHero).toContain("href={registerHref(locale, 'sell')}");
    expect(firstHero).toContain("href={registerHref(locale, 'buy')}");
    expect(firstHero).toContain("href='#participants'");
  });

  it('places role value and ordinary Deal understanding before the Gekta detail layer', () => {
    const roles = home.indexOf("id='participants'");
    const path = home.indexOf("id='how-it-works'");
    const tai = home.indexOf("id='gekta'");
    expect(roles).toBeGreaterThan(-1);
    expect(path).toBeGreaterThan(-1);
    expect(roles).toBeGreaterThan(path);
    expect(tai).toBeGreaterThan(roles);
    expect(home).toContain('href={aiInActionHref}');
    expect(home).toContain('/platform-v7/ai-in-action?lang=');
    expect(storyCopy).toContain('Гекта');
    expect(storyCopy).toContain('Критические решения подтверждает уполномоченный участник.');
  });

  it('uses the same nine public perspectives on the Gekta explanation page', () => {
    for (const label of ['Сотрудник подключённой организации', 'Employee of a connected organisation', '已接入机构员工']) expect(aiExperience).toContain(label);
    for (const retiredLabel of ['Сотрудник платформы', 'Platform employee', '平台员工']) expect(aiExperience).not.toContain(retiredLabel);
    expect(aiExperience).toContain("type RoleKey = 'seller' | 'buyer' | 'logistics' | 'driver' | 'storage' | 'laboratory' | 'surveyor' | 'bank' | 'employee';");
    expect(aiExperience).toContain("title: 'Одна Сделка — девять понятных рабочих перспектив'");
    expect(aiExperience).not.toContain("status: 'NOT_ATTESTED'");
    expect(aiExperience).toContain('Гекта не придумывает данные внешней системы, если не получила их из разрешённого источника.');
    expect(aiExperience).not.toContain('Неподключённый источник не показывается подключённым');
  });

  it('makes the Gekta role selector keyboard complete and panel-linked', () => {
    expect(aiExperience).toContain("aria-orientation='horizontal'");
    expect(aiExperience).toContain('tabIndex={role === key ? 0 : -1}');
    expect(aiExperience).toContain('aria-labelledby={`pc-ai-role-tab-${role}`}');
    expect(aiExperience).toContain("id={`pc-ai-role-tab-${key}`}");
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      expect(aiExperience).toContain(`case '${key}':`);
    }
    expect(aiExperience).toContain("querySelectorAll<HTMLButtonElement>('[role=\"tab\"]')");
    expect(aiExperience).toContain('event.preventDefault()');
    expect(aiExperience).toContain("activateRole(nextRole, 'keyboard')");
    expect(aiExperience).toContain('tabs?.[nextIndex]?.focus()');
  });

  it('avoids unverified scale, partner and connectivity claims', () => {
    const combined = `${home}\n${roleScenario}\n${storyCopy}\n${aiExperience}`.toLowerCase();
    for (const phrase of [
      '35 регионов', '12 млн тонн', '20 000 перевозчиков',
      'банк подключён', 'фгис подключён', 'эдо подключён', 'боевой контур',
      'production-ready', 'fully live',
    ]) expect(combined).not.toContain(phrase);
  });

  it('preserves mobile role navigation, touch targets and reduced motion', () => {
    expect(roleCss).toMatch(/min-height:\s*44px/);
    expect(roleCss).toMatch(/overflow-x:\s*auto/);
    expect(roleCss).toMatch(/scroll-snap-type:\s*x\s+(?:proximity|mandatory)/);
    expect(roleCss).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
