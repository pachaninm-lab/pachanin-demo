import pkg from 'playwright'; const { chromium } = pkg;

const BASE = 'http://localhost:3111';
const routes = [
  '/platform-v7',
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/seller',
  '/platform-v7/documents',
  '/platform-v7/buyer',
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/contact',
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async () => {
  return chromium.launch();
});
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  extraHTTPHeaders: { Cookie: 'pc_v7_entry_seen=true' },
});
const page = await ctx.newPage();

const results = [];
for (const r of routes) {
  try {
    const resp = await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(300);
    const data = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const imgs = Array.from(document.images);
      const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0).length;
      const noAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
      const h1 = document.querySelector('h1') ? 1 : 0;
      const lang = document.documentElement.getAttribute('lang') || '';
      // buttons/links without accessible name
      const interactive = Array.from(document.querySelectorAll('button, a[href]'));
      const namelessInteractive = interactive.filter((el) => {
        const txt = (el.textContent || '').trim();
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
        return !txt && !aria;
      }).length;
      return { overflow, imgCount: imgs.length, broken, noAlt, h1, lang, interactive: interactive.length, namelessInteractive };
    });
    results.push({ r, status: resp?.status(), ...data });
  } catch (e) {
    results.push({ r, error: String(e).slice(0, 80) });
  }
}
await browser.close();

console.log('route'.padEnd(38), 'st', 'ovf', 'img', 'brk', 'noAlt', 'h1', 'lang', 'btns', 'nameless');
for (const x of results) {
  if (x.error) { console.log(x.r.padEnd(38), 'ERR', x.error); continue; }
  console.log(
    x.r.padEnd(38),
    String(x.status).padStart(3),
    String(x.overflow).padStart(3),
    String(x.imgCount).padStart(3),
    String(x.broken).padStart(3),
    String(x.noAlt).padStart(5),
    String(x.h1).padStart(2),
    (x.lang || '-').padStart(4),
    String(x.interactive).padStart(4),
    String(x.namelessInteractive).padStart(8),
  );
}
