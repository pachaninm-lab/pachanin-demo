import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
const explorerSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/how-it-works/page.tsx'), 'utf8');
const productCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-product-experience-v4.ts'), 'utf8');
const loginCopy = () => readFileSync(resolve(__dirname, '../../i18n/public-login-copy.ts'), 'utf8');
const publicHeader = () => readFileSync(resolve(__dirname, '../../components/platform-v7/PublicSiteHeader.tsx'), 'utf8');
const localeSwitch = () => readFileSync(resolve(__dirname, '../../components/platform-v7/PublicLocaleSwitch.tsx'), 'utf8');
const cabinetShell = () => readFileSync(resolve(__dirname, '../../components/v7r/AppShellV4.tsx'), 'utf8');
const staffShell = () => readFileSync(resolve(__dirname, '../../components/platform-v7/staff/StaffPlatformShell.tsx'), 'utf8');
const loadingHeader = () => readFileSync(resolve(__dirname, '../../app/platform-v7/loading.tsx'), 'utf8');
const contactHeader = () => readFileSync(resolve(__dirname, '../../components/platform-v7/ContactFixedHeader.tsx'), 'utf8');
const webBrandAsset = () => readFileSync(resolve(__dirname, '../../components/v7r/brand-logo-asset.ts'), 'utf8');
const landingBrandAsset = () => readFileSync(resolve(__dirname, '../../../landing/app/components/HeaderLogo.tsx'), 'utf8');
const support = () => readFileSync(resolve(__dirname, '../../components/platform-v7/ChatSupportWidget.tsx'), 'utf8');
const css = () => readFileSync(resolve(__dirname, '../../styles/platform-v7-public-product-experience-v5.css'), 'utf8');

function compact(source: string) {
  return source.replace(/\s+/g, ' ');
}

function extractWebpDataUri(source: string) {
  const match = source.match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/);
  expect(match, 'canonical WebP brand asset must exist').not.toBeNull();
  return match?.[0] ?? '';
}

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

  it('uses the byte-identical approved PC logo in landing, public, cabinet, staff and loading headers', () => {
    const approvedLandingUri = extractWebpDataUri(landingBrandAsset());
    const platformUri = extractWebpDataUri(webBrandAsset());
    const binary = Buffer.from(platformUri.slice(platformUri.indexOf(',') + 1), 'base64');

    expect(platformUri).toBe(approvedLandingUri);
    expect(binary).toHaveLength(1804);
    expect(createHash('sha256').update(binary).digest('hex')).toBe('377276d5d6dcf7421c908569f6a58c23c3f0f24f521da9b8cd8c4dda6d899303');

    for (const [name, source] of [
      ['public', publicHeader()],
      ['cabinet', cabinetShell()],
      ['staff', staffShell()],
      ['loading', loadingHeader()],
    ] as const) {
      expect(source, `${name} header must render the shared BrandMark`).toContain('BrandMark');
    }

    expect(contactHeader()).toContain('PublicSiteHeader');
    expect(webBrandAsset()).not.toContain('UklGRqgL');
  });

  it('uses one visual contract for every public-header control', () => {
    const header = compact(publicHeader());
    const language = localeSwitch();

    expect(header).toContain("import { BrandMark } from '@/components/v7r/BrandMark'");
    expect(header).toContain("data-brand-mark='transparent-price-canonical'");
    expect(header).toContain('<BrandMark size={40} />');
    expect(header).not.toMatch(/<img[^>]+(?:logo|brand)/i);

    expect(language).toContain("className='pc-site-locale-switch'");
    expect(header).toContain('--pc-site-control-height: 44px');
    expect(header).toContain('--pc-site-control-radius: 11px');
    expect(header).toContain('.pc-site-mobile-menu > summary, .pc-site-header .pc-site-locale-switch, .pc-site-header .entry-login, .pc-site-header .pc-site-action');
    expect(header).toContain('height: var(--pc-site-control-height)');
    expect(header).toContain('border: 1px solid var(--pc-site-control-border)');
    expect(header).toContain('border-radius: var(--pc-site-control-radius)');
    expect(header).toContain('background: var(--pc-site-control-background)');
    expect(header).not.toContain('.pc-site-locale-switch { min-width: 54px; gap: 5px; padding: 0 10px; color: #087a3b;');
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
