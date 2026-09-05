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
    const firstHero = home.slice(home.indexOf("className={`pc-v6-hero"), home.indexOf("id='participants'"));
    expect(firstHero.match(/className='pc-v6-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='registration_open'");
    expect(firstHero).toContain('href={registerHref}');
    expect(firstHero).toContain("href='#live'");
    expect(firstHero).toContain("href='/downloads/prozrachnaya-tsena-presentation.pdf'");
  });

  it('places role value and ordinary Deal understanding before the Gekta detail layer', () => {
    const roles = home.indexOf("id='participants'");
    const path = home.indexOf("id='deal-path'");
    const tai = home.indexOf("id='tai'");
    expect(roles).toBeGreaterThan(-1);
    expect(path).toBeGreaterThan(roles);
    expect(tai).toBeGreaterThan(path);
    expect(home).toContain("const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(normalizedLocale)}`;");
    expect(storyCopy).toContain('Гекта');
    expect(storyCopy).toContain('Критические решения подтверждает уполномоченный участник.');
  });

  it('uses the same nine public perspectives on the Gekta explanation page', () => {
    expect(aiExperience).toContain("type RoleKey = 'seller' | 'buyer' | 'logistics' | 'driver' | 'storage' | 'laboratory' | 'surveyor' | 'bank' | 'employee';");
    expect(aiExperience).toContain("title: 'Одна Сделка — девять понятных рабочих перспектив'");
    expect(aiExperience).not.toContain("status: 'NOT_ATTESTED'");
    expect(aiExperience).toContain('Неподключённый источник не показывается подключённым');
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
