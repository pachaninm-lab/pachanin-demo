import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 TAI demonstration and twelve-role value scenario', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const roleScenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const roleCss = read('components/platform-v7/PublicDealRoleScenario.module.css');
  const storyCopy = read('i18n/platform-v7-home-story.ts');
  const head = read('app/platform-v7/head.tsx');

  it('covers all twelve platform roles without client-authoritative access', () => {
    for (const key of [
      'seller', 'buyer', 'logistics', 'driver', 'storage', 'laboratory',
      'surveyor', 'bank', 'operator', 'compliance', 'arbitrator', 'executive',
    ]) expect(roleScenario).toContain(`| '${key}'`);
    expect(roleScenario).toContain("role='tablist'");
    expect(roleScenario).toContain("role='tabpanel'");
    expect(roleScenario).toContain('aria-selected={role === key}');
    expect(roleScenario).toContain('Переключение не открывает данные и не меняет права');
    expect(roleScenario).not.toContain('accessToken');
    expect(roleScenario).not.toContain('tenantId');
    expect(roleScenario).not.toContain('fetch(');
  });

  it('keeps one dominant hero conversion before the explanatory blocks', () => {
    const firstHero = home.slice(home.indexOf("className={`pc-v6-hero"), home.indexOf("id='deal-path'"));
    expect(firstHero.match(/className='pc-v6-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='hero_primary_cta'");
    expect(firstHero).toContain('styles.problemMap');
    expect(firstHero).not.toContain('pc-v6-control-tower');
  });

  it('places a structured TAI analysis before the role scenario', () => {
    const tai = home.indexOf("id='tai'");
    const roles = home.indexOf("id='participants'");
    expect(tai).toBeGreaterThan(-1);
    expect(roles).toBeGreaterThan(tai);
    expect(home).toContain('TAI · Transparent Agro Intelligence');
    expect(home).toContain("params={{ source: 'structured_ai_analysis' }}");
    expect(home).toContain("const taiHref = `/platform-v7/ai-in-action");
  });

  it('avoids unverified scale, partner and connectivity claims', () => {
    const combined = `${home}\n${roleScenario}\n${storyCopy}\n${head}`.toLowerCase();
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
