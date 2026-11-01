import { expect, test, type Page, type Route } from '@playwright/test';

async function waitForViewportAuthority(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
    const actualHeight = window.visualViewport?.height ?? window.innerHeight;
    return Number.isFinite(cssHeight) && Math.abs(cssHeight - actualHeight) <= 2;
  });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

test('390px empty start survives 20 keyboard cycles while discovery remains scrollable and caret stays stable', async ({ page }) => {
  const runtimeFailures: string[] = [];
  page.on('pageerror', (error) => runtimeFailures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|uncaught|error boundary|unhandled/i.test(message.text())) runtimeFailures.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/gekta', { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  await waitForViewportAuthority(page);

  const workspace = page.locator('[data-gekta-chat-workspace="true"]');
  const composer = page.locator('#gekta-composer-input');
  const composerRoot = page.locator('[data-gekta-composer-root="true"]');
  const privacy = page.locator('#gekta-composer-boundary');
  const discovery = page.locator('[data-gekta-server-discovery="true"]');
  await expect(workspace).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(composerRoot).toBeVisible();
  await expect(discovery).toBeAttached();
  expect(await composerRoot.evaluate((node) => Boolean(node.closest('[data-gekta-composer-slot="true"]')))).toBe(true);
  await composerRoot.evaluate((node) => {
    const host = node.closest<HTMLElement>('[data-gekta-composer-slot="true"]');
    if (host) host.dataset.gektaStableComposerHost = 'true';
  });

  const initialState = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true'] main > div:first-of-type");
    const workspace = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true']");
    return {
      rootOverflow: root ? getComputedStyle(root).overflowY : '',
      workspacePosition: workspace ? getComputedStyle(workspace).position : '',
      bodyOverflow: getComputedStyle(document.body).overflowY,
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(['auto', 'scroll']).not.toContain(initialState.rootOverflow);
  expect(initialState.workspacePosition).not.toBe('fixed');
  expect(initialState.bodyOverflow).not.toBe('hidden');
  expect(initialState.htmlOverflow).not.toBe('hidden');
  expect(initialState.scrollHeight).toBeGreaterThan(initialState.viewportHeight);

  const draft = 'Проверить поле 17: питание, влага и болезни';
  await composer.fill(draft);
  await composer.evaluate((node) => (node as HTMLTextAreaElement).setSelectionRange(19, 19, 'none'));
  await composer.focus();

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.setViewportSize({ width: 390, height: 520 });
    await waitForViewportAuthority(page);
    await expect(page.locator('html')).toHaveAttribute('data-gekta-keyboard-open', 'true');
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);
    await expect(privacy).toBeHidden();
    await expect(discovery).toBeAttached();

    const openState = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true']");
      const header = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true'] header")?.getBoundingClientRect();
      const composerRoot = document.querySelector<HTMLElement>("[data-gekta-composer-root='true']");
      const stableHost = composerRoot?.closest<HTMLElement>("[data-gekta-composer-slot='true']");
      const surface = document.querySelector<HTMLElement>("[data-gekta-drop-target='true']")?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const textarea = document.querySelector<HTMLTextAreaElement>('#gekta-composer-input');
      return {
        workspacePosition: workspace ? getComputedStyle(workspace).position : '',
        composerPosition: composerRoot ? getComputedStyle(composerRoot).position : '',
        stableHost: stableHost?.dataset.gektaStableComposerHost === 'true',
        headerHeight: header?.height ?? 0,
        surfaceHeight: surface?.height ?? 0,
        surfaceBottom: surface?.bottom ?? Number.POSITIVE_INFINITY,
        gap: surface ? visibleBottom - surface.bottom : Number.NEGATIVE_INFINITY,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        htmlOverflow: getComputedStyle(document.documentElement).overflowY,
        documentScrollHeight: document.scrollingElement?.scrollHeight ?? 0,
        visibleHeight: viewport?.height ?? window.innerHeight,
        selectionStart: textarea?.selectionStart ?? -1,
        selectionEnd: textarea?.selectionEnd ?? -1,
      };
    });
    expect(openState.workspacePosition).not.toBe('fixed');
    expect(openState.composerPosition).toBe('fixed');
    expect(openState.stableHost).toBe(true);
    expect(openState.headerHeight).toBeGreaterThanOrEqual(44);
    expect(openState.surfaceHeight).toBeGreaterThanOrEqual(64);
    expect(openState.surfaceBottom).toBeLessThanOrEqual(522);
    expect(openState.gap).toBeGreaterThanOrEqual(-2);
    expect(openState.gap).toBeLessThanOrEqual(32);
    expect(openState.bodyOverflow).not.toBe('hidden');
    expect(openState.htmlOverflow).not.toBe('hidden');
    expect(openState.documentScrollHeight).toBeGreaterThan(openState.visibleHeight);
    expect(openState.selectionStart).toBe(19);
    expect(openState.selectionEnd).toBe(19);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy({ top: 24, behavior: 'auto' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'auto' }), scrollBefore);
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForViewportAuthority(page);
    await expect(page.locator('html')).not.toHaveAttribute('data-gekta-keyboard-open', 'true');
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);
    await expect(privacy).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe('hidden');
    await expect.poll(() => composerRoot.evaluate((node) => getComputedStyle(node).position)).not.toBe('fixed');
    expect(await composerRoot.evaluate((node) => node.closest<HTMLElement>("[data-gekta-composer-slot='true']")?.dataset.gektaStableComposerHost === 'true')).toBe(true);
  }

  const finalState = await composer.evaluate((node) => ({
    start: (node as HTMLTextAreaElement).selectionStart,
    end: (node as HTMLTextAreaElement).selectionEnd,
    height: (node as HTMLTextAreaElement).getBoundingClientRect().height,
  }));
  expect(finalState.start).toBe(19);
  expect(finalState.end).toBe(19);
  expect(finalState.height).toBeLessThanOrEqual(144);
  await expectNoHorizontalOverflow(page);
  expect(runtimeFailures).toEqual([]);
});

