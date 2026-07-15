import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
const explorerSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/how-it-works/page.tsx'), 'utf8');
const productCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-product-experience-v4.ts'), 'utf8');
const loginCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-login-copy.ts'), 'utf8');
const publicHeader = () => readFileSync(resolve(__dirname, '../../components/platform-v7/PublicSiteHeader.tsx'), 'utf8');
const support = () => readFileSync(resolve(__dirname, '../../components/platform-v7/ChatSupportWidget.tsx'), 'utf8');
const css = () => readFileSync(resolve(__dirname, '../../styles/platform-v7-public-product-experience-v5.css'), 'utf8');

describe('platform-v7 visible public entry', () => {
  it('front-loads the user task and keeps two deliberate actions', () => {
    const page = pageSource();
    const copy = productCopy();

    expect(copy).toContain("title: 'Сделка под контролем — от условий до расчёта'");
    expect(copy).toContain('ответственный, следующее действие и причина блокировки');
    expect(page).toContain("className='pc-ppe-primary-button'");
    expect(page).toContain("className='pc-ppe-secondary-button'");
    expect(copy).toContain('Разобрать демонстрационную сделку');
    expect(copy).toContain('Подключить организацию');
  });

  it('uses service navigation and an accessible support dialog', () => {
    const page = pageSource();
    const header = publicHeader();
    const widget = support();

    expect(page).toContain('nav={nav}');
    expect(page).toContain('showMobileMenu');
    expect(header).toContain('nav && showMobileMenu');
    expect(widget).toContain("role='dialog'");
    expect(widget).toContain("aria-modal='true'");
    expect(widget).toContain("event.key === 'Escape'");
    expect(widget).toContain('triggerRef.current?.focus()');
    expect(css()).toContain('right: max(14px');
    expect(css()).not.toContain('right: -5px');
  });

  it('uses descriptive access labels without client-selected authority', () => {
    const page = pageSource();
    const login = loginCopy();

    expect(page).toContain("href='/platform-v7/login'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(login).toContain('Восстановить доступ');
  });

  it('states the demonstration and maturity boundary instead of simulating live operation', () => {
    const joined = [pageSource(), explorerSource(), productCopy()].join('\n').toLowerCase();

    expect(joined).toContain('демонстрационная сделка');
    expect(joined).toContain('не содержит реальных сделок');
    expect(joined).toContain('controlled pilot / pre-integration');
    expect(joined).toContain('не выполняет денежные операции');
    expect(joined).not.toContain('deal-2408');
    expect(joined).not.toMatch(/production-ready|fully live|fully integrated|bank connected|fgis connected|edo connected/i);
  });

  it('keeps public copy free of synthetic marketing language', () => {
    const joined = [pageSource(), explorerSource(), productCopy()].join('\n').toLowerCase();

    for (const phrase of [
      'революционный',
      'инновационный',
      'нового поколения',
      'уникальная экосистема',
      'бесшовный опыт',
      'на базе искусственного интеллекта',
      'каждый шаг под контролем',
      'всё в одном месте',
    ]) {
      expect(joined).not.toContain(phrase);
    }
  });
});
