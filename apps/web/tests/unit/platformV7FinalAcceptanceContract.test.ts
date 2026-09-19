import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RegisterPage from '../../app/platform-v7/register/page';
import { RegisterFormClientPublic } from '../../app/platform-v7/register/RegisterFormClientPublic';

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
    expect(registrationPage).toContain('Регистрация организации и пользователя');
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
    expect(registrationPage).toContain("localeQuery.set('intent', intent)");
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
        const link = header.props.localeControl as React.ReactElement<{ href: string }>;
        const query = new URL(link.props.href, 'https://example.invalid').searchParams;
        expect(query.get('intent')).toBe(intent);
        expect(query.get('verify')).toBe('token-v');
        expect(query.get('statusToken')).toBe('token-s');
        expect(query.get('lang')).toBe(locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru');
        const html = renderToStaticMarkup(createElement(RegisterFormClientPublic, { locale, initialWorkspace: workspace }));
        expect(html).toMatch(new RegExp(`<option[^>]*value="${workspace}"[^>]*selected=""`));
      });
    }
  }
  it.each(['owner', '__proto__', 'constructor', '<script>', 'BUY'])('rejects unknown intent %s', async (intent) => {
    const all = elements(await RegisterPage({ searchParams: Promise.resolve({ intent }) }));
    expect(all.find((node) => node.type === RegisterFormClientPublic)!.props.initialWorkspace).toBeUndefined();
    const control = all.find((node) => node.props.localeControl)!.props.localeControl;
    expect(control.props.href).not.toContain('intent=');
  });
});
