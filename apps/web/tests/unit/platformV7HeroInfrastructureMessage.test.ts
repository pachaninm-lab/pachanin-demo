import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 problem-first five-block homepage', () => {
  const component = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const storyCopy = read('i18n/platform-v7-home-story.ts');
  const page = read('app/platform-v7/page.tsx');

  it('opens with a concrete execution problem and a clear resolution', () => {
    expect(heroCopy).toContain("title: 'Цена согласована. Теперь нужно исполнить Сделку.'");
    expect(heroCopy).toContain("accent: '«Прозрачная Цена» доводит её до расчёта.'");
    expect(heroCopy).toContain('показывает блокер, ответственного, доказательства и следующий шаг');
    expect(component).toContain('story.heroMap.items.map');
    expect(component).toContain('styles.problemMap');
    expect(component).toContain('styles.solutionBar');
  });

  it('ships explicit RU EN ZH problem-first copy', () => {
    expect(heroCopy).toContain("const messages: Record<'ru' | 'en' | 'zh'");
    expect(heroCopy).toContain("title: 'The price is agreed. Now the Deal must be executed.'");
    expect(heroCopy).toContain("title: '价格已经确定。现在需要完成交易履约。'");
    expect(storyCopy).toContain('const ru: PlatformV7HomeStoryCopy');
    expect(storyCopy).toContain('const en: PlatformV7HomeStoryCopy');
    expect(storyCopy).toContain('const zh: PlatformV7HomeStoryCopy');
    expect(storyCopy).not.toContain('...ru');
  });

  it('orders the five decisions as problem, process, TAI, role value and maturity', () => {
    const hero = component.indexOf("className={`pc-v6-hero pc-v6-hero-unified ${styles.hero}`}");
    const process = component.indexOf("id='deal-path'");
    const tai = component.indexOf("id='tai'");
    const roles = component.indexOf("id='participants'");
    const maturity = component.indexOf("id='maturity'");
    expect(hero).toBeGreaterThan(-1);
    expect(process).toBeGreaterThan(hero);
    expect(tai).toBeGreaterThan(process);
    expect(roles).toBeGreaterThan(tai);
    expect(maturity).toBeGreaterThan(roles);
  });

  it('keeps TAI as a governed operational layer inside the Deal', () => {
    expect(component).toContain("className={`${styles.aiCockpit} pc-v6-control-tower pc-v6-control-tower-unified`}");
    expect(component).toContain('story.ai.detected');
    expect(component).toContain('story.ai.conclusion');
    expect(component).toContain('story.ai.source');
    expect(component).toContain('story.ai.confidence');
    expect(storyCopy).toContain('Человек подтверждает критическое действие');
    expect(storyCopy).toContain('не подписывает документы и не выпускает деньги сам');
  });

  it('retains critical public layout and accessibility CSS authority', () => {
    expect(page).toContain('CRITICAL_HOME_CSS');
    expect(page).toContain('--entry-public-header-offset');
    expect(page).toContain("html[data-p7-language='zh']");
    expect(page).toContain('@media (max-width: 767px)');
    expect(page).toContain('@media (max-width: 359px)');
  });
});
