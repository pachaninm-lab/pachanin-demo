import { expect, test, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { ACCEPTANCE_PASSWORD, ACCEPTANCE_TOTP_SECRET, acceptanceEmail, loginAs, totp, type CabinetRole } from './support/acceptance-login';


const AUTHORITY_AHASH: Record<string,{hash:string;maxDistance:number}> = {
  '01-home-desktop': { hash:'ffffffff1fff7ffd17f7f5e01ffcffff23ffffffff00c0000000fffff1f1ff00', maxDistance:90 },
  '02-home-mobile': { hash:'7ff1ffffd3ffe1fffffce020f13cffff807fffff87ff8001ffffdfffffff9b6f', maxDistance:125 },
  '03-market-desktop': { hash:'3ddcfffffffffffffffff8f3f0f000b0ffffffffffff000000000000ffff8cc5', maxDistance:130 },
  '04-lot-desktop': { hash:'3ffc0800000005ef05ff07ff07ff07ff07e0ffffffffffffffffffffffffffff', maxDistance:135 },
  '05-deal-desktop': { hash:'1ff8cff01fdf1ff7e3ffe7ffff21a9e8ef68f9efbfffe3fceda8fff80bfd1fff', maxDistance:130 },
  '06-deal-mobile': { hash:'3fff80ff807f07ff83ff03ffffffcfffdfffdfffffff00008000ffffffffffff', maxDistance:125 },
  '06-market-mobile': { hash:'bfffafffffffffff83ff01ff83ff83ff03ff03ff01ff01ff03ff83ff01ffffff', maxDistance:115 },
  '07-how-it-works-desktop': { hash:'32b8ffd83f38fffffffffeafefffffffffedfae7ff955fffffffffffffff0000', maxDistance:90 },
  '08-trust-desktop': { hash:'0038ffff7fdf3e97fc303c0084ffffffbff7ffff8001fffffffffffffffff5ed', maxDistance:95 },
  '09-gekta-desktop': { hash:'00fc0003000000000000ffffffffffffffffffffffffffffffffffffffffffff', maxDistance:65 },
};

function hammingHex(left:string,right:string){
  const a=BigInt(`0x${left}`), b=BigInt(`0x${right}`);
  let n=a^b,count=0;
  while(n){count+=Number(n&1n);n>>=1n;}
  return count;
}

async function averageHashFromPng(page:import('@playwright/test').Page,png:Buffer){
  const base64=png.toString('base64');
  return page.evaluate(async (encoded)=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) throw new Error('2d canvas unavailable');
    ctx.drawImage(bitmap,0,0,16,16);
    const data=ctx.getImageData(0,0,16,16).data;
    const gray:number[]=[];
    for(let i=0;i<data.length;i+=4) gray.push(Math.round(data[i]*.299+data[i+1]*.587+data[i+2]*.114));
    const mean=gray.reduce((a,b)=>a+b,0)/gray.length;
    let bits=0n;
    for(const value of gray) bits=(bits<<1n)|(value>mean?1n:0n);
    return bits.toString(16).padStart(64,'0');
  },base64);
}

