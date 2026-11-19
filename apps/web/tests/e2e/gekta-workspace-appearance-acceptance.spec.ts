import { expect, test } from '@playwright/test';

test('follows the device theme and remembers a manual choice on the localized routes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/gekta');
  const root = page.locator('html');
  const workspace = page.locator('#gekta-chat');
  await expect(root).toHaveAttribute('data-gekta-theme', 'dark');
  await expect(workspace).toHaveCSS('background-color', 'rgb(20, 28, 23)');

  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(workspace).toHaveCSS('background-color', 'rgb(247, 248, 243)');
  await page.reload();
  await expect(root).toHaveAttribute('data-gekta-theme', 'light');

  await page.goto('/gekta/en');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  await page.goto('/gekta/zh');
  await expect(page.getByRole('button', { name: '切换到深色主题' })).toBeVisible();
});

test('keeps a draft through theme, install and mobile settings actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light' });
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route(/\/_next\/static\/chunks\/.+\.js$/u, async (route) => {
    await scriptsReady;
    await route.continue();
  });

  const composer = page.locator('#gekta-composer-input');
  const menu = page.getByRole('button', { name: 'Открыть историю' });
  const send = page.getByRole('button', { name: 'Отправить', exact: true });
  const draft = 'Рассчитай себестоимость хранения зерна';
  try {
    await page.goto('/gekta', { waitUntil: 'commit' });
    await composer.fill(draft);
    await expect(composer).toHaveValue(draft);
    await expect(send).toBeDisabled();
  } finally {
    releaseScripts();
  }
  await expect(send).toBeEnabled();
  await expect(composer).toBeFocused();

  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-gekta-theme', 'dark');
  await expect(composer).toHaveValue(draft);

  await expect(page.getByRole('button', { name: 'Установить Гекту' })).toHaveCount(0);
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Gekta', exact: true });
  const install = drawer.getByRole('button', { name: 'Установить Гекту' });
  await expect(install).toHaveText('Установить Гекту');
  await install.click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Установить Гекту' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(composer).toHaveValue(draft);

  await menu.click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Настройки' });
  await expect(settings.getByRole('button', { name: 'Закрыть настройки' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(composer).toHaveValue(draft);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
  test(`offers native installation at ${viewport.width}px and hides the action in standalone mode`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/gekta');
    const install = page.getByRole('button', { name: 'Установить Гекту' });
    const menu = page.getByRole('button', { name: 'Открыть историю' });
    await expect.poll(() => page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => { document.body.dataset.testInstallPrompt = 'shown'; },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(true);
    if (viewport.width < 1024) await menu.click();
    await install.click();
    await expect(page.locator('body')).toHaveAttribute('data-test-install-prompt', 'shown');
    await expect(page.getByRole('dialog', { name: 'Установить Гекту' })).toHaveCount(0);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    });
    await page.reload();
    if (viewport.width < 1024) {
      await menu.click();
      await expect(page.getByRole('dialog', { name: 'Gekta', exact: true })).toBeVisible();
    }
    await expect(install).toHaveCount(0);
    await expect(page.locator('#gekta-composer-input')).toBeVisible();
  });
}

test('resumes the latest saved conversation in the current language without displacing a draft', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    const rows = [
      ['old-ru', 'ru', 'Ранний расчёт', '2026-08-12T10:00:00Z'],
      ['latest-en', 'en', 'Other language', '2026-08-16T10:00:00Z'],
      ['recent-ru', 'ru', 'Хранение пшеницы', '2026-08-15T10:00:00Z'],
    ];
    localStorage.setItem('gekta-conversations-v2', JSON.stringify(rows.map(([id, locale, title, date]) => ({
      id, locale, title, createdAt: date, updatedAt: date,
      messages: [{ id: `${id}-message`, role: 'assistant', text: `Ответ по теме ${title}`, createdAt: date }],
    }))));
  });
  await page.goto('/gekta');
  const resume = page.getByRole('button', { name: /Продолжить последний диалог/u });
  const composer = page.locator('#gekta-composer-input');
  await expect(resume).toContainText('Хранение пшеницы');
  await expect(resume).toBeInViewport();
  await composer.fill('Новый вопрос о посевной');
  await expect(resume).toHaveCount(0);
  await expect(composer).toHaveValue('Новый вопрос о посевной');
  await composer.clear();
  await resume.click();
  await expect(page.getByText('Ответ по теме Хранение пшеницы', { exact: true })).toBeVisible();
  await expect(resume).toHaveCount(0);
});