test('320px drawer keeps security and support inside Gekta and all controls remain actionable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const response = await page.goto('/gekta', { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  await waitForViewportAuthority(page);
  await expectNoHorizontalOverflow(page);

  const openMenu = page.locator('[data-gekta-chat-workspace="true"] header > button').first();
  await expect(openMenu).toBeVisible();
  await openMenu.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();

  const securityLink = drawer.getByRole('link', { name: 'Данные и безопасность' });
  await expect(securityLink).toBeVisible();
  await securityLink.click();
  await expect(page).toHaveURL(/\/gekta\/security$/);
  await expect(page.locator('[data-gekta-utility-page="security"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Безопасность');
  await expectNoHorizontalOverflow(page);
  const securityNavMetrics = await page.locator("nav[aria-label='Gekta sections']").evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(securityNavMetrics.scroll).toBeLessThanOrEqual(securityNavMetrics.client + 1);

  await page.getByRole('link', { name: 'Поддержка', exact: true }).first().click();
  await expect(page).toHaveURL(/\/gekta\/support$/);
  const support = page.locator('[data-gekta-utility-page="support"]');
  await expect(support).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const form = page.locator('[data-gekta-support-form="true"]');
  await expect(form).toBeVisible();

  await page.route('**/api/platform-v7/inquiries', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const payload = request.postDataJSON() as { source?: string; message?: string; consent?: string };
    expect(payload.source).toBe('support_chat');
    expect(payload.message).toContain('iPhone');
    expect(payload.consent).toBe('yes');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: true, sent: true }) });
  });

  await form.locator('input[name="name"]').fill('Максим');
  await form.locator('input[name="contact"]').fill('maxim@example.test');
  await form.locator('textarea[name="message"]').fill('iPhone: проверка кликабельности и мобильного интерфейса Гекты.');
  await form.locator('input[name="consent"]').check();
  const submit = form.getByRole('button', { name: 'Отправить обращение' });
  const submitBox = await submit.boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Обращение отправлено' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