const targets = [
  { name: '01-home-desktop', path: '/platform-v7?lang=ru', width: 1055, height: 1491, ready: '[data-testid="platform-v7-root-execution-cockpit"]' },
  { name: '02-home-mobile', path: '/platform-v7?lang=ru', width: 432, height: 768, ready: '[data-testid="platform-v7-root-execution-cockpit"]' },
  { name: '03-market-desktop', path: '/platform-v7/market?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '04-lot-desktop', path: '/platform-v7/market?lang=ru&lot=0', width: 1448, height: 1086, ready: '[data-testid="canonical-public-lot-view"]' },
  { name: '04-lot-mobile', path: '/platform-v7/market?lang=ru&lot=0', width: 430, height: 932, ready: '[data-testid="canonical-public-lot-view"]' },
  { name: '06-market-mobile', path: '/platform-v7/market?lang=ru', width: 430, height: 932, ready: 'main h1' },
  { name: '05-deal-desktop', path: '/platform-v7/deal-flow?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '06-deal-mobile', path: '/platform-v7/deal-flow?lang=ru', width: 430, height: 932, ready: 'main h1' },
  { name: '07-how-it-works-desktop', path: '/platform-v7/how-it-works?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '08-trust-desktop', path: '/platform-v7/trust?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '09-gekta-desktop', path: '/platform-v7/gekta?lang=ru', width: 1672, height: 941, ready: 'main h1' },
] as const;

// A 200 login page is not evidence for the requested public screen. This
// comparison validates test navigation only; it grants no runtime access.
function matchesPublicRoute(observedUrl: string, expectedUrl: URL): boolean {
  try {
    const observed = new URL(observedUrl);
    const expected = new URL(expectedUrl.href);
    if (observed.username || observed.password) return false;
    observed.searchParams.sort();
    expected.searchParams.sort();
    return observed.href === expected.href;
  } catch {
    return false;
  }
}

async function expectPublicRoute(
  page: Page,
  requestedPath: string,
  baseURL: string | undefined,
  ready = 'main h1',
): Promise<void> {
  if (!baseURL) throw new Error('Canonical visual acceptance requires an explicit baseURL');
  const expected = new URL(requestedPath, baseURL);
  await expect(page, `Wrong public route or query context for ${requestedPath}`)
    .toHaveURL((url) => matchesPublicRoute(url.href, expected));
  await expect(page.locator(ready).first()).toBeVisible();
  // Content readiness must not conceal a client-side redirect after navigation.
  expect(matchesPublicRoute(page.url(), expected), `Route changed while rendering ${requestedPath}`).toBe(true);
}

test.describe('public route evidence identity', () => {
  const baseURL = 'http://127.0.0.1:3000';
  const expected = new URL('/platform-v7/market?lang=zh&lot=0', baseURL);
  const cases = [
    { name: 'exact route', url: expected.href, accepted: true },
    { name: 'query key order', url: `${baseURL}/platform-v7/market?lot=0&lang=zh`, accepted: true },
    { name: 'login redirect', url: `${baseURL}/platform-v7/login?next=%2Fplatform-v7%2Fmarket`, accepted: false },
    { name: 'login with preserved context', url: `${baseURL}/platform-v7/login?lang=zh&lot=0`, accepted: false },
    { name: 'different public page', url: `${baseURL}/platform-v7/trust?lang=zh&lot=0`, accepted: false },
    { name: 'missing locale', url: `${baseURL}/platform-v7/market?lot=0`, accepted: false },
    { name: 'wrong locale', url: `${baseURL}/platform-v7/market?lang=ru&lot=0`, accepted: false },
    { name: 'missing zero lot', url: `${baseURL}/platform-v7/market?lang=zh`, accepted: false },
    { name: 'different lot', url: `${baseURL}/platform-v7/market?lang=zh&lot=1`, accepted: false },
    { name: 'duplicate locale', url: `${baseURL}/platform-v7/market?lang=zh&lang=ru&lot=0`, accepted: false },
    { name: 'duplicate lot', url: `${baseURL}/platform-v7/market?lang=zh&lot=0&lot=0`, accepted: false },
    { name: 'unexpected query', url: `${baseURL}/platform-v7/market?lang=zh&lot=0&role=bank`, accepted: false },
    { name: 'different origin', url: 'http://localhost:3000/platform-v7/market?lang=zh&lot=0', accepted: false },
    { name: 'different port', url: 'http://127.0.0.1:3001/platform-v7/market?lang=zh&lot=0', accepted: false },
    { name: 'different scheme', url: 'https://127.0.0.1:3000/platform-v7/market?lang=zh&lot=0', accepted: false },
    { name: 'URL credentials', url: 'http://fixture@127.0.0.1:3000/platform-v7/market?lang=zh&lot=0', accepted: false },
    { name: 'unexpected fragment', url: `${expected.href}#unverified`, accepted: false },
    { name: 'malformed URL', url: 'not a URL', accepted: false },
  ] as const;
  for (const item of cases) {
    test(item.name, () => {
      expect(matchesPublicRoute(item.url, expected)).toBe(item.accepted);
    });
  }
  test('allows the login screen only when that screen was requested', () => {
    const login = new URL('/platform-v7/login?lang=en', baseURL);
    expect(matchesPublicRoute(login.href, login)).toBe(true);
    expect(matchesPublicRoute(expected.href, login)).toBe(false);
  });
});

test.describe('canonical visual authority evidence', () => {
  test.setTimeout(180_000);

  for (const target of targets) {
    test(`${target.name} visual evidence`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize({ width: target.width, height: target.height });
      const runtimeFailures: string[] = [];
      page.on('pageerror', (error) => runtimeFailures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });

      const response = await page.goto(target.path, { waitUntil: 'networkidle' });
      expect(response?.status(), `${target.path} should return 200`).toBe(200);
      await expectPublicRoute(page, target.path, baseURL, target.ready);

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);

      const serious = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const blocking = serious.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      expect(runtimeFailures).toEqual([]);

      const png=await page.screenshot({
        path: testInfo.outputPath(`${target.name}.png`),
        fullPage: false,
        animations: 'disabled',
      });
      const authority=AUTHORITY_AHASH[target.name];
      // Perceptual authority is Chromium-only. Other engines retain the same
      // route/runtime/a11y/overflow evidence without engine-specific pixel hashing.
      if(authority && (!testInfo.project.name || /chromium/i.test(testInfo.project.name))){
        const observed=await averageHashFromPng(page,png);
        const distance=hammingHex(authority.hash,observed);
        expect(distance,`${target.name} perceptual drift ${distance} > ${authority.maxDistance}; authority=${authority.hash} observed=${observed}`).toBeLessThanOrEqual(authority.maxDistance);
      }
    });
  }
  const responsiveWidths = [320, 375, 390, 768, 1280, 1440] as const;
  for (const width of responsiveWidths) {
    test(`responsive contract ${width}px`, async ({ page, baseURL }) => {
      const height = width === 320 ? 700 : width <= 390 ? 844 : width <= 768 ? 1024 : 900;
      await page.setViewportSize({ width, height });
      for (const route of [
        '/platform-v7?lang=ru',
        '/platform-v7/market?lang=ru',
        '/platform-v7/market?lang=ru&lot=0',
        '/platform-v7/how-it-works?lang=ru',
        '/platform-v7/trust?lang=ru',
        '/platform-v7/gekta?lang=ru',
      ]) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${route} should return 200 at ${width}px`).toBe(200);
        await expectPublicRoute(page, route, baseURL, targets.find((target) => target.path === route)?.ready);
        if (width === 320 && route === '/platform-v7?lang=ru') {
          await page.evaluate(() => document.fonts.ready);
          const heading = page.locator('#pc-cp-home-title');
          await expect(heading).toBeVisible();
          const renderedLines = await heading.evaluate((node) => {
            const tops: number[] = [];
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let current = walker.nextNode();
            while (current) {
              if (current.textContent?.trim()) {
                const range = document.createRange();
                range.selectNodeContents(current);
                for (const rect of Array.from(range.getClientRects())) {
                  if (rect.width > 0 && rect.height > 0 && !tops.some((top) => Math.abs(top - rect.top) <= 1)) tops.push(rect.top);
                }
              }
              current = walker.nextNode();
            }
            return tops.length;
          });
          expect(renderedLines, '320px homepage H1 rendered lines').toBeGreaterThanOrEqual(1);
          expect(renderedLines, '320px homepage H1 rendered lines').toBeLessThanOrEqual(5);
          const primary = page.locator('.pc-cp-hero .pc-cp-actions a[href*="intent=sell"]').first();
          await expect(primary).toBeVisible();
          const box = await primary.boundingBox();
          expect(box, '320x700 primary CTA bounds').not.toBeNull();
          expect(box!.y, '320x700 primary CTA top').toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height, '320x700 primary CTA bottom').toBeLessThanOrEqual(701);
        }
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ));
        expect(overflow, `${route} horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }

  for (const locale of ['ru', 'en', 'zh'] as const) {
    test(`public locale ${locale} remains layout-safe on mobile`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of [
        '/platform-v7',
        '/platform-v7/market',
        '/platform-v7/how-it-works',
        '/platform-v7/trust',
        '/platform-v7/gekta',
        '/platform-v7/ai-in-action',
        '/platform-v7/register',
        '/platform-v7/login',
        '/platform-v7/about',
        '/platform-v7/contact',
      ]) {
        const separator = route.includes('?') ? '&' : '?';
        const requestedPath = `${route}${separator}lang=${locale}`;
        const response = await page.goto(requestedPath, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${route} should return 200 for ${locale}`).toBe(200);
        await expectPublicRoute(page, requestedPath, baseURL);
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ));
        expect(overflow, `${route} ${locale} horizontal overflow`).toBeLessThanOrEqual(1);
      }
    });
  }

});

// CORE handoff PRODUCT-CAPABILITIES-ROUTE-AUTHORITY admits only this exact
// informational route. These reads never create an authenticated role/session.
test.describe('capabilities exact public route boundary', () => {
  const headings = {
    ru: 'Всё, что нужно для работы со сделкой',
    en: 'What you need to work on a Deal',
    zh: '处理交易所需的各项任务',
  } as const;

  for (const locale of ['ru', 'en', 'zh'] as const) {
    test(`capabilities is public and mobile-safe in ${locale}`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const route = `/platform-v7/capabilities?lang=${locale}`;
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await expectPublicRoute(page, route, baseURL);
      await expect(page.locator('main h1')).toHaveText(headings[locale]);
      expect(await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ))).toBeLessThanOrEqual(1);
      const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(report.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious')).toEqual([]);
    });

    test(`primary navigation retains capabilities locale ${locale}`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const home = `/platform-v7?lang=${locale}`;
      await page.goto(home, { waitUntil: 'networkidle' });
      await expectPublicRoute(page, home, baseURL);
      const route = `/platform-v7/capabilities?lang=${locale}`;
      await page.locator(`header a[href="${route}"]`).first().click();
      await expectPublicRoute(page, route, baseURL);
      await expect(page.locator('main h1')).toHaveText(headings[locale]);
      await page.goBack();
      await expectPublicRoute(page, home, baseURL);
    });
  }

  for (const route of [
    '/platform-v7/capabilities/private',
    '/platform-v7/capabilities/nested/path',
    '/platform-v7/capabilities-unadmitted',
    '/platform-v7/bank',
    '/platform-v7/seller',
    '/platform-v7/profile',
    '/platform-v7/deals/capability-boundary-fixture/execution',
  ]) {
    test(`exact public admission does not authorize ${route}`, async ({ request, baseURL }) => {
      if (!baseURL) throw new Error('Explicit acceptance origin required');
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const target = new URL(response.headers().location, baseURL);
      expect(target.origin).toBe(new URL(baseURL).origin);
      expect(target.pathname).toBe('/platform-v7/login');
      expect(target.searchParams.get('next')).toBe(route);
    });
  }

  for (const route of ['/api/proxy/deals', '/api/proxy/settlement']) {
    test(`public page admission leaves unauthenticated ${route} closed`, async ({ request }) => {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ ok: false, message: 'unauthenticated' });
    });
  }

  test('public presentation role parameters do not create authenticated cabinet access', async ({ page, baseURL }) => {
    const publicRoute = '/platform-v7/capabilities?lang=ru&as=bank&tenantId=capability-boundary-fixture';
    await page.goto(publicRoute, { waitUntil: 'networkidle' });
    await expectPublicRoute(page, publicRoute, baseURL);
    await page.goto('/platform-v7/bank');
    await expect(page).toHaveURL((url) => url.pathname === '/platform-v7/login' && url.searchParams.get('next') === '/platform-v7/bank');
  });
});


const ACCEPTANCE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || '';
const CANONICAL_ROLE_ROUTES: ReadonlyArray<readonly [CabinetRole, string]> = [
  ['operator', '/platform-v7/operator'],
  ['buyer', '/platform-v7/buyer'],
  ['seller', '/platform-v7/seller'],
  ['logistics', '/platform-v7/logistics'],
  ['driver', '/platform-v7/driver'],
  ['surveyor', '/platform-v7/surveyor'],
  ['elevator', '/platform-v7/elevator'],
  ['lab', '/platform-v7/lab'],
  ['bank', '/platform-v7/bank'],
  ['arbitrator', '/platform-v7/arbitrator'],
  ['compliance', '/platform-v7/compliance'],
  ['executive', '/platform-v7/executive'],
];

async function canonicalNoOverflow(page: Page) {
  expect(await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ))).toBeLessThanOrEqual(1);
}

async function canonicalHeaderTargets(page: Page) {
  const header=page.locator('[data-public-site-header="canonical"]');
  if(await header.count()===0) return;
  await expect(header).toBeVisible();
  const viewport=page.viewportSize();
  const mobile=Boolean(viewport&&viewport.width<=768);
  for(const control of await header.locator('a:visible, summary:visible').all()){
    const box=await control.boundingBox();
    expect(box,'canonical header visible control').not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(43.999);
    if(mobile) expect(box!.width).toBeGreaterThanOrEqual(43.999);
    if(viewport){
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+1);
    }
  }
}

async function canonicalA11y(page: Page) {
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(report.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious')).toEqual([]);
}

async function rotateCabinetRole(page: Page, role: CabinetRole, baseURL: string) {
  await page.goto('about:blank', { waitUntil: 'load' });
  await loginAs(page, role, baseURL);
}

// This fixture is confined to the existing disposable PostgreSQL matrix. Each
// browser gets its own ordinary ACCOUNTING identity, preserving the empty-bank
// fixture and avoiding shared MFA replay state across parallel browser projects.
async function seedReadyBankJourney(baseURL: string) {
  const origin = new URL(baseURL);
  const database = new URL(process.env.DATABASE_URL || '');
  if (origin.protocol !== 'https:' || !['localhost', '127.0.0.1'].includes(origin.hostname)
    || origin.username || origin.password
    || !['postgres:', 'postgresql:'].includes(database.protocol)
    || !['localhost', '127.0.0.1', 'postgres'].includes(database.hostname)
    || database.pathname !== '/dsv8_acceptance') {
    throw new Error('READY bank fixtures require the localhost TLS/disposable dsv8_acceptance PostgreSQL matrix');
  }
  const apiRequire = createRequire(resolve(process.cwd(), '../api/package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  const bcrypt = apiRequire('bcryptjs');
  const { encryptMfaSecret } = apiRequire('./dist/apps/api/src/modules/auth/auth-crypto.js');
  const prisma = new PrismaClient();
  const email = `dsv8.ready-bank.${randomUUID()}@acceptance.invalid`;
  const dealId = `dsv8-ready-bank-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(ACCEPTANCE_PASSWORD, 10);
  const inn = () => {
    const digits = String(100000000n + BigInt(`0x${randomUUID().replaceAll('-', '')}`) % 900000000n);
    const checksum = [2, 4, 10, 3, 5, 9, 4, 6, 8]
      .reduce((sum, weight, index) => sum + weight * Number(digits[index]), 0);
    return `${digits}${(checksum % 11) % 10}`;
  };
  try {
    return await prisma.$transaction(async (tx: typeof prisma) => {
      const bank = await tx.organization.create({ data: {
        inn: inn(), name: 'Acceptance READY bank', type: 'LEGAL',
        status: 'VERIFIED', kycStatus: 'APPROVED', verifiedAt: new Date(),
      } });
      const seller = await tx.organization.create({ data: {
        inn: inn(), name: 'Acceptance READY seller', type: 'LEGAL',
        status: 'VERIFIED', kycStatus: 'APPROVED', verifiedAt: new Date(), tenantId: bank.tenantId,
      } });
      const buyer = await tx.organization.create({ data: {
        inn: inn(), name: 'Acceptance READY buyer', type: 'LEGAL',
        status: 'VERIFIED', kycStatus: 'APPROVED', verifiedAt: new Date(), tenantId: bank.tenantId,
      } });
      const user = await tx.user.create({ data: {
        email, passwordHash, fullName: 'Acceptance READY bank user', status: 'ACTIVE',
      } });
      await tx.userOrg.create({ data: {
        userId: user.id, organizationId: bank.id, role: 'ACCOUNTING',
        status: 'ACTIVE', isDefault: true, isOrgAdmin: false, activatedAt: new Date(),
      } });
      const { ciphertext, keyVersion } = encryptMfaSecret(ACCEPTANCE_TOTP_SECRET);
      await tx.$executeRawUnsafe(
        'INSERT INTO auth.credential_states (user_id, mfa_enabled, mfa_secret_ciphertext, mfa_key_version) VALUES ($1, TRUE, $2, $3)',
        user.id, ciphertext, keyVersion,
      );
      await tx.deal.create({ data: {
        id: dealId, tenantId: bank.tenantId, sellerOrgId: seller.id, buyerOrgId: buyer.id,
        status: 'DRAFT', currency: 'RUB',
      } });
      await tx.dealParticipant.create({ data: {
        dealId, tenantId: bank.tenantId, organizationId: bank.id, userId: user.id,
        role: 'ACCOUNTING', accessLevel: 'READ', status: 'ACTIVE',
      } });
      return { email, dealId, organizationId: bank.id, tenantId: bank.tenantId };
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function loginReadyBankJourney(page: Page, email: string, baseURL: string) {
  const context = page.context();
  let authenticated = false;
  for (let attempt = 0; attempt < 3 && !authenticated; attempt += 1) {
    if (attempt) await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
    await context.clearCookies();
    await page.goto('/platform-v7/login', { waitUntil: 'load' });
    const csrf = async () => {
      const value = (await context.cookies(baseURL)).find((cookie) => cookie.name === 'pc_csrf_token')?.value;
      expect(value, 'ordinary login must receive the middleware CSRF cookie').toBeTruthy();
      return value!;
    };
    const login = await context.request.post('/api/auth/login', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': await csrf() },
      data: { email, password: ACCEPTANCE_PASSWORD },
    });
    expect(login.status()).toBeLessThan(400);
    const passwordSession = await login.json();
    expect(passwordSession.ok).toBe(true);
    expect(passwordSession.mfaRequired, 'ordinary ACCOUNTING login needs only the password').not.toBe(true);
    const passwordIdentity = await context.request.get('/api/auth/me');
    expect(passwordIdentity.status()).toBe(200);
    expect((await passwordIdentity.json()).mfaVerified).toBe(false);
    const start = await context.request.post('/api/auth/mfa-step-up/start', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': await csrf() }, data: {},
    });
    expect(start.status(), 'authenticated protected-action MFA start').toBeLessThan(400);
    expect((await start.json()).ok).toBe(true);
    const verify = await context.request.post('/api/auth/mfa-step-up/verify', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': await csrf() },
      data: { code: totp(ACCEPTANCE_TOTP_SECRET) },
    });
    authenticated = verify.status() < 400 && (await verify.json()).mfaVerified === true;
  }
  expect(authenticated, 'server-proved action MFA for isolated READY bank user').toBe(true);
  const protectedIdentity = await context.request.get('/api/auth/me');
  expect(protectedIdentity.status()).toBe(200);
  expect((await protectedIdentity.json()).mfaVerified).toBe(true);
  const names = (await context.cookies(baseURL)).map((cookie) => cookie.name);
  expect(names).toContain('pc_v7_cabinet');
  expect(names).toContain('pc_access_token');
}

test.describe('canonical protected cabinet boundary', () => {
  const operatorRoute = '/platform-v7/operator';

  test('anonymous and forged sessions never enter protected cabinet', async ({ page, baseURL }) => {
    test.skip(!baseURL?.startsWith('https://'), 'Protected cabinet authority runs in the Design System acceptance matrix.');
    await page.context().clearCookies();
    await page.goto(operatorRoute, { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/platform-v7\/login/);
    await expect(page.locator('.pc-shell-root-v4')).toHaveCount(0);

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      cab: 'operator', sub: 'forged-user', membership: 'forged-membership',
      org: 'forged-org', tenant: 'forged-tenant', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    await page.context().addCookies([{
      name: 'pc_v7_cabinet',
      value: `${header}.${payload}.${Buffer.from('forged-signature').toString('base64url')}`,
      url: baseURL!,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
    await page.goto(operatorRoute, { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/platform-v7\/login/);
    await expect(page.locator('.pc-shell-root-v4')).toHaveCount(0);
  });

  test('verified operator enters and valid FARMER remains role-bounded', async ({ page, baseURL }) => {
    test.skip(!baseURL?.startsWith('https://'), 'Protected login authority runs in the TLS Design System acceptance workflow.');
    const loginBase = baseURL!;
    await loginAs(page, 'operator', loginBase);
    expect((await page.goto(operatorRoute, { waitUntil: 'load' }))?.status()).toBe(200);
    await expect(page.locator('.pc-shell-root-v4')).toBeVisible();

    await rotateCabinetRole(page, 'seller', loginBase);
    await page.goto(operatorRoute, { waitUntil: 'load' });
    await expect(page).not.toHaveURL(new RegExp(`${operatorRoute}$`));
  });

  test('verified buyer sees the server-scoped home in each locale', async ({ page, baseURL }) => {
    test.skip(!baseURL?.startsWith('https://'), 'Protected login authority runs in the TLS Design System acceptance workflow.');
    test.setTimeout(180_000);
    await loginAs(page, 'buyer', baseURL!);

    const copy = {
      ru: { description: 'Сервер проверяет доступ к сделкам для роли покупателя', ready: 'сервер подтверждён', empty: 'очередь пуста', unknown: 'Следующее обязательное действие не опубликовано', emptyTitle: 'Рабочих объектов пока нет' },
      en: { description: 'The server checks Deal access for the buyer role', ready: 'server confirmed', empty: 'queue is empty', unknown: 'Required next action is not published', emptyTitle: 'No work objects yet' },
      zh: { description: '服务器会核查买方角色的交易访问权限', ready: '服务器已确认', empty: '队列为空', unknown: '服务器未提供优先执行的操作', emptyTitle: '暂时没有工作对象' },
    } as const;
    for (const [locale, expected] of Object.entries(copy)) {
      const response = await page.goto(`/platform-v7/buyer?lang=${locale}`, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${locale} buyer route`).toBe(200);
      const workspace = page.getByTestId('p0-first-customer-workspace-buyer');
      await expect(workspace).toBeVisible();
      await expect(workspace).toContainText(expected.description);
      const header = workspace.locator(':scope > header');
      const confirmed = header.getByText(expected.ready, { exact: true });
      const empty = header.getByText(expected.empty, { exact: true });
      await expect(confirmed.or(empty)).toBeVisible();
      await expect(workspace.locator('a[href^="/platform-v7/profile/team"]'))
        .toHaveAttribute('href', `/platform-v7/profile/team?lang=${locale}`);
      if (await confirmed.isVisible()) {
        await expect(workspace.getByRole('heading', { name: expected.unknown })).toBeVisible();
        await expect(workspace.getByText('UNKNOWN', { exact: true })).toBeVisible();
        const dealLinks = workspace.locator('#first-customer-work-queue a[href^="/platform-v7/deals/"]');
        await expect(dealLinks).not.toHaveCount(0);
        for (const dealLink of await dealLinks.all()) {
          await expect(dealLink).toHaveAttribute('href', new RegExp(`\\?lang=${locale}$`));
        }
      } else {
        await expect(workspace.getByRole('heading', { name: expected.emptyTitle })).toBeVisible();
        await expect(workspace.locator('a[href^="/platform-v7/profile?"]'))
          .toHaveAttribute('href', `/platform-v7/profile?lang=${locale}`);
      }
      await expect(page.locator('[data-transaction-role-cockpit]')).toHaveCount(0);
      await canonicalNoOverflow(page);
      await workspace.locator('a[href^="/platform-v7/profile/team"]').click();
      await expect(page).toHaveURL(new RegExp(`/platform-v7/profile/team\\?lang=${locale}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }
  });

  test('seeded bank sees an honest empty home on mobile in each locale', async ({ page, baseURL }) => {
    test.skip(!baseURL?.startsWith('https://'), 'Protected login authority runs in the TLS Design System acceptance workflow.');
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'bank', baseURL!);

    const copy = {
      ru: { description: 'Сервер проверяет роль банковского кабинета и доступ к сделкам', empty: 'очередь пуста', unknown: 'Банковские факты — UNKNOWN', emptyTitle: 'Рабочих объектов пока нет' },
      en: { description: 'The server checks the bank cabinet role and access to Deals', empty: 'queue is empty', unknown: 'Bank facts — UNKNOWN', emptyTitle: 'No work objects yet' },
      zh: { description: '服务器会核查银行工作台角色和交易访问权限', empty: '队列为空', unknown: '银行事实 — UNKNOWN', emptyTitle: '暂时没有工作对象' },
    } as const;
    for (const [locale, expected] of Object.entries(copy)) {
      const response = await page.goto(`/platform-v7/bank?lang=${locale}`, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${locale} bank route`).toBe(200);
      const workspace = page.getByTestId('p0-first-customer-workspace-bank');
      await expect(workspace).toBeVisible();
      await expect(workspace).toContainText(expected.description);
      await expect(workspace.getByText(expected.unknown, { exact: true })).toBeVisible();
      const header = workspace.locator(':scope > header');
      await expect(header.getByText(expected.empty, { exact: true })).toBeVisible();
      await expect(workspace.getByRole('heading', { name: expected.emptyTitle })).toBeVisible();
      await expect(workspace.locator('#first-customer-work-queue a[href^="/platform-v7/deals/"]')).toHaveCount(0);
      const profileLink = workspace.getByRole('link', { name: locale === 'ru' ? 'Профиль доступа' : locale === 'en' ? 'Access profile' : '访问档案' });
      await profileLink.focus();
      await expect(profileLink).toBeFocused();
      await expect(page.locator('[data-transaction-role-cockpit]')).toHaveCount(0);
      await canonicalNoOverflow(page);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/platform-v7/bank?lang=ru', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('p0-first-customer-workspace-bank')).toBeVisible();
    await canonicalNoOverflow(page);
  });

  test('READY bank queue opens the same server-authorized Deal in RU EN ZH on mobile and desktop', async ({ page, baseURL }, testInfo) => {
    test.skip(!baseURL?.startsWith('https://'), 'Native PostgreSQL and ordinary MFA run in the TLS Design System acceptance workflow.');
    test.setTimeout(180_000);
    const fixture = await seedReadyBankJourney(baseURL!);
    await loginReadyBankJourney(page, fixture.email, baseURL!);
    const authority = await page.context().request.get(`/api/proxy/deals/${fixture.dealId}/workspace`);
    expect(authority.status()).toBe(200);
    const projection = await authority.json();
    expect(projection.deal.id).toBe(fixture.dealId);
    expect(projection.deal.tenantId).toBe(fixture.tenantId);
    expect(projection.viewer.organizationId).toBe(fixture.organizationId);
    expect(projection.viewer.role).toBe('ACCOUNTING');
    expect(projection.viewer.accessLevel).toBe('READ');
    const execution = await page.context().request.get(`/api/proxy/deals/${fixture.dealId}/execution-workspace`);
    expect(execution.status()).toBe(200);
    const executionProjection = await execution.json();
    expect(executionProjection.deal.id).toBe(fixture.dealId);
    expect(executionProjection.roleProjection.role).toBe('ACCOUNTING');
    expect(executionProjection.roleProjection.canAct).toBe(false);
    const runtimeFailures: string[] = [];
    const commandWrites: string[] = [];
    const observeJourney = (journeyPage: Page) => {
      journeyPage.on('pageerror', (error) => runtimeFailures.push(error.message));
      journeyPage.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });
      journeyPage.on('request', (request) => {
        if (request.method() !== 'GET' && /\/api\/proxy\/deals\/[^/]+\/commands\//.test(new URL(request.url()).pathname)) {
          commandWrites.push(request.method() + ' ' + new URL(request.url()).pathname);
        }
      });
    };
    observeJourney(page);
    const reloadLabels = { ru: 'Повторить загрузку сделки', en: 'Reload deal state', zh: '重新读取交易状态' } as const;
    for (const width of [390, 1440]) {
      for (const locale of ['ru', 'en', 'zh'] as const) {
        // Each journey starts on a new page in the same server-authenticated
        // context. Keep prior pages open and observed through the final checks;
        // replacing or resizing them can abort unrelated catalog/prefetch work.
        const journeyPage = await page.context().newPage();
        observeJourney(journeyPage);
        await journeyPage.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        // Observe the real catalog response and its complete body. The queue
        // link is a full-document navigation; do not interrupt this shell fetch
        // while measuring runtime errors. This does not require global idle.
        const catalogFinished = () => new Promise<void>((resolve, reject) => {
          let catalogRequest: Request | undefined;
          const onRequest = (request: Request) => {
            if (!catalogRequest && request.method() === 'GET'
              && new URL(request.url()).pathname === '/api/proxy/ai-assistant/catalog') catalogRequest = request;
          };
          const cleanup = () => {
            clearTimeout(timeout);
            journeyPage.off('request', onRequest);
            journeyPage.off('requestfinished', onFinished);
            journeyPage.off('requestfailed', onFailed);
          };
          const onFinished = (request: Request) => {
            if (request !== catalogRequest) return;
            cleanup();
            resolve();
          };
          const onFailed = (request: Request) => {
            if (request !== catalogRequest) return;
            cleanup();
            reject(new Error(`Bank journey catalog failed: ${request.failure()?.errorText || 'request failed'}`));
          };
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Bank journey catalog request/body did not finish within 30000ms'));
          }, 30_000);
          journeyPage.on('request', onRequest);
          journeyPage.on('requestfinished', onFinished);
          journeyPage.on('requestfailed', onFailed);
        });
        const bankRoute = `/platform-v7/bank?lang=${locale}`;
        const bankCatalog = catalogFinished();
        await Promise.all([
          journeyPage.goto(bankRoute, { waitUntil: 'domcontentloaded' }).then((response) => expect(response?.status()).toBe(200)),
          bankCatalog,
        ]);
        await expectPublicRoute(journeyPage, bankRoute, baseURL, '[data-testid="p0-first-customer-workspace-bank"]');
        const route = `/platform-v7/deals/${fixture.dealId}/execution?lang=${locale}`;
        const link = journeyPage.locator('#first-customer-work-queue').getByRole('link', { name: fixture.dealId, exact: false });
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute('href', route);
        await canonicalNoOverflow(journeyPage);
        await link.focus();
        await expect(link).toBeFocused();
        const dealCatalog = catalogFinished();
        await Promise.all([link.press('Enter'), dealCatalog]);
        const workspace = journeyPage.locator(`[data-transaction-workspace="v8"][data-canonical-deal="${fixture.dealId}"]`);
        await expectPublicRoute(journeyPage, route, baseURL, `[data-transaction-workspace="v8"][data-canonical-deal="${fixture.dealId}"]`);
        const htmlLocale = locale === 'zh' ? 'zh-CN' : locale;
        await expect(journeyPage.locator('html')).toHaveAttribute('lang', htmlLocale);
        await expect(workspace).toHaveAttribute('lang', htmlLocale);
        await expect(workspace).toHaveAttribute('data-role', 'bank');
        await expect(workspace.getByRole('button', { name: reloadLabels[locale], exact: true })).toBeVisible();
        await canonicalNoOverflow(journeyPage);
        await canonicalA11y(journeyPage);
        await journeyPage.screenshot({ path: testInfo.outputPath(`ready-bank-deal-${locale}-${width}.png`), animations: 'disabled' });
      }
    }
    expect(runtimeFailures).toEqual([]);
    expect(commandWrites, 'readonly queue navigation must never submit a Deal command').toEqual([]);
  });

  test('all twelve server-verified role shells retain fixed cabinet chrome', async ({ page, baseURL }) => {
    test.skip(!baseURL?.startsWith('https://'), 'Protected login authority runs in the TLS Design System acceptance workflow.');
    test.setTimeout(180_000);
    const loginBase = baseURL!;
    for (const [role, route] of CANONICAL_ROLE_ROUTES) {
      await rotateCabinetRole(page, role, loginBase);
      const response = await page.goto(route, { waitUntil: 'load' });
      expect(response?.ok(), `${role} response`).toBe(true);
      await expect(page).not.toHaveURL(/\/platform-v7\/login/);
      const shell = page.locator('.pc-shell-root-v4');
      const header = shell.locator(':scope > header');
      const main = page.locator('main#main-content');
      const bottomNav = page.getByRole('navigation', { name: 'Основные действия кабинета' });
      await expect(shell).toBeVisible();
      await expect(header).toBeVisible();
      await expect(main).toBeVisible();
      await expect(bottomNav).toBeVisible();
      expect(await bottomNav.locator('a').count()).toBeLessThanOrEqual(5);
      await canonicalNoOverflow(page);
    }
  });
});

test.describe('canonical cross-browser public smoke', () => {

  test('registration locale switch preserves verification context without granting authority', async ({ page }) => {
    const verify='canonical-verify+/=_';
    const statusToken='canonical-status+/=_';
    await page.route('**/api/auth/registration/status**', (route) => route.fulfill({
      status:400,
      contentType:'application/json',
      body:JSON.stringify({ok:false,code:'INVALID_TOKEN'}),
    }));
    const params=new URLSearchParams({lang:'ru',verify,statusToken,intent:'buy'});
    const response=await page.goto(`/platform-v7/register?${params}`,{waitUntil:'load'});
    expect(response?.ok()).toBe(true);

    const header=page.locator('[data-public-site-header="canonical"]');
    await expect(header.locator('.pc-site-brand')).toHaveAttribute('href','/platform-v7?lang=ru');
    await expect(header.locator('.entry-login')).toHaveAttribute('href','/platform-v7/login?lang=ru');
    await canonicalHeaderTargets(page);

    const localeCluster=header.locator(':scope > .pc-site-actions > .pc-site-locale-cluster');
    await expect(localeCluster).toHaveCount(1);
    const localeLinks=localeCluster.locator('a.pc-site-locale-option');
    await expect(localeLinks).toHaveCount(3);
    const enHref=await localeLinks.filter({hasText:'EN'}).getAttribute('href');
    expect(enHref).toBeTruthy();
    const target=new URL(enHref!,page.url());
    expect(target.pathname).toBe('/platform-v7/register');
    expect(target.searchParams.get('lang')).toBe('en');
    expect(target.searchParams.get('verify')).toBe(verify);
    expect(target.searchParams.get('statusToken')).toBe(statusToken);
    expect(target.searchParams.get('intent')).toBe('buy');
    expect(target.searchParams.has('tenantId')).toBe(false);
  });


  test('mobile auth chrome keeps one header, coherent burger and unobscured bottom actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/platform-v7/login?lang=ru', '/platform-v7/register?lang=ru'] as const) {
      expect((await page.goto(route, { waitUntil: 'load' }))?.ok()).toBe(true);
      const header=page.locator('[data-public-site-header="canonical"]');
      const headerBox=await header.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox!.height).toBeGreaterThanOrEqual(63.5);
      expect(headerBox!.height).toBeLessThanOrEqual(64.5);

      const menu=header.locator('details.pc-site-mobile-menu');
      await menu.locator('summary').click();
      await expect(menu).toHaveAttribute('open','');
      const panel=menu.locator('.pc-site-mobile-nav');
      await expect(panel).toBeVisible();
      const rows=panel.locator('.pc-site-mobile-nav-links>a:visible, .pc-site-mobile-utility>a:visible, .pc-site-mobile-locale a:visible');
      expect(await rows.count()).toBeGreaterThan(5);
      for(const row of await rows.all()){
        const box=await row.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(43.999);
      }
      await expect(panel.locator('.pc-site-mobile-locale a')).toHaveCount(3);
      await menu.locator('summary').click();

      const bottom=page.locator('.pc-cp-bottom-nav');
      await expect(bottom).toBeVisible();
      await expect(bottom.locator('a')).toHaveCount(5);
      await expect(bottom.locator('a[aria-current="page"]')).toHaveCount(1);
      for(const item of await bottom.locator('a').all()){
        const box=await item.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(43.999);
      }
      const publicDock=page.locator(".pc-public-contact-dock[data-assistant-context='public']");
      const gektaAction=publicDock.locator('.pc-public-contact-dock-assistant');
      await expect(publicDock).toHaveAttribute('data-public-mode',route.includes('/login')?'full':'gekta');
      await expect(publicDock).toBeVisible();
      await expect(gektaAction).toBeVisible();
      await expect(gektaAction).toBeEnabled();
      const gektaBox=await gektaAction.boundingBox();
      const bottomBeforeScroll=await bottom.boundingBox();
      expect(gektaBox).not.toBeNull();
      expect(bottomBeforeScroll).not.toBeNull();
      expect(gektaBox!.width).toBeGreaterThanOrEqual(44);
      expect(gektaBox!.height).toBeGreaterThanOrEqual(44);
      expect(gektaBox!.y+gektaBox!.height).toBeLessThanOrEqual(bottomBeforeScroll!.y-4);

      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      const bottomBox=await bottom.boundingBox();
      expect(bottomBox).not.toBeNull();
      const last=route.includes('/login')
        ? page.locator('.pc-auth-register').last()
        : page.locator('.p0-register-help-links').last();
      await expect(last).toBeVisible();
      const lastBox=await last.boundingBox();
      expect(lastBox).not.toBeNull();
      expect(lastBox!.y+lastBox!.height).toBeLessThanOrEqual(bottomBox!.y+1);
      await canonicalNoOverflow(page);
    }
  });

  test('market filter controls expose sorting and applied state without client-only UI', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const route='/platform-v7/market?lang=ru&crop=wheat&sort=closing&region=%D0%A2%D0%B0%D0%BC%D0%B1%D0%BE%D0%B2';
    expect((await page.goto(route,{waitUntil:'load'}))?.ok()).toBe(true);
    await expectPublicRoute(page,route,baseURL);
    await expect(page.locator('select[name="crop"]')).toHaveValue('wheat');
    await expect(page.locator('select[name="sort"]')).toHaveValue('closing');
    await expect(page.locator('input[name="region"]')).toHaveValue('Тамбов');
    await expect(page.locator('.pc-cp-market-active-filters')).toContainText('Пшеница');
    await expect(page.locator('.pc-cp-market-active-filters')).toContainText('Сначала закрывающиеся');
    await canonicalNoOverflow(page);
  });

  test('RU EN ZH home remains keyboard-usable, accessible and overflow-safe', async ({ page }) => {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      await canonicalNoOverflow(page);
      await canonicalHeaderTargets(page);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.tagName || '')).not.toBe('BODY');
    }
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    await canonicalA11y(page);
  });

  test('canonical login is accessible and overflow-safe', async ({ page }) => {
    expect((await page.goto('/platform-v7/login?lang=ru', { waitUntil: 'load' }))?.ok()).toBe(true);
    await expect(page.getByRole('main')).toBeVisible();
    await canonicalNoOverflow(page);
    await canonicalA11y(page);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName || '')).not.toBe('BODY');
  });

  test('mobile and desktop canonical linked pages retain chrome and route truth', async ({ page, baseURL }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const locale of ['ru', 'en', 'zh'] as const) {
        for (const route of ['/platform-v7/how-it-works', '/platform-v7/trust', '/platform-v7/about', '/platform-v7/contact']) {
          const requested = `${route}?lang=${locale}`;
          const response = await page.goto(requested, { waitUntil: 'domcontentloaded' });
          expect(response?.status()).toBe(200);
          await expectPublicRoute(page, requested, baseURL);
          await expect(page.locator('[data-public-site-header="canonical"]')).toBeVisible();
          await canonicalHeaderTargets(page);
          await canonicalNoOverflow(page);
        }
      }
    }
  });
});

for (const width of [320, 390, 430] as const) {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    test(`canonical cross-browser public smoke: home single footer reserve ${width} ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      expect((await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' }))?.ok()).toBe(true);
      const home = page.locator('main.pc-cp-page-home');
      const capabilities = home.locator('#capabilities');
      const nav = home.locator('.pc-cp-bottom-nav');
      await expect(nav).toBeVisible();
      await expect(home.locator('.pc-cp-footer')).toBeHidden();
      expect(await home.evaluate(node => Number.parseFloat(getComputedStyle(node).paddingBottom))).toBeLessThanOrEqual(1);
      await capabilities.scrollIntoViewIfNeeded();
      await expect.poll(async () => page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const last = document.querySelector('#capabilities .pc-cp-capabilities')!.getBoundingClientRect();
        const navBox = document.querySelector('.pc-cp-bottom-nav')!.getBoundingClientRect();
        return last.bottom <= navBox.top + 1 && last.bottom > 0;
      })).toBe(true);
      const geometry = await home.evaluate(node => {
        const last = node.querySelector('#capabilities')!;
        const final = node.querySelector('.pc-cp-final')!;
        return {
          display: getComputedStyle(node).display,
          lastOrder: Number(getComputedStyle(last).order),
          finalOrder: Number(getComputedStyle(final).order),
          reserve: Number.parseFloat(getComputedStyle(last).paddingBottom),
          navBottomPadding: Number.parseFloat(getComputedStyle(node.querySelector('.pc-cp-bottom-nav')!).paddingBottom),
        };
      });
      expect(geometry.display).toBe('flex');
      expect(geometry.lastOrder).toBeGreaterThan(geometry.finalOrder);
      expect(geometry.reserve).toBeGreaterThanOrEqual(96);
      // Navigation has 6px base padding plus the same actual safe-area inset.
      expect(Math.abs(geometry.reserve - (90 + geometry.navBottomPadding))).toBeLessThanOrEqual(1);
      await canonicalNoOverflow(page);
    });
  }
}


test.describe('owner UX v2 About and Trust geometry', () => {
  const widths = [320, 375, 390, 430] as const;
  const locales = ['ru', 'en', 'zh'] as const;

  async function assertElementFullyUsable(page: Page, locator: ReturnType<Page['locator']>, label: string) {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator, label).toBeVisible();
    const result = await locator.evaluate((element) => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const points = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + Math.min(8, rect.width / 4), rect.top + rect.height / 2],
        [rect.right - Math.min(8, rect.width / 4), rect.top + rect.height / 2],
      ];
      return {
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        viewportWidth,
        viewportHeight,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
        overflowX: getComputedStyle(node).overflowX,
        overflowY: getComputedStyle(node).overflowY,
        hits: points.map(([x, y]) => {
          const hit = document.elementFromPoint(x!, y!);
          return Boolean(hit && (hit === node || node.contains(hit)));
        }),
      };
    });
    expect(result.rect.left, `${label}: left bound`).toBeGreaterThanOrEqual(-1);
    expect(result.rect.right, `${label}: right bound`).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.rect.width, `${label}: width`).toBeGreaterThanOrEqual(44);
    expect(result.rect.height, `${label}: height`).toBeGreaterThanOrEqual(44);
    expect(result.scrollWidth, `${label}: horizontal clipping`).toBeLessThanOrEqual(result.clientWidth + 1);
    expect(result.scrollHeight, `${label}: vertical clipping`).toBeLessThanOrEqual(result.clientHeight + 1);
    expect(result.hits.every(Boolean), `${label}: hit testing`).toBe(true);
  }

  async function assertTrustCardsReadable(page: Page, label: string) {
    const cards = page.locator('.pc-cp-page-trust .pc-cp-trust-pillar');
    await expect(cards).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      await expect(card, `${label}: trust card ${index + 1}`).toBeVisible();
      const result = await card.evaluate((element) => {
        const node = element as HTMLElement;
        const rect = node.getBoundingClientRect();
        const textNodes = Array.from(node.querySelectorAll<HTMLElement>('h3,p,li,small,strong,span'))
          .filter((item) => (item.textContent || '').trim().length > 0)
          .map((item) => ({
            text: (item.textContent || '').trim().slice(0, 80),
            scrollWidth: item.scrollWidth,
            clientWidth: item.clientWidth,
            scrollHeight: item.scrollHeight,
            clientHeight: item.clientHeight,
            overflow: getComputedStyle(item).overflow,
          }));
        return {
          rect: { left: rect.left, right: rect.right, width: rect.width, height: rect.height },
          viewportWidth: document.documentElement.clientWidth,
          overflow: getComputedStyle(node).overflow,
          textNodes,
        };
      });
      expect(result.rect.left, `${label}: card ${index + 1} left`).toBeGreaterThanOrEqual(-1);
      expect(result.rect.right, `${label}: card ${index + 1} right`).toBeLessThanOrEqual(result.viewportWidth + 1);
      expect(result.rect.width).toBeGreaterThan(0);
      expect(result.rect.height).toBeGreaterThan(0);
      expect(result.overflow).not.toBe('hidden');
      expect(result.textNodes.length).toBeGreaterThan(0);
      for (const text of result.textNodes) {
        expect(text.scrollWidth, `${label}: card ${index + 1} horizontal text clip: ${text.text}`).toBeLessThanOrEqual(text.clientWidth + 1);
        expect(text.scrollHeight, `${label}: card ${index + 1} vertical text clip: ${text.text}`).toBeLessThanOrEqual(text.clientHeight + 1);
        expect(text.overflow, `${label}: card ${index + 1} hidden text: ${text.text}`).not.toBe('hidden');
      }
    }
  }

  for (const locale of locales) {
    for (const width of widths) {
      test(`About CTAs remain whole and clickable: ${locale} ${width}px`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width, height: 900 });
        const route = `/platform-v7/about?lang=${locale}`;
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expectPublicRoute(page, route, baseURL);
        const actions = page.locator('.p7-about-page .pc-cp-hero-copy .pc-cp-actions .pc-cp-button');
        await expect(actions).toHaveCount(2);
        await assertElementFullyUsable(page, actions.nth(0), `About primary ${locale} ${width}`);
        await assertElementFullyUsable(page, actions.nth(1), `About secondary ${locale} ${width}`);
        expect(await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ))).toBeLessThanOrEqual(1);

        await page.addStyleTag({ content: '.p7-about-page .pc-cp-actions .pc-cp-button{font-size:200%!important;line-height:1.4!important;white-space:normal!important}' });
        await assertElementFullyUsable(page, actions.nth(0), `About primary 200% ${locale} ${width}`);
        await assertElementFullyUsable(page, actions.nth(1), `About secondary 200% ${locale} ${width}`);
        expect(await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ))).toBeLessThanOrEqual(1);
      });

      test(`Trust cards keep complete readable text: ${locale} ${width}px`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width, height: 900 });
        const route = `/platform-v7/trust?lang=${locale}`;
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expectPublicRoute(page, route, baseURL);
        await assertTrustCardsReadable(page, `Trust ${locale} ${width}`);
        expect(await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ))).toBeLessThanOrEqual(1);

        await page.addStyleTag({ content: '.pc-cp-page-trust .pc-cp-trust-pillar h3,.pc-cp-page-trust .pc-cp-trust-pillar-head p,.pc-cp-page-trust .pc-cp-trust-pillar li>span,.pc-cp-page-trust .pc-cp-trust-pillar>small{font-size:200%!important;line-height:1.45!important;white-space:normal!important}' });
        await assertTrustCardsReadable(page, `Trust 200% ${locale} ${width}`);
        expect(await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ))).toBeLessThanOrEqual(1);
      });
    }
  }
});


