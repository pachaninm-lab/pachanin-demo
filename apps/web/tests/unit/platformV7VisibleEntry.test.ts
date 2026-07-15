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
const approvedHeaderLogo = () => readFileSync(resolve(__dirname, '../../components/v7r/ApprovedHeaderLogo.tsx'), 'utf8');
const canonicalLogoAsset = () => readFileSync(resolve(__dirname, '../../components/v7r/canonical-logo-png.ts'), 'utf8');
const canonicalLogoRoute = () => readFileSync(resolve(__dirname, '../../app/icon/brand-primary/route.ts'), 'utf8');
const brandMark = () => readFileSync(resolve(__dirname, '../../components/v7r/BrandMark.tsx'), 'utf8');
const support = () => readFileSync(resolve(__dirname, '../../components/platform-v7/ChatSupportWidget.tsx'), 'utf8');
const css = () => readFileSync(resolve(__dirname, '../../styles/platform-v7-public-product-experience-v5.css'), 'utf8');

function compact(source: string) {
  return source.replace(/\s+/g, ' ');
}

function canonicalLogoBinary() {
  const arrayBody = canonicalLogoAsset().match(/BRAND_LOGO_PNG_BASE64_CHUNKS = \[([\s\S]*?)\]/)?.[1] ?? '';
  const encoded = Array.from(arrayBody.matchAll(/'([^']+)'/g), (match) => match[1]).join('');
  return Buffer.from(encoded, 'base64');
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

  it('renders the exact owner reference logo in every platform header', () => {
    const approved = approvedHeaderLogo();
    const asset = canonicalLogoAsset();
    const route = canonicalLogoRoute();
    const mark = brandMark();
    const binary = canonicalLogoBinary();

    expect(approved).toContain("const CANONICAL_LOGO_SRC = '/icon/brand-primary?v=267b9bbb'");
    expect(approved).toContain('src={CANONICAL_LOGO_SRC}');
    expect(approved).toContain("width='128'");
    expect(approved).toContain("height='128'");
    expect(approved).toContain("className='header-logo-image'");
    expect(approved).toContain("fetchPriority='high'");
    expect(approved).not.toContain('data:image');

    expect(asset).toContain("BRAND_LOGO_PNG_SHA256 = '267b9bbbf88f4d61209b7f69f6f4ba2632134d67f19022b761908cffd57dcfa2'");
    expect(asset).not.toContain('data:image/webp');
    expect(binary).toHaveLength(4855);
    expect(binary.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(binary.readUInt32BE(16)).toBe(128);
    expect(binary.readUInt32BE(20)).toBe(128);
    expect(createHash('sha256').update(binary).digest('hex')).toBe('267b9bbbf88f4d61209b7f69f6f4ba2632134d67f19022b761908cffd57dcfa2');

    expect(route).toContain("from '@/components/v7r/canonical-logo-png'");
    expect(route).toContain("'Content-Type': 'image/png'");
    expect(route).toContain("'Cache-Control': 'public, max-age=31536000, immutable'");
    expect(route).toContain('Canonical brand logo integrity check failed.');

    expect(mark).toContain("import ApprovedHeaderLogo from './ApprovedHeaderLogo'");
    expect(mark).toContain('<ApprovedHeaderLogo />');
    expect(mark).toContain("data-approved-brand-mark='owner-login-header-pixel-exact'");
    expect(mark).not.toContain('BRAND_LOGO_DATA_URI');
    expect(mark).not.toContain('brand-logo-asset');

    for (const [name, source] of [
      ['public', publicHeader()],
      ['cabinet', cabinetShell()],
      ['staff', staffShell()],
      ['loading', loadingHeader()],
    ] as const) {
      expect(source, `${name} header must render the shared BrandMark`).toContain('BrandMark');
    }

    expect(contactHeader()).toContain('PublicSiteHeader');
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
