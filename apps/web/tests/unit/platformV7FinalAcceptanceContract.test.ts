import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { getLocale } from 'next-intl/server';
import RegisterPage from '../../app/platform-v7/register/page';
import TrustPage from '../../app/platform-v7/trust/page';
import { ContactClient } from '../../app/platform-v7/contact/ContactClient';
import { PublicHeaderInteractions } from '../../components/platform-v7/PublicHeaderInteractions';
import { RegisterFormClientPublic } from '../../app/platform-v7/register/RegisterFormClientPublic';
import {
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalPublicHeader,
  CanonicalStateLens,
  canonicalPublicNavigationPath,
} from '../../components/platform-v7/PublicCanonicalPrimitives';

vi.mock('next-intl/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next-intl/server')>(),
  getLocale: vi.fn().mockResolvedValue('ru'),
}));

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const config = read('apps/web/playwright.acceptance.config.ts');
const spec = read('apps/web/tests/e2e/platform-v7-design-system-v8-acceptance.spec.ts');
const workflow = read('.github/workflows/platform-v7-design-system-v8-acceptance.yml');
const report = read('docs/platform-v7/qa/DESIGN_SYSTEM_V8_FINAL_ACCEPTANCE.md');
const acceptanceLogin = read('apps/web/tests/e2e/support/acceptance-login.ts');
const registrationPage = read('apps/web/app/platform-v7/register/page.tsx');
const registrationLayout = read('apps/web/app/platform-v7/register/layout.tsx');
const registrationClient = read('apps/web/app/platform-v7/register/RegisterFormClientPublic.tsx');
const registrationBaseClient = read('apps/web/app/platform-v7/register/RegisterFormClient.tsx');
const registrationRoute = read('apps/web/app/api/auth/register/route.ts');
const registrationResendRoute = read('apps/web/app/api/auth/registration/resend/route.ts');
const registrationUxSpec = read('apps/web/tests/e2e/platform-v7-registration-official.spec.ts');
const passwordPolicy = read('apps/api/src/common/validators/strong-password.validator.ts');