test('opens the recent account conversation and loads its messages on demand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const conversation = {
    id: 'recent-account', title: 'Расходы хозяйства', locale: 'ru', projectId: null,
    createdAt: '2026-08-15T11:00:00Z', updatedAt: '2026-08-15T11:01:00Z',
  };
  let messageReads = 0;
  await page.route('**/api/gekta/account/entitlement', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/gekta/account/projects', (route) => route.fulfill({ json: { projects: [] } }));
  await page.route('**/api/gekta/account/conversations', (route) => route.fulfill({ json: { conversations: [conversation] } }));
  await page.route('**/api/gekta/account/conversations/recent-account', (route) => {
    messageReads += 1;
    return route.fulfill({ json: {
      ...conversation,
      messages: [{ id: 'account-message', role: 'assistant', body: 'Сохранённый расчёт расходов.', createdAt: conversation.updatedAt }],
    } });
  });
  await page.goto('/gekta');
  const resume = page.getByRole('button', { name: /Продолжить последний диалог/u });
  await expect(resume).toContainText(conversation.title);
  expect(messageReads).toBe(0);
  await resume.click();
  await expect(page.getByText('Сохранённый расчёт расходов.', { exact: true })).toBeVisible();
  expect(messageReads).toBe(1);
});

test('retains a follow-up through a failed history read and sends the restored context once', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const row = { id: 'field-one', title: 'Поле 1', locale: 'ru', projectId: null,
    createdAt: '2026-08-15T11:00:00Z', updatedAt: '2026-08-15T11:01:00Z' };
  const history = [{ id: 'first-turn', role: 'user', body: 'Площадь 100 га', createdAt: row.createdAt }];
  let finishRead!: () => void;
  const read = new Promise<void>(resolve => { finishRead = resolve; });
  let reads = 0;
  const requests: Array<{ message: string; history: unknown[] }> = [];
  await page.route('**/api/gekta/account/entitlement', route => route.fulfill({ json: { entitlement: { state: 'TRIAL_ACTIVE', canAsk: true } } }));
  await page.route('**/api/gekta/account/projects', route => route.fulfill({ json: { projects: [] } }));
  await page.route('**/api/gekta/account/conversations', route => route.fulfill({ json: { conversations: [row] } }));
  await page.route('**/api/gekta/account/conversations/field-one', async route => {
    if (++reads === 1) { await read; await route.fulfill({ status: 503, json: {} }); }
    else await route.fulfill({ json: { ...row, messages: history } });
  });
  await page.route('**/api/gekta/account/conversations/field-one/messages', route => route.fulfill({ json: { id: 'saved' } }));
  await page.route('**/api/agro-chat?*', route => {
    requests.push(route.request().postDataJSON());
    const streamId = 'saved-context';
    const frames = [{ event: 'meta', streamId, mode: 'public', modelIdentity: null },
      { event: 'token', streamId, text: 'Всего 100 гектаров.' }, { event: 'done', streamId, complete: true }];
    return route.fulfill({ contentType: 'text/event-stream',
      body: frames.map(frame => 'event: ' + frame.event + '\ndata: ' + JSON.stringify(frame) + '\n\n').join('') });
  });
  await page.goto('/gekta');
  await page.getByRole('button', { name: /Продолжить последний диалог/u }).click();
  const input = page.locator('#gekta-composer-input');
  const send = page.locator('[data-gekta-submit]');
  const question = 'Уточни площадь';
  await input.fill(question);
  await expect(send).toBeDisabled();
  await input.press('Enter');
  finishRead();
  await expect(page.getByText('Не удалось загрузить переписку.')).toBeVisible();
  await expect(send).toBeDisabled();
  await expect(input).toHaveValue(question);
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Загрузить снова' }).click();
  await expect(page.getByText(history[0].body, { exact: true })).toBeVisible();
  await send.click();
  await expect(page.getByText('Всего 100 гектаров.', { exact: true })).toBeVisible();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ message: question, history: [{ role: 'user', text: history[0].body }] });
});

