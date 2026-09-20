import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';


const AUTHORITY_AHASH: Record<string,{hash:string;maxDistance:number}> = {
  '01-home-desktop': { hash:'3fd80602000e000af001fffffffffffffffff7fffff9fffdfffdbfff00009fff', maxDistance:90 },
  '02-home-mobile': { hash:'dc399ff18181800180018ffd8ff18221bffdbffdbdfd9fedbff5bffd80818001', maxDistance:125 },
  '03-market-desktop': { hash:'7ffc1ff31800f800ffefff0f001f3e3fffffffff003f003fffffffff8003003f', maxDistance:130 },
  '04-lot-desktop': { hash:'fff7f3e7c78303f9f9ffffffffffffffffffffffffffffffffffffffffffffff', maxDistance:135 },
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
  { name: '09-gekta-desktop', path: '/platform-v7/ai-in-action?lang=ru', width: 1672, height: 941, ready: 'main h1' },
] as const;

test.describe('canonical visual authority evidence', () => {
  test.setTimeout(180_000);

  for (const target of targets) {
    test(`${target.name} visual evidence`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: target.width, height: target.height });
      const runtimeFailures: string[] = [];
      page.on('pageerror', (error) => runtimeFailures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });

      const response = await page.goto(target.path, { waitUntil: 'networkidle' });
      expect(response?.ok()).toBe(true);
      expect(new URL(page.url()).pathname, `Unexpected redirect for ${target.path}: ${page.url()}`).toBe(new URL(target.path, 'http://127.0.0.1:3000').pathname);
      await expect(page.locator(target.ready).first()).toBeVisible();

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
    test(`responsive contract ${width}px`, async ({ page }) => {
      const height = width <= 390 ? 844 : width <= 768 ? 1024 : 900;
      await page.setViewportSize({ width, height });
      for (const route of [
        '/platform-v7?lang=ru',
        '/platform-v7/market?lang=ru',
        '/platform-v7/market?lang=ru&lot=0',
        '/platform-v7/how-it-works?lang=ru',
        '/platform-v7/trust?lang=ru',
        '/platform-v7/ai-in-action?lang=ru',
      ]) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.ok(), `${route} should return 200 at ${width}px`).toBe(true);
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ));
        expect(overflow, `${route} horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }

  for (const locale of ['ru', 'en', 'zh'] as const) {
    test(`public locale ${locale} remains layout-safe on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of [
        '/platform-v7',
        '/platform-v7/market',
        '/platform-v7/how-it-works',
        '/platform-v7/trust',
        '/platform-v7/ai-in-action',
        '/platform-v7/register',
        '/platform-v7/login',
        '/platform-v7/about',
        '/platform-v7/contact',
      ]) {
        const separator = route.includes('?') ? '&' : '?';
        const response = await page.goto(`${route}${separator}lang=${locale}`, { waitUntil: 'domcontentloaded' });
        expect(response?.ok(), `${route} should return 200 for ${locale}`).toBe(true);
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ));
        expect(overflow, `${route} ${locale} horizontal overflow`).toBeLessThanOrEqual(1);
      }
    });
  }

});
