import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';


const AUTHORITY_AHASH: Record<string,{hash:string;maxDistance:number}> = {
  '01-home-desktop': { hash:'3fd80602000e000af001fffffffffffffffff7fffff9fffdfffdbfff00009fff', maxDistance:90 },
  '02-home-mobile': { hash:'dc399ff18181800180018ffd8ff18221bffdbffdbdfd9fedbff5bffd80818001', maxDistance:125 },
  '03-market-desktop': { hash:'7ffc1ff31800f800ffefff0f001f3e3fffffffff003f003fffffffff8003003f', maxDistance:130 },
  '04-lot-desktop': { hash:'3ffc0800000005ef05ff07ff07ff07ff07e0ffffffffffffffffffffffffffff', maxDistance:135 },
  '05-deal-desktop': { hash:'1ff8cff01fdf1ff7e3ffe7ffff21a9e8ef68f9efbfffe3fceda8fff80bfd1fff', maxDistance:130 },
  '06-deal-mobile': { hash:'3fff80ff807f07ff83ff03ffffffcfffdfffdfffffff00008000ffffffffffff', maxDistance:125 },
  '06-market-mobile': { hash:'bfffafffffffffff83ff01ff83ff83ff03ff03ff01ff01ff03ff83ff01ffffff', maxDistance:115 },
  '07-how-it-works-desktop': { hash:'3ff883c0ff00ffffffffffffffffffffffffbfffb7fb9207a40707ff0000ffff', maxDistance:90 },
  '08-trust-desktop': { hash:'fff89f808300f4009c02ffffffb7ffffbf3f8801ffffbfc9ffc7ffffbfffffff', maxDistance:95 },
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
      if(authority){
        const observed=await averageHashFromPng(page,png);
        const distance=hammingHex(authority.hash,observed);
        expect(distance,`${target.name} perceptual drift ${distance} > ${authority.maxDistance}; authority=${authority.hash} observed=${observed}`).toBeLessThanOrEqual(authority.maxDistance);
      }
    });
  }
  const responsiveWidths = [320, 375, 390, 768, 1280, 1440] as const;
  for (const width of responsiveWidths) {
    test(`responsive contract ${width}px`, async ({ page, baseURL }) => {
      const height = width <= 390 ? 844 : width <= 768 ? 1024 : 900;
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