test('detaches an unsent project draft and keeps its text after the project is deleted', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 840 });
  const project = { id: 'project-one', name: 'Весенние работы', description: '', locale: 'ru',
    createdAt: '2026-08-15T11:00:00Z', updatedAt: '2026-08-15T11:00:00Z' };
  let deleted = false;
  await page.route('**/api/gekta/account/entitlement', route => route.fulfill({ json: {} }));
  await page.route('**/api/gekta/account/projects', route => route.fulfill({ json: { projects: deleted ? [] : [project] } }));
  await page.route('**/api/gekta/account/conversations', route => route.fulfill({ json: { conversations: [] } }));
  await page.route('**/api/gekta/account/projects/project-one', route => { deleted = true; return route.fulfill({ json: {} }); });
  await page.goto('/gekta');
  const side = page.locator('aside');
  await side.getByRole('button', { name: /Весенние работы.*0/u }).click();
  const question = 'Сколько стоит посевная?';
  await page.locator('#gekta-composer-input').fill(question);
  await side.getByRole('button', { name: 'Новый диалог' }).click();
  await side.getByRole('button', { name: 'Действия с проектом: Весенние работы' }).click();
  await side.getByRole('button', { name: 'Удалить: Весенние работы' }).click();
  await side.getByRole('group', { name: 'Удалить: Весенние работы' }).getByRole('button', { name: 'Удалить' }).click();
  await expect.poll(() => deleted).toBe(true);
  await page.reload();
  await side.getByRole('button', { name: 'Черновик ' + question }).click();
  await expect(page.locator('#gekta-composer-input')).toHaveValue(question);
  const rows = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gekta-tab-drafts-v1:ru:guest')!).rows);
  expect(rows).toContainEqual(expect.objectContaining({ text: question, projectId: null }));
});

for (const recovered of [true, false]) {
  test(`keeps account drafts isolated when the short session marker expires and refresh ${recovered ? 'succeeds' : 'fails'}`, async ({ page, context, baseURL }) => {
    const owner = 'field@example.test';
    const otherOwner = 'mill@example.test';
    const privateDraft = 'Расчёт по закрытому договору';
    const guestDraft = 'Гостевой вопрос о перевозке';
    const marker = (email: string) => encodeURIComponent(JSON.stringify({ email, role: 'gekta' }));
    const setOwner = async (email: string) => {
      await context.addCookies([{ name: 'pc_session_present', value: marker(email), url: baseURL! }]);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    };
    await context.addCookies([{ name: 'pc_session_present', value: marker(owner), url: baseURL! }]);
    await page.addInitScript(({ owner, privateDraft }) => {
      if (sessionStorage.getItem('fixture-draft-seeded')) return;
      // A returning tab created on the previous version has a single legacy slot.
      sessionStorage.setItem('gekta-tab-drafts-v1:ru', JSON.stringify({ owner: 'account:' + owner, active: 'draft-home',
        rows: [{ id: 'draft-home', projectId: null, text: privateDraft }] }));
      sessionStorage.setItem('fixture-draft-seeded', '1');
    }, { owner, privateDraft });
    await page.route('**/api/gekta/account/entitlement', route => route.fulfill({ json: {} }));
    await page.route('**/api/gekta/account/conversations', route => route.fulfill({ json: { conversations: [] } }));
    await page.route('**/api/gekta/account/projects', route => route.fulfill({ json: { projects: [] } }));
    let release!: () => void;
    const waitForRefresh = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/gekta/auth/refresh', async route => {
      await waitForRefresh;
      await route.fulfill({ status: recovered ? 200 : 401, json: { ok: recovered } });
      if (recovered) {
        // Model WebKit exposing the rotated marker after the network response was delivered.
        await page.evaluate(value => {
          window.setTimeout(() => { document.cookie = 'pc_session_present=' + value + '; Path=/; SameSite=Lax'; }, 50);
        }, marker(owner));
      }
    });
    const composer = page.locator('#gekta-composer-input');
    await page.goto('/gekta');
    await expect(composer).toHaveValue(privateDraft);
    const refreshStarted = page.waitForRequest(req => req.url().endsWith('/api/gekta/auth/refresh'));
    const refreshFinished = page.waitForResponse(res => res.url().endsWith('/api/gekta/auth/refresh'));
    try {
      await context.clearCookies({ name: 'pc_session_present' });
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await refreshStarted;
      await expect(composer).toHaveValue('');
      await composer.fill(guestDraft);
    } finally { release(); }
    await refreshFinished;
    await expect(composer).toHaveValue(recovered ? privateDraft : guestDraft);
    await page.reload();
    await expect(composer).toHaveValue(recovered ? privateDraft : guestDraft);
    await setOwner(otherOwner);
    await expect(composer).toHaveValue('');
    await composer.fill('Отдельный расчёт мельницы');
    await setOwner(owner);
    await expect(composer).toHaveValue(privateDraft);
    await setOwner(otherOwner);
    await expect(composer).toHaveValue('Отдельный расчёт мельницы');
  });
}