// G-A02: real browser fetch cancellation and intent lifecycle. These fixtures
// intercept all API traffic on loopback; they never accept real legal terms,
// contact an account/model, or set a production session cookie.
function consentGate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function installConsentFixture(page: Page, options: {
  holdProbe?: boolean; holdFirstReserve?: boolean; consentFails?: boolean; reserveFails?: boolean;
} = {}) {
  const probeGate = consentGate();
  const reserveGate = consentGate();
  let accepted = false;
  let reserveCount = 0;
  let probeCount = 0;
  let consentCount = 0;
  const generations: Array<{ message: string }> = [];
  const failures: string[] = [];
  const canceled: string[] = [];
  const unexpected: string[] = [];
  const attempts: Promise<void>[] = [];
  const envelope = (current: boolean) => ({
    legalVersion: 'synthetic-browser-version', consentCurrent: current,
    legalPresentation: { locale: 'ru', snapshot: 'synthetic-browser-notice',
      termsHref: '/legal/usloviya-ispolzovaniya-gekta', privacyHref: '/legal/politika-konfidencialnosti' },
    entitlement: { state: 'ANONYMOUS_FREE', canAsk: true, remaining: 10, limit: 10,
      serverTime: '2026-11-01T00:00:00Z', expiresAt: null },
  });
  page.on('pageerror', error => failures.push(error.message));
  page.on('requestfailed', request => {
    if (new URL(request.url()).pathname === '/api/gekta/entitlement') {
      canceled.push(request.method() === 'GET' ? 'probe' : 'reserve');
    }
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    const json = (body: unknown, status = 200, cookie?: string) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
      headers: cookie ? { 'set-cookie': `qa_gekta_state=${cookie}; Path=/; SameSite=Lax; Secure` } : {},
    });
    if (url.pathname.startsWith('/api/gekta/account/') || url.pathname === '/api/gekta/auth/refresh') {
      await json({}, 401); return;
    }
    if (url.pathname === '/api/gekta/entitlement') {
      if (route.request().method() === 'GET') {
        probeCount += 1;
        if (options.holdProbe) {
          attempts.push(releaseLate(route, probeGate.promise, envelope(false), 'stale-probe'));
          return;
        }
        await json(envelope(false)); return;
      }
      const body = route.request().postDataJSON();
      if (body.action === 'consent') {
        consentCount += 1;
        // The client must forward the displayed synthetic notice, not omit it.
        expect(body.noticeSnapshot).toBe('synthetic-browser-notice');
        expect(body.locale).toBe('ru');
        if (options.consentFails) { await json(envelope(false), 503); return; }
        accepted = true;
        await json(envelope(true), 200, 'accepted'); return;
      }
      if (body.action === 'reserve') {
        reserveCount += 1;
        const result = accepted ? { ...envelope(true), allowed: true, ticket: 'synthetic-browser-ticket' }
          : { ...envelope(false), allowed: false, reason: 'consent_required' };
        if (options.holdFirstReserve && reserveCount === 1) {
          attempts.push(releaseLate(route, reserveGate.promise, result, 'stale-reserve'));
          return;
        }
        await json(options.reserveFails ? {} : result, options.reserveFails ? 503 : 200); return;
      }
      if (body.action === 'complete') { await json(envelope(accepted)); return; }
    }
    if (url.pathname === '/api/agro-chat') {
      generations.push(route.request().postDataJSON());
      const streamId = 'synthetic-browser-stream';
      const frames = [
        { event: 'meta', streamId, mode: 'public', modelIdentity: null },
        { event: 'token', streamId, text: 'QA_BROWSER_ANSWER: проверь тип почвы.' },
        { event: 'done', streamId, complete: true },
      ];
      await route.fulfill({ contentType: 'text/event-stream',
        body: frames.map(frame => `event: ${frame.event}\ndata: ${JSON.stringify(frame)}\n\n`).join('') });
      return;
    }
    if (url.pathname === '/api/public-platform-assistant/attachments') {
      await json({ documents: [{ id: 'synthetic-browser-doc', name: 'soil.txt', size: 50,
        mediaType: 'text/plain', text: 'Почва суглинок. QA_BROWSER_SOIL_754.',
        checksumSha256: 'a'.repeat(64), truncated: false }], rejected: [] });
      return;
    }
    unexpected.push(`${route.request().method()} ${url.pathname}`);
    await route.abort();
  });
  async function releaseLate(route: Route, gate: Promise<void>, body: unknown, cookie: string) {
    await gate;
    try {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body),
        headers: { 'set-cookie': `qa_gekta_state=${cookie}; Path=/; SameSite=Lax; Secure` } });
    } catch (error) {
      // Chromium/WebKit can reject fulfilment after native fetch cancellation.
      // The test separately requires requestfailed and checks the cookie jar.
      if (!/closed|canceled|cancelled|invalid interception/i.test(String(error))) throw error;
    }
  }
  return {
    generations, failures, canceled, unexpected,
    get probes() { return probeCount; }, get reserves() { return reserveCount; }, get consents() { return consentCount; },
    releaseProbe: probeGate.release,
    async releaseAll() { probeGate.release(); reserveGate.release(); await Promise.all(attempts); },
  };
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`G-A02 synthetic browser intent ${viewport.width}px`, () => {
    test.use({ viewport });
    test.beforeEach(async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL;
      const loopback = typeof baseURL === 'string'
        && ['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname);
      const liveProfile = /(?:^|[/\\])playwright\.production-mobile\.config\.ts$/u.test(testInfo.config.configFile);
      test.skip(liveProfile && !loopback, 'Synthetic consent fixtures apply only to the loopback PR server; live tests remain unmocked.');
      // A misconfigured PR origin must fail, not silently skip acceptance.
      expect(loopback, 'Synthetic G-A02 PR browser acceptance requires loopback').toBe(true);
    });
    for (const intent of ['click', 'enter'] as const) {
      test(`first ${intent} preserves the question and generates once after explicit consent`, async ({ page }) => {
        const server = await installConsentFixture(page, { holdProbe: true });
        try {
          await page.goto('/gekta');
          await expect.poll(() => server.probes).toBe(1);
          const box = page.locator('#gekta-composer-input');
          await box.fill('Как подготовить почву под пшеницу?');
          if (intent === 'enter') await box.press('Enter');
          else await page.locator('[data-gekta-submit="true"]').click();
          const notice = page.locator('[data-gekta-consent="true"]');
          await expect(notice).toBeVisible();
          await expect(box).toHaveValue('Как подготовить почву под пшеницу?');
          expect(server.generations).toHaveLength(0);
          expect(server.consents).toBe(0);
          await page.locator('[data-gekta-consent-accept="true"]').click();
          await expect(page.locator('[data-gekta-role="assistant"]')).toContainText('QA_BROWSER_ANSWER');
          await expect(notice).toHaveCount(0);
          await server.releaseAll();
          expect(server.generations.map(item => item.message)).toEqual(['Как подготовить почву под пшеницу?']);
          expect(server.consents).toBe(1);
          expect(server.reserves).toBe(2);
          expect(server.failures).toEqual([]);
          expect(server.unexpected).toEqual([]);
          await expectNoHorizontalOverflow(page);
        } finally { await server.releaseAll(); }
      });
    }

    for (const draft of ['', '   ']) {
      test(`document-only deferred consent retains attachment with ${draft ? 'whitespace' : 'empty'} draft`, async ({ page }) => {
        const server = await installConsentFixture(page, { holdProbe: true });
        try {
          await page.goto('/gekta?chat=new');
          await expect.poll(() => server.probes).toBe(1);
          const box = page.locator('#gekta-composer-input');
          await box.fill(draft);
          await page.locator('input[type="file"]').setInputFiles({ name: 'soil.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic soil fixture') });
          await expect(page.getByRole('button', { name: 'Удалить: soil.txt' })).toBeVisible();
          await box.focus();
          const probe = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/gekta/entitlement');
          server.releaseProbe();
          await probe;
          await expect(box).toBeFocused();
          await expect(page.locator('[data-gekta-consent="true"]')).toHaveCount(0);
          await page.locator('[data-gekta-submit="true"]').click();
          await expect(page.locator('[data-gekta-consent="true"]')).toBeVisible();
          expect(server.generations).toHaveLength(0);
          await page.locator('[data-gekta-consent-accept="true"]').click();
          await expect(page.locator('[data-gekta-role="assistant"]')).toContainText('QA_BROWSER_ANSWER');
          expect(server.generations).toHaveLength(1);
          expect(server.generations[0].message).toContain('Проанализируй приложенные материалы.');
          expect(server.generations[0].message).toContain('QA_BROWSER_SOIL_754');
          expect(server.consents).toBe(1);
          expect(server.failures).toEqual([]);
          expect(server.unexpected).toEqual([]);
        } finally { await server.releaseAll(); }
      });
    }

    test('New chat aborts the old reserve; late GET/POST cannot roll back the accepted cookie or question', async ({ page, context }) => {
      const server = await installConsentFixture(page, { holdProbe: true, holdFirstReserve: true });
      try {
        await page.goto('/gekta');
        await expect.poll(() => server.probes).toBe(1);
        const box = page.locator('#gekta-composer-input');
        await box.fill('Отменённый вопрос о ячмене');
        await page.locator('[data-gekta-submit="true"]').click();
        await expect.poll(() => server.reserves).toBe(1);
        await page.locator('[data-gekta-header-new-chat="true"]').click();
        await box.fill('Новый вопрос о пшенице');
        await box.press('Enter');
        await expect(page.locator('[data-gekta-consent="true"]')).toBeVisible();
        await page.locator('[data-gekta-consent-accept="true"]').click();
        await expect(page.locator('[data-gekta-role="assistant"]')).toContainText('QA_BROWSER_ANSWER');
        await expect.poll(() => server.canceled.includes('probe')).toBe(true);
        await expect.poll(() => server.canceled.includes('reserve')).toBe(true);
        await server.releaseAll();
        await expect(page.locator('[data-gekta-consent="true"]')).toHaveCount(0);
        expect(server.generations.map(item => item.message)).toEqual(['Новый вопрос о пшенице']);
        expect((await context.cookies()).filter(cookie => cookie.name === 'qa_gekta_state').map(cookie => cookie.value)).toEqual(['accepted']);
        expect(server.failures).toEqual([]);
        expect(server.unexpected).toEqual([]);
      } finally { await server.releaseAll(); }
    });

    test('failed consent stays visible and never starts generation', async ({ page }) => {
      const server = await installConsentFixture(page, { holdProbe: true, consentFails: true });
      try {
        await page.goto('/gekta');
        await expect.poll(() => server.probes).toBe(1);
        const box = page.locator('#gekta-composer-input');
        await box.fill('Как подготовить почву под пшеницу?');
        await box.press('Enter');
        const notice = page.locator('[data-gekta-consent="true"]');
        await expect(notice).toBeVisible();
        await page.locator('[data-gekta-consent-accept="true"]').click();
        await expect(notice.getByRole('alert')).toBeVisible();
        await expect(box).toHaveValue('Как подготовить почву под пшеницу?');
        expect(server.generations).toHaveLength(0);
        expect(server.consents).toBe(1);
        expect(server.failures).toEqual([]);
        expect(server.unexpected).toEqual([]);
      } finally { await server.releaseAll(); }
    });

    test('failed reservation preserves the draft and exposes a retryable error', async ({ page }) => {
      const server = await installConsentFixture(page, { holdProbe: true, reserveFails: true });
      try {
        await page.goto('/gekta');
        await expect.poll(() => server.probes).toBe(1);
        const box = page.locator('#gekta-composer-input');
        await box.fill('Как подготовить почву под пшеницу?');
        await box.press('Enter');
        const accessError = page.locator('[data-gekta-chat-workspace="true"]').getByRole('alert');
        await expect(accessError).toHaveCount(1);
        await expect(accessError).toContainText('Не удалось проверить доступ к Гекте');
        await expect(box).toHaveValue('Как подготовить почву под пшеницу?');
        expect(server.generations).toHaveLength(0);
        expect(server.consents).toBe(0);
        expect(server.reserves).toBe(1);
        expect(server.failures).toEqual([]);
        expect(server.unexpected).toEqual([]);
      } finally { await server.releaseAll(); }
    });
  });
}