describe('platform-v7 Design System v8 final acceptance contract', () => {
  it('defines Chromium, WebKit, desktop, iPhone and Android projects', () => {
    for (const project of ['desktop-chromium', 'desktop-webkit', 'android-chromium', 'iphone-webkit']) {
      expect(config).toContain(`name: '${project}'`);
    }
    expect(config).toContain("devices['Desktop Chrome']");
    expect(config).toContain("devices['Desktop Safari']");
    expect(config).toContain("devices['Pixel 5']");
    expect(config).toContain("devices['iPhone 13']");
    // The acceptance matrix no longer serves the build with `pnpm start`; it
    // runs a dedicated HTTPS server in front of the same production bundle,
    // which is closer to production, not further from it. The property that
    // matters - that a production bundle is what gets tested - is asserted
    // against the workflow below, where the build step lives.
    expect(config).toContain('webServer');
    expect(config).toContain('acceptance-https-server.mjs');
    expect(config).not.toContain("command: 'pnpm dev'");
  });

  /**
   * This demanded that the acceptance suite forge its own cabinet session with
   * signCabinetSession. That is no longer how it authenticates, and the change
   * was an upgrade: the suite drives the ordinary login route, so the server
   * verifies the password and issues the cabinet cookie through exactly the code
   * production runs. A test that mints its own session proves the layout accepts
   * what the test minted; this one proves the real path works.
   *
   * Restoring the old assertion would demand the weaker method back, so the
   * contract is asserted instead - real login in, and no forged session - and it
   * is now also load-bearing for #4785: a hand-made cabinet cookie would have to
   * carry the type and audience the reader requires, and the suite makes none.
   */
  it('authenticates every protected role through the real login route, not a forged session', () => {
    expect(spec).toContain('loginAs(page');
    expect(spec).not.toContain('signCabinetSession');
    expect(acceptanceLogin).toContain("post('/api/auth/login'");
    expect(acceptanceLogin).not.toContain('signCabinetSession');
    for (const role of [
      'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
      'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
    ]) {
      expect(spec).toContain(`['${role}', '/platform-v7/`);
    }
    expect(spec).toContain("page.goto('about:blank'");
    expect(spec.indexOf("page.goto('about:blank'")).toBeLessThan(spec.indexOf('page.context().clearCookies()'));
    expect(spec).not.toContain('pc-role');
    expect(spec).not.toContain('localStorage');
  });

  it('enforces accessibility, media, localization, hydration and layout stability', () => {
    expect(spec).toContain('AxeBuilder');
    expect(spec).toContain("withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])");
    expect(spec).toContain("forcedColors: 'active'");
    expect(spec).toContain("reducedMotion: 'reduce'");
    expect(spec).toContain("['ru', 'en', 'zh']");
    expect(spec).toContain('failed to hydrate');
    expect(spec).toContain('__pcV8LayoutShift');
    expect(spec).toContain('toBeLessThanOrEqual(0.1)');
    expect(spec).toContain("headerPosition).toBe('fixed')");
    expect(spec).toContain("navPosition).toBe('fixed')");
  });

  it('builds the production bundle and stores machine-readable browser evidence', () => {
    expect(workflow).toMatch(/playwright install --with-deps [^\n]*chromium/u);
    expect(workflow).toMatch(/playwright install --with-deps [^\n]*webkit/u);
    expect(workflow).toContain('pnpm --filter @pc/web build');
    expect(workflow).toContain('playwright.acceptance.config.ts');
    expect(workflow).toContain('design-system-v8-acceptance-results.json');
    expect(workflow).toContain('upload-artifact@v4');
  });

  it('keeps architecture completion separate from production and external-integration proof', () => {
    expect(report).toContain('protected-legacy=0');
    expect(report).toContain('не доказывает');
    expect(report).toContain('production и live-внешние интеграции подтверждены');
    expect(report).toContain('browser-accessibility matrix');
  });

  it('binds public registration to official human wording and the real visual acceptance matrix', () => {
    expect(config).toContain('registration-official');
    expect(registrationUxSpec).toContain('320, 375, 390, 430, 768, 1280');
    expect(registrationUxSpec).toContain('AxeBuilder');
    expect(registrationUxSpec).toContain('box.width >= 44 && box.height >= 44');
    expect(registrationPage).toContain('Подключение организации');
    expect(registrationPage).toContain('После проверки заявки мы сообщим о доступе');
    expect(registrationPage).not.toContain('P0 · Первый клиентский доступ');
    expect(registrationPage).not.toContain('доступ назначается сервером');
    expect(registrationLayout).toContain('return children;');
    expect(registrationLayout).not.toContain('RegisterCleanClient');
    expect(registrationClient).not.toContain("'Рабочее пространство'");
    expect(registrationClient).not.toContain('correlation ID');
    expect(registrationClient).not.toContain('Рабочий email');
    expect(registrationClient).toContain('Номер обращения:');
    expect(registrationClient).toContain('Адрес электронной почты *');
    expect(registrationClient).toContain("['employee', 'Сотрудник подключённой организации']");
    expect(registrationClient).toContain('Новая организация при этом не создаётся.');
  });

  it('prefills only a bounded public participation class without granting role authority', () => {
    expect(registrationPage).toContain("type PublicRegistrationIntent = 'sell' | 'buy' | 'execution' | 'finance'");
    expect(registrationPage).toContain("sell: 'seller'");
    expect(registrationPage).toContain("buy: 'buyer'");
    expect(registrationPage).toContain("execution: 'logistics'");
    expect(registrationPage).toContain("finance: 'bank'");
    expect(registrationPage).toContain("if (intent) query.set('intent', intent)");
    expect(registrationPage).toContain("className='pc-site-locale-cluster'");
    expect(registrationPage).toContain('initialWorkspace={initialWorkspace}');
    expect(registrationClient).toContain("React.useState<RegistrationWorkspace>(initialWorkspace || 'seller')");
    expect(registrationBaseClient).toContain("defaultValue={initialWorkspace || 'seller'}");
    expect(registrationClient).toContain("event.target.value as RegistrationWorkspace");
    expect(registrationClient).not.toContain('requestedRole');
    expect(registrationBaseClient).not.toContain('requestedRole');
  });

  it('keeps RU EN ZH registration copy human-facing and hides internal status vocabulary', () => {
    for (const forbidden of ["workspace: 'Workspace'", "workspace: '工作空间'", 'correlation ID']) {
      expect(registrationBaseClient).not.toContain(forbidden);
    }
    expect(registrationBaseClient).toContain("reference: 'Request reference'");
    expect(registrationBaseClient).toContain("reference: '申请查询编号'");
    expect(registrationBaseClient).toContain('copy.statusLabels[statusCode] || copy.statusUpdating');
    expect(registrationBaseClient).toContain('copy.nextLabels[nextCode] || copy.waitForUpdate');
    expect(registrationBaseClient).not.toContain('copy.statusLabels[statusCode] || statusCode');
    expect(registrationBaseClient).not.toContain('copy.nextLabels[nextCode] || nextCode');
    expect(registrationBaseClient).toContain("name='confirmPassword'");
    expect(registrationBaseClient).toContain("password !== field(form, 'confirmPassword')");
  });

  it('keeps registration authority unchanged while making password and mail instructions truthful', () => {
    expect(passwordPolicy).toContain('MIN_PASSWORD_LENGTH = 12');
    expect(passwordPolicy).toContain('MAX_PASSWORD_LENGTH = 128');
    expect(passwordPolicy).toContain('classes < 3');
    expect(registrationClient).toContain('12–128 символов');
    expect(registrationClient).toContain('как минимум три группы');
    expect(registrationClient).toContain("name='confirmPassword'");
    expect(registrationClient).toContain("password !== field(form, 'confirmPassword')");
    for (const marker of [
      "fetch('/api/auth/register'",
      "fetch('/api/auth/registration/resend'",
      "fetch('/api/auth/registration/verify'",
      "fetch('/api/auth/registration/additional-information'",
      '/api/auth/registration/status?token=',
      'idempotency-key',
      'applyCsrfHeader',
      "termsVersion: '2026-09-03'",
      "privacyVersion: '2026-09-03'",
    ]) expect(registrationClient).toContain(marker);
    expect(registrationClient).not.toContain('role:');
    expect(registrationClient).not.toContain('requestedRole');
    expect(registrationClient).not.toContain('/platform-v7/onboarding');
    expect(registrationBaseClient).toContain("fetch('/api/auth/register'");
    for (const route of [registrationRoute, registrationResendRoute]) {
      expect(route).toContain('подтвердите адрес электронной почты');
      expect(route).not.toContain('подтвердите email');
      expect(route).not.toContain('Открой одноразовую ссылку');
    }
  });
});