test('keeps text typed into a new-chat link before hydration and preserves the previous draft', async ({ page }) => {
  const old = 'Ранее начатый расчёт';
  const typed = 'Сколько стоит перевозка?';
  await page.addInitScript(({ old }) => {
    sessionStorage.setItem('gekta-tab-drafts-v1:ru:guest', JSON.stringify({
      owner: 'guest', active: 'draft-existing', rows: [{ id: 'draft-existing', text: old, projectId: null }],
    }));
  }, { old });
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/_next\/static\/chunks\/.+\.js$/u, async route => { await delayed; await route.continue(); });
  const input = page.locator('#gekta-composer-input');
  try {
    await page.goto('/gekta?chat=new', { waitUntil: 'commit' });
    await input.fill(typed);
    await expect(input).toHaveValue(typed);
  } finally { release(); }
  await expect(page).not.toHaveURL(/chat=new/u);
  await expect(input).toHaveValue(typed);
  const texts = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gekta-tab-drafts-v1:ru:guest')!).rows.map((row: { text: string }) => row.text));
  expect(texts).toEqual(expect.arrayContaining([old, typed]));
});

test('protects a visible account draft when its marker expires during uninterrupted typing', async ({ page, context, baseURL }) => {
  const email = 'orchard@example.test';
  const text = 'Закрытый расчёт хозяйства';
  const marker = encodeURIComponent(JSON.stringify({ email }));
  await context.addCookies([{ name: 'pc_session_present', value: marker, url: baseURL! }]);
  await page.route('**/api/gekta/account/entitlement', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/gekta/auth/refresh', route => route.fulfill({ status: 401, json: { ok: false } }));
  await page.goto('/gekta');
  const input = page.locator('#gekta-composer-input');
  await input.fill(text);
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled();
  await context.clearCookies({ name: 'pc_session_present' });
  await input.press('End');
  await input.press('X');
  await expect(input).not.toHaveValue(new RegExp(text));
  const partitions = await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('gekta-tab-drafts-v1:ru:')));
  expect(partitions.find(([key]) => key.endsWith(':guest'))?.[1] ?? '').not.toContain(text);
  expect(partitions.find(([key]) => key.includes('account%3A'))?.[1]).toContain(text);
});

for (const condition of ['a tab returns under another account', 'another window changes account while the visible tab stays idle'] as const) {
  test(`replaces the selected history and projects when ${condition}`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1280, height: 840 });
    const marker = (email: string) => encodeURIComponent(JSON.stringify({ email }));
    let owner = 'a';
    const time = '2026-08-15T11:00:00Z';
    const row = (who: string) => ({ id: 'chat-' + who, title: 'Переписка ' + who, projectId: null, locale: 'ru', createdAt: time, updatedAt: time });
    const ownerCookie = () => context.addCookies([{ name: 'pc_session_present', value: marker(owner + '@example.test'), url: baseURL! }]);
    await ownerCookie();
    await page.route('**/api/gekta/account/entitlement', r => r.fulfill({ json: {} }));
    await page.route('**/api/gekta/account/projects', r => r.fulfill({ json: { projects: [{ id: 'project-' + owner, name: 'Проект ' + owner, locale: 'ru', createdAt: time, updatedAt: time }] } }));
    await page.route('**/api/gekta/account/conversations', r => r.fulfill({ json: { conversations: [row(owner)] } }));
    await page.route('**/api/gekta/account/conversations/chat-a', r => r.fulfill({ json: { ...row('a'), messages: [{ id: 'm-a', role: 'user', body: 'Закрытая реплика A', createdAt: time }] } }));
    await page.goto('/gekta');
    const side = page.locator('aside');
    await side.getByRole('button', { name: 'Переписка a', exact: true }).click();
    await expect(page.getByText('Закрытая реплика A', { exact: true })).toBeVisible();
    if (condition === 'a tab returns under another account') {
      owner = 'b';
      await ownerCookie();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    } else {
      const sibling = await context.newPage();
      await sibling.goto('/robots.txt');
      await page.bringToFront();
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
      owner = 'b';
      await sibling.evaluate(value => {
        document.cookie = 'pc_session_present=' + value + '; Path=/; SameSite=Lax';
      }, marker('b@example.test'));
      // Both windows share the cookie. The visible workspace receives no further input or synthetic focus.
      await expect(page.getByText('Закрытая реплика A', { exact: true })).toHaveCount(0, { timeout: 3000 });
    }
    await expect(side.getByRole('button', { name: 'Переписка b', exact: true })).toBeVisible();
    await expect(side.getByRole('button', { name: /Проект b/ }).first()).toBeVisible();
    await expect(side.getByText('Переписка a', { exact: true })).toHaveCount(0);
    await expect(side.getByText('Проект a', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Закрытая реплика A', { exact: true })).toHaveCount(0);
  });
}

