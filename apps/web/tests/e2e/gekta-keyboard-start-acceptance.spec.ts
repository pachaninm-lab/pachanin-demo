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

  // The compact home fits the screen. Expand examples to exercise document scrolling.
  await page.locator('[data-gekta-more-examples=true]').click();
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Данные и безопасность');
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
    const payload = request.postDataJSON() as { source?: string; type?: string; message?: string; consent?: string };
    expect(payload.source).toBe('support_chat');
    expect(payload.type).toBe('technical');
    expect(payload.message).toContain('iPhone');
    expect(payload.consent).toBe('yes');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: true, sent: true }) });
  });

  await form.locator('input[name="name"]').fill('Максим');
  await form.locator('input[name="contact"]').fill('maxim@example.test');
  await form.locator('textarea[name="message"]').fill('iPhone: проверка кликабельности и мобильного интерфейса Гекты.');
  await form.getByRole('combobox', { name: 'Тема' }).selectOption('technical');
  await form.locator('input[name="consent"]').check();
  const submit = form.getByRole('button', { name: 'Отправить обращение' });
  const submitBox = await submit.boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Обращение отправлено' })).toBeFocused();
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
  generationFailsOnce?: boolean; locale?: 'ru' | 'en' | 'zh';
} = {}) {
  const locale = options.locale ?? 'ru';
  const probeGate = consentGate();
  const reserveGate = consentGate();
  let accepted = false;
  let reserveCount = 0;
  let probeCount = 0;
  let consentCount = 0;
  const generations: Array<{ message: string; documents?: unknown; ticket: string }> = [];
  const completions: string[] = [];
  const failures: string[] = [];
  const canceled: string[] = [];
  const unexpected: string[] = [];
  const attempts: Promise<void>[] = [];
  const envelope = (current: boolean) => ({
    legalVersion: 'synthetic-browser-version', consentCurrent: current,
    legalPresentation: { locale, snapshot: 'synthetic-browser-notice',
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
        await json(envelope(accepted)); return;
      }
      const body = route.request().postDataJSON();
      if (body.action === 'consent') {
        consentCount += 1;
        // The client must forward the displayed synthetic notice, not omit it.
        expect(body.noticeSnapshot).toBe('synthetic-browser-notice');
        expect(body.locale).toBe(locale);
        if (options.consentFails) { await json(envelope(false), 503); return; }
        accepted = true;
        await json(envelope(true), 200, 'accepted'); return;
      }
      if (body.action === 'reserve') {
        reserveCount += 1;
        const result = accepted ? { ...envelope(true), allowed: true, ticket: `synthetic-browser-ticket-${reserveCount}` }
          : { ...envelope(false), allowed: false, reason: 'consent_required' };
        if (options.holdFirstReserve && reserveCount === 1) {
          attempts.push(releaseLate(route, reserveGate.promise, result, 'stale-reserve'));
          return;
        }
        await json(options.reserveFails ? {} : result, options.reserveFails ? 503 : 200); return;
      }
      if (body.action === 'complete') { completions.push(String(body.ticket)); await json(envelope(accepted)); return; }
    }
    if (url.pathname === '/api/agro-chat') {
      generations.push({ ...route.request().postDataJSON(), ticket: route.request().headers()['x-gekta-answer-ticket'] });
      if (options.generationFailsOnce && generations.length === 1) {
        await route.abort('connectionreset');
        return;
      }
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
    generations, completions, failures, canceled, unexpected,
    requireConsentAgain() { accepted = false; },
    get probes() { return probeCount; }, get reserves() { return reserveCount; }, get consents() { return consentCount; },
    releaseProbe: probeGate.release,
    async releaseAll() { probeGate.release(); reserveGate.release(); await Promise.all(attempts); },
  };
}

// Feed the real browser stream reader in distinct chunks so the reader can scroll between them.
async function installPacedAnswer(page: Page) {
  await page.addInitScript(() => {
    if (!['127.0.0.1', 'localhost'].includes(location.hostname)) return;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.origin !== location.origin || url.pathname !== '/api/agro-chat') return nativeFetch(input, init);
      const streamId = 'paced-browser-answer';
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const write = (event: string, data: object) => controller.enqueue(encoder.encode(
            'event: ' + event + '\ndata: ' + JSON.stringify({ event, streamId, ...data }) + '\n\n',
          ));
          const clean = () => {
            window.removeEventListener('gekta-test-chunk', onChunk);
            init?.signal?.removeEventListener('abort', abort);
          };
          const onChunk = (event: Event) => {
            const text: string | null = (event as CustomEvent).detail;
            if (text !== null) { write('token', { text }); return; }
            write('done', { complete: true });
            clean();
            controller.close();
          };
          const abort = () => { clean(); controller.error(new DOMException('Stopped', 'AbortError')); };
          write('meta', { mode: 'public', modelIdentity: null });
          window.addEventListener('gekta-test-chunk', onChunk);
          init?.signal?.addEventListener('abort', abort, { once: true });
        },
      });
      return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    };
  });
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
    for (const [locale, path, question] of [
      ['ru', '/gekta', 'Затраты 56 000 ₽/га, урожайность 4 т/га. Сколько стоит тонна?'],
      ['en', '/gekta/en', 'Wheat costs 56,000 rubles per hectare and yields 4 tonnes. Cost per tonne?'],
      ['zh', '/gekta/zh', '每公顷成本为 56,000 卢布，产量为 4 吨。每吨成本是多少？'],
    ] as const) {
      test(`edits a cost example in ${locale} before requesting consent and sends the edited question once`, async ({ page }) => {
        const server = await installConsentFixture(page, { locale });
        await page.goto(path);
        await expect.poll(() => server.probes).toBe(1);
        const box = page.locator('#gekta-composer-input');
        const originalBox = await box.elementHandle();
        const notice = page.locator('[data-gekta-consent]');
        await page.locator('[data-gekta-starter="true"]:visible').nth(1).click();
        await expect(notice).toHaveCount(0, { timeout: 1800 });
        await expect(box).toHaveValue(/48[ ,]000/);
        await expect(box).toBeFocused();
        expect(await originalBox!.evaluate(node => document.activeElement === node)).toBe(true);
        await box.fill(question);
        await box.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
        await expect(notice).toHaveCount(0);
        expect(server.reserves).toBe(0);

        await page.locator('[data-gekta-submit]').click();
        await expect(notice.getByRole('heading')).toBeFocused();
        await box.evaluate(node => (node as HTMLElement).focus());
        await expect(notice.getByRole('heading')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(notice.locator('[data-gekta-consent-dismiss]')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(notice.getByRole('link').first()).toBeFocused();
        await notice.locator('[data-gekta-consent-dismiss]').click();
        await expect(box).toBeFocused();
        await expect(box).toHaveValue(question);
        expect(server.consents).toBe(0);
        expect(server.generations).toHaveLength(0);

        await box.press('Enter');
        await expect(notice.getByRole('heading')).toBeFocused();
        await notice.locator('[data-gekta-consent-accept]').click();
        await expect.poll(() => server.completions.length).toBe(1);
        expect(server.consents).toBe(1);
        expect(server.generations.map(item => item.message)).toEqual([question]);
        expect(server.unexpected).toEqual([]);
        expect(server.failures).toEqual([]);
      });
    }

    test('renews consent before retry and preserves the unsent follow-up', async ({ page }) => {
      const server = await installConsentFixture(page, { generationFailsOnce: true });
      await page.goto('/gekta?chat=new');
      await expect.poll(() => server.probes).toBe(1);
      const notice = page.locator('[data-gekta-consent]');
      await expect(notice).toHaveCount(0);
      const box = page.locator('#gekta-composer-input');
      const question = 'Как сравнить затраты на два поля?';
      const followUp = 'Черновик второго вопроса';
      await box.fill(question);
      await box.press('Enter');
      await notice.locator('[data-gekta-consent-accept]').click();
      const retry = page.locator('[data-gekta-answer-notice="error"]').getByRole('button');
      await expect(retry).toBeVisible();
      await box.fill(followUp);
      server.requireConsentAgain();
      await retry.click();
      await expect(notice.getByRole('heading')).toBeFocused();
      expect(server.generations).toHaveLength(1);
      await notice.locator('[data-gekta-consent-accept]').click();
      await expect.poll(() => server.completions.length).toBe(1);
      expect(server.generations.map(item => item.message)).toEqual([question, question]);
      await expect(page.locator('[data-gekta-role="user"]')).toHaveCount(1);
      await expect(box).toHaveValue(followUp);
    });

    test('keeps the reading position across streamed chunks and announces a finished answer once', async ({ page }) => {
      const server = await installConsentFixture(page);
      await installPacedAnswer(page);
      const push = (text: string | null) => page.evaluate(value => {
        window.dispatchEvent(new CustomEvent('gekta-test-chunk', { detail: value }));
      }, text);
      await page.goto('/gekta');
      const status = page.locator('[data-gekta-answer-status]');
      const announcements = await status.evaluateHandle(element => {
        const heard: string[] = [];
        new MutationObserver(() => {
          if (element.textContent) heard.push(element.textContent);
        }).observe(element, { childList: true, subtree: true, characterData: true });
        return heard;
      });
      const input = page.locator('#gekta-composer-input');
      await input.fill('Как сравнить расходы двух полей?');
      await input.press('Enter');
      await page.locator('[data-gekta-consent-accept]').click();
      await expect(page.getByRole('button', { name: 'Остановить', exact: true })).toBeVisible();
      const paragraph = Array.from({ length: 42 }, (_, i) => 'Поле ' + (i + 1) + '. Проверяем затраты и площадь.').join('\n\n');
      await push(paragraph);
      const answer = page.locator('[data-gekta-role="assistant"]').last();
      await expect(answer).toContainText('Поле 42.');
      const scroller = answer.locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
      await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(200);
      await scroller.evaluate(el => { el.scrollTop = 70; });
      const jump = page.getByRole('button', { name: 'К последнему сообщению' });
      await expect(jump).toBeVisible();
      await push('\n\nСледующая часть для сравнения.');
      await expect(answer).toContainText('Следующая часть для сравнения.');
      await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeLessThan(150);
      await push(null);
      await expect(status).toHaveText('Ответ Гекты готов.');
      expect(await announcements.jsonValue()).toEqual(['Гекта анализирует…', 'Ответ Гекты готов.']);
      await expect.poll(() => server.completions.length).toBe(1);
      await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeLessThan(150);
      await jump.click();
      await expect(jump).toHaveCount(0);
      await page.reload();
      await expect(status).toBeEmpty();
      const reopen = viewport.width >= 1024
        ? page.getByRole('complementary').getByRole('button', { name: 'Как сравнить расходы двух полей?', exact: true })
        : page.getByRole('button', { name: /Продолжить последний диалог/ });
      await reopen.click();
      await expect(answer).toContainText('Следующая часть для сравнения.');
      await expect(status).toBeEmpty();
    });

    test('keeps a new draft separate when leaving a streaming answer', async ({ page }) => {
      await installConsentFixture(page);
      await installPacedAnswer(page);
      await page.goto('/gekta');
      const input = page.locator('#gekta-composer-input');
      await input.fill('Старая переписка');
      await input.press('Enter');
      await page.locator('[data-gekta-consent-accept]').click();
      await expect(page.getByRole('button', { name: 'Остановить', exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('gekta-test-chunk', { detail: 'Первая часть ответа.' })));
      await expect(page.locator('[data-gekta-role="assistant"]')).toContainText('Первая часть ответа.');
      await page.getByRole('button', { name: 'Новый диалог', exact: true }).filter({ visible: true }).first().click();
      await input.fill('Новый черновик');
      await expect(page.locator('[data-gekta-role]')).toHaveCount(0);
      await expect(input).toHaveValue('Новый черновик');
      await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled();
      await page.reload();
      await expect(input).toHaveValue('Новый черновик');
      await expect(page.locator('[data-gekta-role]')).toHaveCount(0);
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
          expect(server.generations[0].message).toBe('Проанализируй приложенные материалы.');
          expect(server.generations[0].documents).toEqual([{ name: 'soil.txt', text: 'Почва суглинок. QA_BROWSER_SOIL_754.', truncated: false }]);
          expect(server.generations[0].message).not.toContain('QA_BROWSER_SOIL_754');
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
        await page.getByRole('button', { name: 'Новый диалог', exact: true }).click();
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

    test('keeps one keyboard dialog when access returns while settings are open', async ({ page }) => {
      const server = await installConsentFixture(page, { holdFirstReserve: true });
      try {
        await page.goto('/gekta');
        await page.locator('#gekta-composer-input').fill('Проверь варианты посева');
        await page.locator('[data-gekta-submit]').click();
        await expect.poll(() => server.reserves).toBe(1);
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Открыть историю' }).click();
        await page.locator('[data-gekta-open-settings]:visible').click();
        await expect(page.locator('[data-gekta-settings]')).toBeVisible();
        await server.releaseAll();
        const notice = page.locator('[data-gekta-consent]');
        await expect(notice).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(notice.getByRole('heading')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(notice.locator('[data-gekta-consent-dismiss]')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(notice.locator('[data-gekta-consent-accept]')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(notice).toHaveCount(0);
        await expect(page.locator('[data-gekta-settings]')).toBeVisible();
        expect(server.generations).toHaveLength(0);
      } finally { await server.releaseAll(); }
    });

    test('discards a delayed attachment when a different draft is opened', async ({ page }) => {
      const server = await installConsentFixture(page);
      const uploadBegan = consentGate();
      const finishUpload = consentGate();
      const oldFile = { id: 'before-switch', name: 'field-one.txt', size: 9, mediaType: 'text/plain',
        checksumSha256: 'a'.repeat(64), text: 'Field one', truncated: false };
      await page.route('**/api/public-platform-assistant/attachments', async route => {
        uploadBegan.release();
        await finishUpload.promise;
        try { await route.fulfill({ json: { documents: [oldFile] } }); }
        catch (error) { if (!/closed|canceled|cancelled|invalid interception/i.test(String(error))) throw error; }
      });
      try {
        await page.goto('/gekta');
        const input = page.locator('#gekta-composer-input');
        await input.fill('Первое поле');
        await page.locator('input[type=file]').setInputFiles({ name: oldFile.name, mimeType: 'text/plain', buffer: Buffer.from(oldFile.text) });
        await uploadBegan.promise;
        const newChat = viewport.width < 1024 ? page.locator('[data-gekta-header-new-chat]') : page.locator('aside').getByRole('button', { name: 'Новый диалог' });
        await newChat.click();
        finishUpload.release();
        await input.fill('Второе поле');
        await expect(page.locator('[data-gekta-submit]')).toBeEnabled();
        await input.press('Enter');
        await page.locator('[data-gekta-consent-accept]').click();
        await expect.poll(() => server.completions.length).toBe(1);
        expect(server.generations[0]).toMatchObject({ message: 'Второе поле', documents: [] });
        await expect(page.getByRole('button', { name: 'Удалить: field-one.txt' })).toHaveCount(0);
      } finally { finishUpload.release(); await server.releaseAll(); }
    });

    test('waits for a chosen file before sending its question with button or Enter', async ({ page }) => {
      const server = await installConsentFixture(page);
      const uploadBegan = consentGate();
      const finishUpload = consentGate();
      const file = { id: 'field-report', name: 'field.txt', size: 9, mediaType: 'text/plain',
        checksumSha256: 'b'.repeat(64), text: 'Field two', truncated: false };
      await page.route('**/api/public-platform-assistant/attachments', async route => {
        uploadBegan.release();
        await finishUpload.promise;
        await route.fulfill({ json: { documents: [file] } });
      });
      try {
        await page.goto('/gekta');
        const input = page.locator('#gekta-composer-input');
        const send = page.locator('[data-gekta-submit]');
        await input.fill('Разбери файл по полю');
        await page.locator('input[type=file]').setInputFiles({ name: file.name, mimeType: 'text/plain', buffer: Buffer.from(file.text) });
        await uploadBegan.promise;
        await expect(send).toBeDisabled();
        await input.press('Enter');
        expect(server.reserves).toBe(0);
        finishUpload.release();
        await expect(send).toBeEnabled();
        await send.click();
        await page.locator('[data-gekta-consent-accept]').click();
        await expect.poll(() => server.completions.length).toBe(1);
        expect(server.generations).toHaveLength(1);
        expect(server.generations[0]).toMatchObject({ message: 'Разбери файл по полю', documents: [{ name: file.name, text: file.text }] });
        await expect(page.getByRole('button', { name: 'Удалить: field.txt' })).toHaveCount(0);
      } finally { finishUpload.release(); await server.releaseAll(); }
    });

    test('returns to the draft with Escape or the back button without consenting or sending', async ({ page }) => {
      const server = await installConsentFixture(page, { holdProbe: true });
      try {
        await page.goto('/gekta');
        await expect.poll(() => server.probes).toBe(1);
        const box = page.locator('#gekta-composer-input');
        const original = 'Поле 17, площадь 46,3 га.\nУрожайность 4,8 т/га.';
        await box.fill(original);
        const dialog = page.getByRole('dialog', { name: 'Перед началом' });
        for (const method of ['keyboard', 'button']) {
          await box.press('Enter');
          await expect(dialog).toBeVisible();
          const back = dialog.getByRole('button', { name: 'Вернуться к вопросу' });
          if (method === 'keyboard') await page.keyboard.press('Escape');
          else await back.click();
          await expect(dialog).toHaveCount(0);
          await expect(box).toBeFocused();
          await expect(box).toHaveValue(original);
          expect(server.consents).toBe(0);
          expect(server.generations).toHaveLength(0);
        }
        await box.fill('Уточнение: площадь 47,3 га.');
        await box.press('Enter');
        await dialog.locator('[data-gekta-consent-accept]').click();
        await expect(page.locator('[data-gekta-role="assistant"]')).toContainText('QA_BROWSER_ANSWER');
        expect(server.consents).toBe(1);
        expect(server.generations.map(item => item.message)).toEqual(['Уточнение: площадь 47,3 га.']);
      } finally { await server.releaseAll(); }
    });

    test('a late acknowledgement cannot send a question after returning to its draft', async ({ page }) => {
      const server = await installConsentFixture(page, { holdProbe: true });
      const started = consentGate();
      const release = consentGate();
      await page.route('**/api/gekta/entitlement', async route => {
        if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'consent') {
          started.release();
          await release.promise;
        }
        await route.fallback();
      });
      try {
        await page.goto('/gekta');
        await expect.poll(() => server.probes).toBe(1);
        const box = page.locator('#gekta-composer-input');
        await box.fill('Затраты на 75 га');
        await box.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Перед началом' });
        await dialog.locator('[data-gekta-consent-accept]').click();
        await started.promise;
        await dialog.getByRole('button', { name: 'Вернуться к вопросу' }).click();
        await expect(box).toBeFocused();
        await box.fill('Уточняю: 79 га');
        const response = page.waitForResponse(reply => reply.request().method() === 'POST'
          && new URL(reply.url()).pathname === '/api/gekta/entitlement'
          && reply.request().postDataJSON()?.action === 'consent');
        release.release();
        await response;
        await page.reload();
        await expect(box).toHaveValue('Уточняю: 79 га');
        expect(server.generations).toHaveLength(0);
      } finally { release.release(); await server.releaseAll(); }
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

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`G-A14 explicit recovery ${viewport.width}px`, () => {
    test.use({ viewport });
    test.beforeEach(async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL;
      const loopback = typeof baseURL === 'string'
        && ['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname);
      const liveProfile = /(?:^|[/\\])playwright\.production-mobile\.config\.ts$/u.test(testInfo.config.configFile);
      test.skip(liveProfile && !loopback, 'Synthetic recovery fixtures apply only to the loopback PR server; live tests remain unmocked.');
      // A misconfigured PR origin must fail, not silently skip acceptance.
      expect(loopback, 'Synthetic G-A14 PR browser acceptance requires loopback').toBe(true);
    });

    test('lost generation is sent once; explicit Retry reserves a fresh ticket and retains the document', async ({ page, baseURL }, testInfo) => {
      const origin = new URL(baseURL!);
      expect(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Synthetic recovery acceptance requires loopback').toBe(true);
      const server = await installConsentFixture(page, { holdProbe: true, generationFailsOnce: true });
      try {
        await page.goto('/gekta?chat=new', { waitUntil: 'load' });
        await expect.poll(() => server.probes).toBe(1);
        const question = 'Как подготовить почву под пшеницу?';
        const composer = page.locator('#gekta-composer-input');
        await composer.fill(question);
        await page.locator('[data-gekta-drop-target] input[type=file]').setInputFiles({
          name: 'soil.txt', mimeType: 'text/plain', buffer: Buffer.from('Почва суглинок. QA_BROWSER_SOIL_754.'),
        });
        await expect(page.getByText('soil.txt').first()).toBeVisible();
        await page.getByRole('button', { name: 'Отправить', exact: true }).click();
        await expect(page.locator('[data-gekta-consent="true"]')).toBeVisible();
        expect(server.generations).toHaveLength(0);
        expect(server.consents).toBe(0);
        await page.getByRole('button', { name: 'Понятно, начать', exact: true }).click();
        const failure = page.locator('[data-gekta-answer-notice="error"]');
        await expect(failure.getByRole('status')).toContainText('Не удалось ответить');
        await expect(failure.getByRole('button')).toHaveCount(1);
        const retry = failure.getByRole('button', { name: 'Повторить', exact: true });
        await expect(retry).toBeVisible();
        expect(server.generations).toHaveLength(1);
        expect(server.completions).toEqual([]);
        await expectNoHorizontalOverflow(page);
        await testInfo.attach('recovery-before-retry', { body: await page.screenshot(), contentType: 'image/png' });
        await retry.click();
        await expect(page.getByText('QA_BROWSER_ANSWER: проверь тип почвы.', { exact: true })).toBeVisible();
        await expect(failure).toHaveCount(0);
        await expect.poll(() => server.completions.length).toBe(1);
        expect(server.generations).toHaveLength(2);
        expect(server.generations[0].ticket).toBeTruthy();
        expect(server.generations[1].ticket).toBeTruthy();
        expect(server.generations[1].ticket).not.toBe(server.generations[0].ticket);
        expect(server.completions).toEqual([server.generations[1].ticket]);
        for (const generation of server.generations) {
          expect(generation.message).toBe(question);
          expect(generation.documents).toEqual([{ name: 'soil.txt', text: 'Почва суглинок. QA_BROWSER_SOIL_754.', truncated: false }]);
        }
        expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('QA_BROWSER_SOIL_754');
        await expectNoHorizontalOverflow(page);
        await testInfo.attach('recovery-after-retry', { body: await page.screenshot(), contentType: 'image/png' });
        expect(server.failures).toEqual([]);
        expect(server.unexpected).toEqual([]);
      } finally { await server.releaseAll(); }
    });
  });
}