function elements(node: ReactNode): Array<React.ReactElement<Record<string, any>>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, any>>(node)) return [];
  return [node, ...elements(node.props.children)];
}

describe('public registration intent and locale behaviour', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const [intent, workspace] of [['sell', 'seller'], ['buy', 'buyer'], ['execution', 'logistics'], ['finance', 'bank']] as const) {
      it(`${locale}: ${intent} reaches the actual form and survives locale change without new authority`, async () => {
        const tree = await RegisterPage({ searchParams: Promise.resolve({ lang: locale, intent, verify: 'token-v', statusToken: 'token-s', role: 'PLATFORM_OWNER', tenantId: 'untrusted' }) });
        const all = elements(tree);
        const form = all.find((node) => node.type === RegisterFormClientPublic)!;
        expect(form).toBeDefined();
        expect(form.props).toMatchObject({ locale, initialWorkspace: workspace, verifyToken: 'token-v', initialStatusToken: 'token-s' });
        expect(form.props).not.toHaveProperty('role');
        expect(form.props).not.toHaveProperty('tenantId');
        const header = all.find((node) => node.props.localeControl)!;
        const control = header.props.localeControl as React.ReactElement<Record<string, any>>;
        const localeLinks = elements(control).filter((node) => typeof node.props.href === 'string');
        expect(localeLinks).toHaveLength(3);
        const nextLocale = locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
        const link = localeLinks.find((node) => new URL(node.props.href, 'https://example.invalid').searchParams.get('lang') === nextLocale)!;
        expect(link).toBeDefined();
        const query = new URL(link.props.href, 'https://example.invalid').searchParams;
        expect(query.get('intent')).toBe(intent);
        expect(query.get('verify')).toBe('token-v');
        expect(query.get('statusToken')).toBe('token-s');
        expect(query.get('lang')).toBe(nextLocale);
        expect(query.has('role')).toBe(false);
        expect(query.has('tenantId')).toBe(false);
        const html = renderToStaticMarkup(createElement(RegisterFormClientPublic, { locale, initialWorkspace: workspace }));
        expect(html).toMatch(new RegExp(`<option[^>]*value="${workspace}"[^>]*selected=""`));
      });
    }
  }
  it.each(['owner', '__proto__', 'constructor', '<script>', 'BUY'])('rejects unknown intent %s', async (intent) => {
    const all = elements(await RegisterPage({ searchParams: Promise.resolve({ intent }) }));
    expect(all.find((node) => node.type === RegisterFormClientPublic)!.props.initialWorkspace).toBeUndefined();
    const control = all.find((node) => node.props.localeControl)!.props.localeControl as React.ReactElement<Record<string, any>>;
    const localeLinks = elements(control).filter((node) => typeof node.props.href === 'string');
    expect(localeLinks).toHaveLength(3);
    for (const link of localeLinks) expect(link.props.href).not.toContain('intent=');
  });
});