for (const direction of ['Back', 'Forward'] as const) {
  test(`keeps browser ${direction} from importing another owner's restored form text`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 1280, height: 840 });
    const input = page.locator('#gekta-composer-input');
    const drafts = { a: 'Расходы хозяйства А', b: 'Черновик хозяйства Б' };
    const marker = (owner: 'a' | 'b') => encodeURIComponent(JSON.stringify({ email: owner + '@example.test' }));
    const saved = (owner: 'a' | 'b') => page.evaluate(email => {
      const key = 'gekta-tab-drafts-v1:ru:' + encodeURIComponent('account:' + email + '@example.test');
      return JSON.parse(sessionStorage.getItem(key) || '{}').rows?.[0]?.text;
    }, owner);
    const sibling = await context.newPage();
    await sibling.goto('/robots.txt');
    const switchTo = (owner: 'a' | 'b') => sibling.evaluate(value => {
      document.cookie = 'pc_session_present=' + value + '; Path=/; SameSite=Lax';
    }, marker(owner));
    await page.route('**/api/gekta/account/**', route => route.fulfill({ json: { conversations: [], projects: [] } }));
    await context.addCookies([{ name: 'pc_session_present', value: marker('b'), url: baseURL! }]);
    await page.goto('/gekta?visit=b');
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--gekta-visual-viewport-height'))).not.toBe('');
    await input.fill(drafts.b);
    await expect.poll(() => saved('b')).toBe(drafts.b);
    await page.goto('/robots.txt');
    await switchTo('a');
    await page.goto('/gekta?visit=a');
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--gekta-visual-viewport-height'))).not.toBe('');
    await input.fill(drafts.a);
    await expect.poll(() => saved('a')).toBe(drafts.a);
    if (direction === 'Back') await page.goto('/robots.txt?visit=away');
    else await page.goBack();
    await switchTo('b');
    if (direction === 'Back') await page.goBack();
    else await page.goForward();
    await expect(input).toHaveValue(drafts.b);
    await input.focus();
    await expect.poll(() => saved('b')).toBe(drafts.b);
    await expect.poll(() => saved('a')).toBe(drafts.a);
    await page.reload();
    await expect(input).toHaveValue(drafts.b);
  });
}

test('uses a single navigation surface and releases mobile modal isolation on resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gekta');
  const menu = page.getByRole('button', { name: 'Открыть историю' });
  await menu.click();
  await expect(page.getByRole('dialog', { name: 'Gekta' })).toBeVisible();

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole('dialog', { name: 'Gekta' })).toBeVisible();
  await expect(page.locator('#gekta-chat aside')).toBeHidden();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole('dialog', { name: 'Gekta', includeHidden: true })).toHaveCount(0);
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Новый диалог', exact: true })).toHaveCount(1);
  await expect(page.locator('#gekta-composer-input')).toBeEditable();
});

test('switches back to the device theme from settings and follows later device changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/gekta');
  const theme = page.locator('html');
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Открыть историю' }).click();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    return page.getByRole('dialog', { name: 'Настройки' });
  };
  let settings = await openSettings();
  await expect(settings.getByRole('radio', { name: 'Как на устройстве' })).toBeChecked();
  await settings.getByText('Светлая', { exact: true }).click();
  await expect(theme).toHaveAttribute('data-gekta-theme', 'light');
  await page.reload();
  settings = await openSettings();
  await expect(settings.getByRole('radio', { name: 'Светлая' })).toBeChecked();
  await settings.getByText('Как на устройстве', { exact: true }).click();
  await expect(theme).toHaveAttribute('data-gekta-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(theme).toHaveAttribute('data-gekta-theme', 'light');
  await expect(settings.getByRole('radio', { name: 'Как на устройстве' })).toBeChecked();
});