async function seedOwnEnrollmentSubject(baseURL: string) {
  const origin = new URL(baseURL);
  const database = new URL(process.env.DATABASE_URL || '');
  if (origin.protocol !== 'https:' || !['localhost', '127.0.0.1'].includes(origin.hostname)
    || origin.username || origin.password
    || !['postgres:', 'postgresql:'].includes(database.protocol)
    || !['localhost', '127.0.0.1', 'postgres'].includes(database.hostname)
    || database.pathname !== '/dsv8_acceptance') {
    throw new Error('Own enrollment requires the localhost TLS/disposable dsv8_acceptance PostgreSQL matrix');
  }
  const apiRequire = createRequire(resolve(process.cwd(), '../api/package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  const bcrypt = apiRequire('bcryptjs');
  const prisma = new PrismaClient();
  const email = `dsv8.own-enrollment.${randomUUID()}@acceptance.invalid`;
  const passwordHash = await bcrypt.hash(ACCEPTANCE_PASSWORD, 10);
  try {
    await prisma.$transaction(async (tx: typeof prisma) => {
      const digits = String(100000000n + BigInt(`0x${randomUUID().replaceAll('-', '')}`) % 900000000n);
      const checksum = [2, 4, 10, 3, 5, 9, 4, 6, 8]
        .reduce((sum, weight, index) => sum + weight * Number(digits[index]), 0);
      const organization = await tx.organization.create({ data: {
        inn: `${digits}${(checksum % 11) % 10}`, name: 'Acceptance own enrollment', type: 'LEGAL',
        status: 'VERIFIED', kycStatus: 'APPROVED', verifiedAt: new Date(),
      } });
      const user = await tx.user.create({ data: { email, passwordHash, fullName: 'Acceptance ordinary subject', status: 'ACTIVE' } });
      await tx.userOrg.create({ data: {
        userId: user.id, organizationId: organization.id, role: 'GUEST', status: 'ACTIVE',
        isDefault: true, isOrgAdmin: false, activatedAt: new Date(),
      } });
    });
    return email;
  } finally { await prisma.$disconnect(); }
}

test('canonical protected cabinet boundary: password-only login opens the ordinary buyer cabinet without an MFA challenge', async ({ page, baseURL }) => {
  test.skip(!baseURL?.startsWith('https://'), 'Password-session authority requires the TLS PostgreSQL acceptance contour.');
  type LoginEvidence = { status: number; body: unknown };
  const observedLogins: LoginEvidence[] = [];
  let deliverNextLogin: ((evidence: LoginEvidence) => void) | undefined;
  await page.exposeBinding('__pcAcceptanceActualPasswordResponse', (source, evidence: LoginEvidence) => {
    expect(source.page).toBe(page);
    expect(source.frame).toBe(page.mainFrame());
    observedLogins.push(evidence);
    expect(deliverNextLogin, 'this actual response belongs to an armed form submission').toBeDefined();
    const deliver = deliverNextLogin!;
    deliverNextLogin = undefined;
    deliver(evidence);
  });
  // Chromium retires response bodies when the form performs full navigation.
  // Retain a clone of the genuine response before returning the original to
  // application code; the real request, response and cookies are unchanged.
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await originalFetch.call(window, input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const url = new URL(response.url, window.location.href);
      if (url.origin === window.location.origin && url.pathname === '/api/auth/login'
        && method.toUpperCase() === 'POST') {
        const observer = (window as unknown as {
          __pcAcceptanceActualPasswordResponse: (evidence: { status: number; body: unknown }) => Promise<void>;
        }).__pcAcceptanceActualPasswordResponse;
        await observer({ status: response.status, body: await response.clone().json() });
      }
      return response;
    };
  });
  const submitPasswordLogin = async (): Promise<LoginEvidence> => {
    const previousCount = observedLogins.length;
    expect(deliverNextLogin, 'the preceding form response was consumed').toBeUndefined();
    const delivered = new Promise<LoginEvidence>(resolve => { deliverNextLogin = resolve; });
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login'
      && response.request().method() === 'POST');
    await page.locator('form').filter({ has: page.locator('input[name="password"]') }).locator('button[type="submit"]').click();
    const [response, evidence] = await Promise.all([pending, delivered]);
    expect(response.status()).toBe(200);
    expect(observedLogins, 'one actual response retained for this form submission').toHaveLength(previousCount + 1);
    expect(evidence).toBe(observedLogins[previousCount]);
    expect(evidence.status).toBe(response.status());
    return evidence;
  };
  await page.context().clearCookies();
  await page.goto('/platform-v7/login?lang=ru', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(acceptanceEmail('buyer'));
  await page.locator('input[name="password"]').fill(ACCEPTANCE_PASSWORD);
  const response = await submitPasswordLogin();
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ ok: true, mfaRequired: false });
  await expect(page).toHaveURL(/\/platform-v7\/buyer(?:[?]|$)/);
  await expect(page.getByTestId('p0-first-customer-workspace-buyer')).toBeVisible();
  await expect(page.locator('input[name="verification-code"]')).toHaveCount(0);
  const profile = await page.context().request.get('/api/auth/me');
  expect(profile.status()).toBe(200);
  const payload = await profile.json();
  expect(payload.user?.mfaVerified ?? payload.mfaVerified).toBe(false);
  await canonicalNoOverflow(page);

  // A fresh non-admin membership also has a genuine own-subject enrollment
  // path. No staff assignment, preinstalled secret or assurance flag is seeded.
  const email = await seedOwnEnrollmentSubject(baseURL!);
  const passwordLogin = async () => {
    await page.context().clearCookies();
    await page.goto('/platform-v7/login?lang=ru', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(ACCEPTANCE_PASSWORD);
    const loginResponse = await submitPasswordLogin();
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toMatchObject({ ok: true, mfaRequired: false });
    await expect(page).toHaveURL(/\/platform-v7\/profile(?:[?]|$)/);
    await page.goto('/platform-v7/profile?lang=ru', { waitUntil: 'networkidle' });
    const identity = await page.context().request.get('/api/auth/me');
    expect(identity.status()).toBe(200);
    const body = await identity.json();
    expect(body.user?.mfaVerified ?? body.mfaVerified).toBe(false);
    return page.locator('[data-own-mfa-verification]');
  };
  const startOwn = async (target: Page) => {
    const pending = target.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/mfa-step-up/start');
    await target.locator('[data-own-mfa-verification]').getByRole('button', { name: 'Подготовить защищённое действие' }).click();
    const response = await pending;
    expect(response.status()).toBe(200);
    return response.json();
  };
  let panel = await passwordLogin();
  await expect(panel).toBeVisible();
  const secondTab = await page.context().newPage();
  try {
    await secondTab.goto('/platform-v7/profile?lang=ru', { waitUntil: 'networkidle' });
    const setup = await startOwn(page);
    expect(setup).toMatchObject({ ok: true, enrollmentRequired: true, setupSecret: expect.any(String) });
    expect(setup).not.toHaveProperty('challengeToken');
    const secondSetup = await startOwn(secondTab);
    expect(secondSetup.setupSecret).toBe(setup.setupSecret);
    const remaining = 30_000 - (Date.now() % 30_000);
    if (remaining < 5_000) await page.waitForTimeout(remaining + 100);
    await panel.getByLabel('Код подтверждения').fill(totp(setup.setupSecret));
    const proofPending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/mfa-step-up/verify');
    await panel.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    const proofResponse = await proofPending;
    expect(proofResponse.status()).toBe(200);
    const proof = await proofResponse.json();
    expect(proof).toMatchObject({ ok: true, mfaVerified: true });
    expect(proof.backupCodes).toHaveLength(8);
    for (const code of proof.backupCodes) {
      expect(code).toMatch(/^[A-Z2-7]{6}(?:-[A-Z2-7]{6}){3}$/);
      await expect(panel.getByText(code, { exact: true })).toBeVisible();
    }
    await canonicalNoOverflow(page);
    await secondTab.reload({ waitUntil: 'networkidle' });
    await expect(secondTab.locator('[data-own-mfa-verification]')).toHaveCount(0);
    const assured = await secondTab.context().request.get('/api/auth/me');
    expect(assured.status()).toBe(200);
    const assuredBody = await assured.json();
    expect(assuredBody.user?.mfaVerified ?? assuredBody.mfaVerified).toBe(true);

    // Spend a disclosed credential through the actual form, then prove its
    // server-side one-use denial from another fresh password session.
    for (const expectedStatus of [200, 401]) {
      panel = await passwordLogin();
      const challenge = await startOwn(page);
      expect(challenge.enrollmentRequired).not.toBe(true);
      await panel.getByLabel('Код подтверждения').fill(proof.backupCodes[0]);
      const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/mfa-step-up/verify');
      await panel.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      const result = await pending;
      expect(result.status()).toBe(expectedStatus);
      expect(await result.json()).not.toHaveProperty('backupCodes');
      const identity = await page.context().request.get('/api/auth/me');
      expect(identity.status()).toBe(200);
      const identityBody = await identity.json();
      expect(identityBody.user?.mfaVerified ?? identityBody.mfaVerified).toBe(expectedStatus === 200);
    }
    await expect(panel.getByRole('alert')).toBeVisible();
    await canonicalNoOverflow(page);
  } finally { await secondTab.close(); }
});