// Owner's public-corrections TZ, 2026-09-22: assert rendered behaviour,
// not only the legacy route keys stored in the navigation arrays.
describe('public application navigation and explanatory Deal states', () => {
  const labels = {
    ru: ['Главная', 'Рынок', 'Заявка', 'Сделка', 'Войти'],
    en: ['Home', 'Market', 'Apply', 'Deal', 'Sign in'],
    zh: ['首页', '市场', '申请', '交易', '登录'],
  } as const;
  const applicationNames = {
    ru: 'Подать заявку на подключение',
    en: 'Apply for platform access',
    zh: '申请接入平台',
  } as const;

  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const active of ['/platform-v7/how-it-works', '/platform-v7/deal-flow']) {
      it(`${locale}: ${active} has one shared Deal destination and active group`, () => {
        const tree = CanonicalBottomNav({ locale, active });
        const links = elements(tree).filter((node) => node.type === 'a');
        expect(links).toHaveLength(5);
        expect(links.map((link) => elements(link).find((node) => node.type === 'span')!.props.children)).toEqual(labels[locale]);
        expect(links[2]!.props['aria-label']).toBe(applicationNames[locale]);
        expect(links[2]!.props.href).toBe(`/platform-v7/register?lang=${locale}`);
        expect(links[3]!.props.href).toBe(`/platform-v7/how-it-works?lang=${locale}`);
        expect(links.filter((link) => link.props['data-active'] === 'true')).toEqual([links[3]]);
        expect(links[3]!.props['aria-current']).toBe(active.endsWith('/how-it-works') ? 'page' : 'true');
        for (const link of links) expect(new URL(link.props.href, 'https://example.invalid').searchParams.get('lang')).toBe(locale);
        const header = CanonicalPublicHeader({ locale, activePath: active });
        const headerLinks = elements(header.props.nav).filter((node) => node.type === 'a');
        expect(headerLinks.filter((link) => link.props['data-active'] === 'true')).toHaveLength(1);
        expect(headerLinks.find((link) => link.props['data-active'] === 'true')!.props.href).toBe(links[3]!.props.href);
        const criticalCss = elements(tree).find((node) => node.type === 'style')!.props.children;
        expect(criticalCss).not.toContain('text-overflow:ellipsis');
        expect(criticalCss).not.toContain('white-space:nowrap');
        expect(criticalCss).toContain('overflow-wrap:anywhere');
        expect(criticalCss).toContain('min-height:50px');
      });
    }
    it(`${locale}: an unbound public spine never invents a current or completed stage`, () => {
      const stages = elements(CanonicalDealSpine({ locale })).filter((node) => node.props.role === 'listitem');
      expect(stages).toHaveLength(7);
      for (const stage of stages) {
        expect(stage.props['data-state']).toBe('unknown');
        expect(stage.props['aria-current']).toBeUndefined();
      }
    });
    it(`${locale}: a real explicit current stage still renders from its supplied index`, () => {
      const stages = elements(CanonicalDealSpine({ locale, currentIndex: 4 })).filter((node) => node.props.role === 'listitem');
      expect(stages.map((stage) => stage.props['data-state'])).toEqual(['done', 'done', 'done', 'done', 'current', 'pending', 'pending']);
      expect(stages.filter((stage) => stage.props['aria-current'] === 'step')).toHaveLength(1);
    });
    it(`${locale}: an explanation is a legend, while a missing live status still warns`, () => {
      const props = { locale, happened: 'Event description', actor: 'Task owner', basis: 'Document', settlement: 'Payment terms', next: 'Next task' };
      const explanation = renderToStaticMarkup(createElement(CanonicalStateLens, { ...props, state: 'normal', presentation: 'explanation' }));
      expect(explanation).not.toContain('data-canonical-state="unconfirmed"');
      expect(explanation).not.toContain('data-active="true"');
      expect(explanation).not.toContain('<button');
      const live = renderToStaticMarkup(createElement(CanonicalStateLens, { ...props, state: null }));
      expect(live).toContain('data-canonical-state="unconfirmed"');
    });
  }

  it('does not alias protected Deal or unrelated routes into public navigation', () => {
    expect(canonicalPublicNavigationPath(undefined)).toBeUndefined();
    for (const route of ['/platform-v7/deals/private/execution', '/platform-v7/register', '/platform-v7/market', '/platform-v7/deal-flow-extra']) {
      expect(canonicalPublicNavigationPath(route)).toBe(route);
    }
  });

  it('removes hard-coded public progress and internal copy from the Deal explanation', () => {
    const source = read('apps/web/app/platform-v7/deal-flow/page.tsx');
    expect(source).toContain('currentIndex={null}');
    expect(source).toContain("presentation='explanation'");
    for (const text of ['currentIndex={4}', "?'В работе'", 'production-данных', 'серверного контекста', 'финансовое событие на клиенте']) {
      expect(source).not.toContain(text);
    }
  });
});