test('gives the full project name space and keeps rename and delete controls usable on tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const title = 'Затраты на хранение и перевозку пшеницы в ноябре';
  await page.addInitScript((name) => {
    const date = '2026-11-17T13:10:00Z';
    localStorage.setItem('gekta-projects-v1', JSON.stringify([{
      id: 'tablet-project', locale: 'ru', name, description: 'Расчёты для хозяйства', createdAt: date, updatedAt: date,
    }]));
  }, title);
  await page.goto('/gekta');
  await page.getByRole('button', { name: 'Открыть историю' }).click();
  const drawer = page.getByRole('dialog', { name: 'Gekta' });
  const heading = drawer.getByText(title, { exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('white-space', 'normal');
  await drawer.getByRole('button', { name: `Действия с проектом: ${title}` }).click();
  await drawer.getByRole('button', { name: `Переименовать: ${title}` }).click();
  const name = drawer.getByRole('textbox', { name: 'Переименовать' });
  await expect(name).toHaveValue(title);
  await name.fill('Расчёты на ноябрь');
  await name.press('Enter');
  await drawer.getByRole('button', { name: 'Действия с проектом: Расчёты на ноябрь' }).click();
  await drawer.getByRole('button', { name: 'Удалить: Расчёты на ноябрь' }).click();
  await expect(drawer.getByText(/Диалоги останутся в общей истории/u)).toBeVisible();
  await drawer.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(drawer.getByText('Расчёты на ноябрь', { exact: true })).toBeVisible();
});

test('keeps registration in the first screen when the mobile user runs out of free answers', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route('**/api/gekta/entitlement?lang=ru', (route) => route.fulfill({ json: {
    entitlement: { state: 'REGISTRATION_REQUIRED', canAsk: false, remaining: 0, limit: 10 },
    registrationUrl: '/gekta/register',
  } }));
  await page.goto('/gekta');
  const gate = page.locator('[data-gekta-composer-slot] [data-gekta-access-gate]');
  await expect(gate.getByRole('heading', { level: 1, name: 'Бесплатные ответы закончились' })).toBeVisible();
  const register = gate.getByRole('link', { name: 'Зарегистрироваться' });
  await expect(register).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-gekta-examples]')).toHaveCount(0);
  await register.click();
  await expect(page).toHaveURL(/\/gekta\/register\?lang=ru$/u);
  const tab = page.getByRole('tab', { name: 'Регистрация' });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await tab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Вход' })).toBeFocused();
  const password = page.getByLabel('Пароль', { exact: true });
  await password.fill('Synthetic-Test-42');
  await page.getByRole('button', { name: 'Показать пароль' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Скрыть пароль' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('keeps every value of a mobile answer table visible without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    const date = '2026-11-17T13:10:00Z';
    localStorage.setItem('gekta-conversations-v2', JSON.stringify([{
      id: 'table-fixture', locale: 'ru', title: 'Расчёт для пшеницы', createdAt: date, updatedAt: date,
      messages: [{ id: 'table-answer', role: 'assistant', createdAt: date, text: [
        '| Производственный сценарий | Затраты на гектар | Урожайность | Итоговая себестоимость |',
        '| --- | --- | --- | --- |',
        '| С учётом дополнительной сушки | 48 000 ₽/га | 4 т/га | 12 000 ₽/т |',
      ].join('\n') }],
    }]));
  });
  await page.goto('/gekta');
  await page.getByRole('button', { name: /Продолжить последний диалог/u }).click();
  const region = page.getByRole('region', { name: 'Таблица в ответе' });
  const table = region.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(table.getByRole('cell')).toHaveCount(4);
  const total = table.getByText('12 000 ₽/т', { exact: true });
  await total.scrollIntoViewIfNeeded();
  await expect(total).toBeInViewport({ ratio: 1 });
  const dimensions = await region.evaluate((element) => [element.scrollWidth, element.clientWidth]);
  expect(dimensions[0]).toBe(dimensions[1]);
  await expect(region).toHaveAttribute('tabindex', '0');
  await region.focus();
  await expect(region).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(table.locator('thead')).toHaveCSS('position', 'static');
  const headers = await table.getByRole('columnheader').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(new Set(headers).size).toBe(1);
});

test('restores an older failed answer as a distinct retry notice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const date = '2026-11-17T13:10:00Z';
    localStorage.setItem('gekta-conversations-v2', JSON.stringify([{
      id: 'old-failure', locale: 'ru', title: 'Затраты на сушку', createdAt: date, updatedAt: date,
      messages: [
        { id: 'question', role: 'user', text: 'Как посчитать затраты на сушку?', createdAt: date },
        { id: 'error', role: 'assistant', text: 'Ответ не получен. Проверь соединение и повтори запрос.', createdAt: date },
      ],
    }]));
  });
  await page.goto('/gekta');
  await page.getByRole('button', { name: /Продолжить последний диалог/u }).click();
  const notice = page.locator('[data-gekta-answer-notice="error"]');
  await expect(notice.getByRole('status')).toContainText('Не удалось ответить');
  await expect(notice.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await expect(page.locator('[data-gekta-message-actions]')).toHaveCount(0);
});

test('shows iPhone home-screen installation steps', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gekta');
  await page.getByRole('button', { name: 'Открыть историю' }).click();
  await page.getByRole('button', { name: 'Установить Гекту' }).click();
  const install = page.getByRole('dialog', { name: 'Установить Гекту' });
  await expect(install.getByText(/На экран „Домой“/u)).toBeVisible();
  await expect(install.getByText(/Открыть как веб-приложение/u)).toBeVisible();
});