describe('public Trust explains checks without claiming they have happened', () => {
  const copy = {
    ru: { heading: 'Понятно, что согласовано и кто отвечает', application: 'Подать заявку' },
    en: { heading: 'Know what is agreed and who is responsible', application: 'Apply for access' },
    zh: { heading: '了解已约定的事项及责任分工', application: '申请接入' },
  } as const;

  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`${locale}: renders approved wording, an application link and six neutral checks`, async () => {
      vi.mocked(getLocale).mockResolvedValue(locale);
      try {
        const all = elements(await TrustPage());
        expect(all.filter((node) => node.type === 'h1').map((node) => node.props.children)).toEqual([copy[locale].heading]);
        const application = all.find((node) => node.props.href === `/platform-v7/register?lang=${locale}`);
        expect(application).toBeDefined();
        expect(application!.props.children).toContain(copy[locale].application);
        const checklist = all.find((node) => node.props['data-testid'] === 'public-trust-checklist');
        expect(checklist).toBeDefined();
        const items = elements(checklist).filter((node) => node.props.role === 'listitem');
        expect(items).toHaveLength(6);
        for (const item of items) {
          expect(item.props['data-state']).toBe('unknown');
          expect(item.props['aria-current']).toBeUndefined();
        }
        expect(elements(checklist).filter((node) => node.type === 'button' || node.type === 'a')).toHaveLength(0);
        expect(checklist!.props.style.gridTemplateColumns).toBe('repeat(auto-fit,minmax(min(100%,140px),1fr))');
        expect(all.filter((node) => node.props.className === 'pc-cp-card pc-cp-trust-pillar')).toHaveLength(4);
        expect(all.find((node) => node.type === CanonicalPublicHeader)?.props.activePath).toBe('/platform-v7/trust');
        expect(all.find((node) => node.type === CanonicalBottomNav)?.props.active).toBe('/platform-v7/trust');
      } finally {
        vi.mocked(getLocale).mockResolvedValue('ru');
      }
    });
  }

  it('retains the shared one-column mobile Trust rule and the permission and settlement boundaries', () => {
    const css = read('apps/web/styles/platform-v7-canonical-public-v1.css');
    expect(css).toContain('.pc-cp-page-trust .pc-cp-trust-pillars{grid-template-columns:1fr!important}');
    const source = read('apps/web/app/platform-v7/trust/page.tsx');
    expect(source).toContain('Статус расчёта меняется только по подтверждённым событиям.');
    expect(source).toContain('Доступ появляется только после проверки роли, организации и полномочий.');
    expect(source).not.toContain("data-state={i===5?'current':'done'}");
    expect(source).not.toContain("<span className='pc-cp-eyebrow'>{c.faq}</span>");
  });
});