test('publishes one app identity with localized launch URLs and correctly sized PNGs', async ({ request, page }) => {
  for (const [path, lang] of [['/gekta', 'ru'], ['/gekta/en', 'en'], ['/gekta/zh', 'zh-CN']]) {
    await page.goto(path);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const response = await request.get(href!);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/^application\/manifest\+json/u);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ id: '/gekta', start_url: path, scope: '/gekta', display: 'standalone', lang });
    if (lang === 'ru') {
      expect(manifest.icons.map(({ sizes }: { sizes: string }) => sizes)).toEqual(['192x192', '512x512']);
      expect(manifest.icons[1].purpose).toContain('maskable');
      for (const { src, sizes } of manifest.icons) {
        const icon = await request.get(src);
        expect(icon.ok()).toBe(true);
        expect(icon.headers()['content-type']).toMatch(/^image\/png/u);
        const body = await icon.body();
        const size = Number(sizes.split('x')[0]);
        expect(body.readUInt32BE(16)).toBe(size);
        expect(body.readUInt32BE(20)).toBe(size);
      }
    }
  }
});

test('keeps separate unsent questions through new chat, search and reload', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 735 });
  await page.goto('/gekta');
  const input = page.locator('#gekta-composer-input');
  const menu = page.getByRole('button', { name: 'Открыть историю' });
  const drawer = page.getByRole('dialog', { name: 'Gekta', exact: true });
  await menu.click();
  await expect(drawer.getByRole('searchbox')).toHaveCount(0);
  await expect(drawer.getByRole('heading', { name: /Диалоги|Проекты/ })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Новый проект' }).click();
  await expect(drawer.getByPlaceholder('Название проекта')).toBeFocused();
  await drawer.getByRole('button', { name: 'Отмена' }).click();
  await page.keyboard.press('Escape');

  const first = 'Два поля, 137,5 га\nРасход 23 л/га, цена 67,40 ₽.';
  const second = 'Склад 2: пшеница 340 т, влажность 14,6%.';
  await input.fill(first);
  await page.locator('[data-gekta-header-new-chat]').click();
  await expect(input).toHaveValue('');
  await input.fill(second);
  await page.reload();
  await expect(input).toHaveValue(second);
  await menu.click();
  const search = drawer.getByRole('searchbox');
  await search.fill('137,5');
  await expect(drawer.getByRole('button', { name: /^Черновик.*Склад/ })).toHaveCount(0);
  await drawer.getByRole('button', { name: /^Черновик.*Два поля/ }).click();
  await expect(input).toHaveValue(first);
  await page.reload();
  await expect(input).toHaveValue(first);
  await menu.click();
  await drawer.getByRole('button', { name: /^Черновик.*Склад/ }).click();
  await expect(input).toHaveValue(second);
});

test('restores the right draft and messages when two existing conversations are switched and reloaded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (localStorage.getItem('gekta-conversations-v2')) return;
    const date = '2026-10-01T10:00:00Z';
    const rows = [['field', 'Поле 18'], ['store', 'Склад 7']].map(([id, title]) => ({
      id, locale: 'ru', title, createdAt: date, updatedAt: date,
      messages: [{ id: id + '-answer', role: 'assistant', text: 'Ответ — ' + title, createdAt: date }],
    }));
    localStorage.setItem('gekta-conversations-v2', JSON.stringify(rows));
  });
  await page.goto('/gekta');
  const input = page.locator('#gekta-composer-input');
  const menu = page.getByRole('button', { name: 'Открыть историю' });
  const drawer = page.getByRole('dialog', { name: 'Gekta', exact: true });
  const openConversation = async (name: string) => {
    await menu.click();
    await drawer.getByRole('button', { name, exact: true }).click();
    await expect(page.getByText('Ответ — ' + name, { exact: true })).toBeVisible();
    await expect(page.locator('[data-gekta-consent="true"]')).toHaveCount(0);
  };
  await openConversation('Поле 18');
  await input.fill('Урожай 4,3 т/га\nПлощадь 96 га');
  await openConversation('Склад 7');
  await expect(input).toHaveValue('');
  await input.fill('Сушка 310 т по 720 ₽/т');
  await page.reload();
  await expect(page.getByText('Ответ — Склад 7', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('Сушка 310 т по 720 ₽/т');
  await openConversation('Поле 18');
  await expect(input).toHaveValue('Урожай 4,3 т/га\nПлощадь 96 га');
  await input.press('Enter');
  await expect(page.locator('[data-gekta-consent="true"]')).toBeVisible();
  await expect(input).toHaveValue('Урожай 4,3 т/га\nПлощадь 96 га');
});