describe('contact inquiry uses the existing endpoint without losing a draft', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  function contactForm(locale: 'ru' | 'en' | 'zh' = 'ru') {
    const view = render(createElement(ContactClient, { sent: false, failed: false, locale }));
    const form = view.container.querySelector<HTMLFormElement>('form')!;
    for (const [name, value] of Object.entries({ name: 'QA User', organization: 'QA Organisation', contact: 'qa@example.invalid', message: 'A question about joining the platform.' })) {
      fireEvent.change(form.querySelector(`[name="${name}"]`)!, { target: { value } });
    }
    fireEvent.click(form.querySelector('[name="consent"]')!);
    return { ...view, form };
  }

  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`${locale}: exposes phone and policy before an error and retains the native fallback`, () => {
      const { container, form } = contactForm(locale);
      expect(container.querySelector('a[href="tel:+79162778989"]')).not.toBeNull();
      expect(container.querySelector(`a[href="/platform-v7/privacy?lang=${locale}"]`)).not.toBeNull();
      expect(form.getAttribute('action')).toBe('/api/platform-v7/inquiries');
      expect(form.method).toBe('post');
      expect(form.querySelector<HTMLInputElement>('[name="consent"]')!.required).toBe(true);
      expect(form.querySelector<HTMLInputElement>('[name="name"]')!.maxLength).toBe(80);
      expect(form.querySelector<HTMLInputElement>('[name="contact"]')!.maxLength).toBe(120);
      expect(form.querySelector<HTMLTextAreaElement>('textarea')!.maxLength).toBe(2000);
      expect(form.querySelector<HTMLInputElement>('[name="website"]')!.tabIndex).toBe(-1);
    });
  }

  it('prevents duplicate requests and retains every field after a confirmed failure', async () => {
    let settle!: (value: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const { container, form } = contactForm('en');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(form.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/platform-v7/inquiries');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(init.body)).toEqual({ type: 'platform', name: 'QA User', organization: 'QA Organisation', contact: 'qa@example.invalid', message: 'A question about joining the platform.', consent: 'yes', website: '', source: 'platform_v7_contact_page', locale: 'en' });
    settle({ ok: false, json: async () => ({ accepted: true, sent: false, delivered: false, next: 'private-provider-detail' }) });
    await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.querySelector('.p7-contact-success')).toBeNull();
    expect(form.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('A question about joining the platform.');
    expect(form.querySelector<HTMLInputElement>('[name="contact"]')!.value).toBe('qa@example.invalid');
    expect(form.querySelector<HTMLInputElement>('[name="consent"]')!.checked).toBe(true);
    expect(form.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
    expect(container.textContent).not.toContain('private-provider-detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { accepted: true },
    { accepted: true, sent: false, ignored: true },
    { accepted: true, sent: 'true', delivered: 'true' },
    { accepted: true, sent: true, delivered: false },
    null,
  ])('never turns an incomplete HTTP success into confirmed delivery: %j', async (body) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    const { container, form } = contactForm();
    fireEvent.submit(form);
    await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.querySelector('.p7-contact-success')).toBeNull();
    expect(form.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('A question about joining the platform.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a network outcome as unconfirmed, without retry or draft deletion', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    const { container, form } = contactForm();
    fireEvent.submit(form);
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Отправка не подтверждена'));
    expect(form.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('QA User');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('shows success only after the existing server confirms sending and removes the draft guard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true, sent: true, delivered: true }) }));
    const { container, form } = contactForm();
    fireEvent.submit(form);
    await waitFor(() => expect(container.querySelector('.p7-contact-success')?.textContent).toContain('Обращение отправлено'));
    expect(container.querySelector('form')).toBeNull();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('retains input values when the component locale changes without navigation', () => {
    const view = contactForm('ru');
    view.rerender(createElement(ContactClient, { sent: false, failed: false, locale: 'zh' }));
    expect(view.container.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('QA User');
    expect(view.container.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('A question about joining the platform.');
    expect(view.container.querySelector<HTMLInputElement>('[name="locale"]')!.value).toBe('zh');
  });
});

describe('public locale navigation does not silently erase a filled form', () => {
  const originalUrl = window.location.pathname + window.location.search + window.location.hash;
  const fixtures: HTMLElement[] = [];
  afterEach(() => {
    cleanup();
    for (const fixture of fixtures.splice(0)) fixture.remove();
    window.history.replaceState({}, '', originalUrl);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  function header(route: string) {
    window.history.replaceState({}, '', route);
    const fixture = document.createElement('div');
    fixture.innerHTML = '<header data-public-site-header="canonical"><div class="pc-site-actions"><details class="pc-site-mobile-menu" open><summary>Menu</summary><div class="pc-site-mobile-nav"><div class="pc-site-mobile-locale"><a class="pc-site-locale-option" data-active="true" href="?lang=ru">RU</a><a class="pc-site-locale-option" data-active="false" href="?lang=en">EN</a></div></div></details></div><div data-hook></div></header><form><input name="password" type="password"><input name="state" type="hidden" value="unchanged"></form>';
    document.body.appendChild(fixture);
    fixtures.push(fixture);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    render(createElement(PublicHeaderInteractions, { locale: 'ru' }), { container: fixture.querySelector('[data-hook]') as HTMLElement });
    return {
      fixture, input: fixture.querySelector<HTMLInputElement>('input[name="password"]')!,
      active: fixture.querySelector<HTMLAnchorElement>('a[data-active="true"]')!,
      other: fixture.querySelector<HTMLAnchorElement>('a[data-active="false"]')!,
      menu: fixture.querySelector<HTMLDetailsElement>('details')!,
    };
  }

  for (const route of ['/platform-v7/register?lang=ru', '/platform-v7/login?lang=ru', '/platform-v7/forgot-password?lang=ru']) {
    it(`${route}: cancellation retains the form and never places its secret in navigation`, () => {
      const view = header(route);
      const confirm = vi.fn<(message?: string) => boolean>().mockReturnValue(false);
      vi.stubGlobal('confirm', confirm);
      fireEvent.input(view.input, { target: { value: 'Synthetic-local-secret-01!' } });
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      view.other.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0]![0]).not.toContain('Synthetic-local-secret-01!');
      expect(view.input.value).toBe('Synthetic-local-secret-01!');
      expect(window.location.pathname + window.location.search).toBe(route);
      expect(view.other.href).not.toContain('Synthetic-local-secret-01!');
    });
  }

  it('opens the language choice instead of reloading the current locale inside the menu', async () => {
    const view = header('/platform-v7/register?lang=ru');
    const confirm = vi.fn<(message?: string) => boolean>().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    view.active.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(view.menu.open).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(view.other));
  });

  it('does not serialize field values or use browser storage for locale protection', () => {
    const source = read('apps/web/components/platform-v7/PublicHeaderInteractions.tsx');
    expect(source).toContain('WeakSet<HTMLFormElement>');
    for (const forbidden of ['localStorage', 'sessionStorage', 'new FormData', '.value', 'JSON.stringify']) expect(source).not.toContain(forbidden);
  });
});