test('undoes a starter after reload and isolates drafts between languages', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 735 });
  await page.goto('/gekta');
  const input = page.locator('#gekta-composer-input');
  const original = 'Кукуруза 280 т\nЦена 14 700 ₽/т, перевозка 590 ₽/т.';
  await input.fill(original);
  await page.locator('[data-gekta-starter]').first().click();
  await expect(input).not.toHaveValue(original);
  await page.reload();
  const undo = page.getByRole('button', { name: 'Вернуть свой текст' });
  await undo.click();
  await expect(input).toHaveValue(original);
  await expect(undo).toHaveCount(0);
  await page.goto('/gekta/en');
  await expect(input).toHaveValue('');
  await input.fill('Estimate storage for 240 tons.');
  await page.goto('/gekta');
  await expect(input).toHaveValue(original);
  await page.goto('/gekta/en');
  await expect(input).toHaveValue('Estimate storage for 240 tons.');
});

test('fits the question, starters and documents link on the first screen and opens the localized documents', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 735 });
  for (const [route, title, docs, back] of [
    ['/gekta', 'О Гекте', 'Документы и условия', 'К диалогу'],
    ['/gekta/en', 'About Gekta', 'Documents and terms', 'Back to chat'],
    ['/gekta/zh', '关于 Gekta', '文件与条款', '返回对话'],
  ]) {
    await page.goto(route);
    const input = page.locator('#gekta-composer-input');
    const info = page.getByRole('link', { name: title, exact: true });
    const documents = page.getByRole('link', { name: docs, exact: true });
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(page.locator('[data-gekta-starter]:visible')).toHaveCount(2);
    await expect(info).toBeInViewport({ ratio: 1 });
    await expect(documents).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await input.fill('37.5');
    await documents.click();
    await expect(page).toHaveURL(new RegExp(route + '/about#documents$'));
    await expect(page.locator('#documents')).toBeInViewport();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toHaveCount(1);
    await page.getByRole('link', { name: back, exact: true }).first().click();
    await expect(input).toHaveValue('37.5');
  }
});

test('keeps a newly chosen field before the drawer restores its opener on the next frame', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 735 });
  await page.goto('/gekta');
  await page.getByRole('button', { name: 'Открыть историю' }).click();
  const close = page.locator('[data-gekta-mobile-drawer-panel]').getByRole('button', { name: 'Закрыть историю' });
  await expect(close).toBeFocused();
  await expect(page.getByRole('button', { name: 'Закрыть историю' })).toHaveCount(1);
  const input = page.locator('#gekta-composer-input');

  // Select the question field as soon as the drawer releases the background, before the deferred return.
  await input.evaluate(field => {
    const background = field.closest('[inert]');
    if (!background) throw new Error('Expected a modal drawer');
    const observe = new MutationObserver(() => {
      if (field.closest('[inert]')) return;
      observe.disconnect();
      field.focus();
    });
    observe.observe(background, { attributes: true, attributeFilter: ['inert'] });
  });
  await page.keyboard.press('Escape');
  await expect(close).toHaveCount(0);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(input).toBeFocused({ timeout: 2500 });
  await page.keyboard.insertText('Поле 137,5 га');
  await expect(input).toHaveValue('Поле 137,5 га');
});

for (const [lang, width, path, open] of [
  ['ru', 320, '/gekta', 'Открыть Гекту'],
  ['en', 390, '/gekta/en', 'Open Gekta'],
  ['zh', 430, '/gekta/zh', '打开 Gekta'],
] as const) {
  test('opens the standalone chat directly from the platform in ' + lang, async ({ page }) => {
    await page.setViewportSize({ width, height: 735 });
    await page.goto('/platform-v7?lang=' + lang);
    const header = page.locator('[data-public-site-header="canonical"]');
    const menu = header.locator('details > summary');
    const target = await menu.boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(48);
    expect(target?.width).toBeGreaterThanOrEqual(48);
    await menu.click();
    const register = header.locator('details[open] .pc-site-mobile-utility a[href*="/register"]');
    await expect(register).toBeVisible();
    expect(await register.evaluate(a => a.scrollWidth <= a.clientWidth && a.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await menu.click();
    const quickLink = page.locator('.pc-cp-gekta-strip').getByRole('link', { name: open, exact: true });
    await expect(quickLink).toHaveAttribute('href', path);
    await quickLink.click();
    await expect(page.locator('#gekta-composer-input')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(path + '$'));

    await page.goto('/platform-v7/gekta?lang=' + lang);
    const entry = page.locator('.pc-cp-gekta-public-hero').getByRole('link', { name: open, exact: true });
    await expect(entry).toHaveAttribute('href', path);
    await entry.click();
    await expect(page.locator('#gekta-composer-input')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(path + '$'));
  });
}
