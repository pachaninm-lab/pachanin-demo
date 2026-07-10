import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-auth-preview-smoke-2323');
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const browser = await chromium.launch({ headless: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [] };

async function snapshot(page) {
  return page.evaluate(() => {
    function nodePath(node) {
      const parts = [];
      let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (current && current instanceof Element && parts.length < 10) {
        let part = current.tagName.toLowerCase();
        if (current.id) part += `#${current.id}`;
        const classes = Array.from(current.classList).slice(0, 3);
        if (classes.length) part += `.${classes.join('.')}`;
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(' > ');
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,template')) continue;
      const text = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      textNodes.push({ path: nodePath(node), text });
    }
    return {
      htmlLang: document.documentElement.lang,
      bodyHtmlPrefix: document.body.innerHTML.slice(0, 3000),
      textNodes,
      stylesInBody: Array.from(document.body.querySelectorAll('style')).map((style) => ({
        path: nodePath(style),
        textPrefix: String(style.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      })),
    };
  });
}

function firstDiff(before, after) {
  const max = Math.max(before.length, after.length);
  for (let index = 0; index < max; index += 1) {
    const a = before[index] ?? null;
    const b = after[index] ?? null;
    if (!a || !b || a.text !== b.text || a.path !== b.path) {
      return {
        index,
        before: a,
        after: b,
        beforeWindow: before.slice(Math.max(0, index - 4), index + 5),
        afterWindow: after.slice(Math.max(0, index - 4), index + 5),
      };
    }
  }
  return null;
}

try {
  for (const route of routes) {
    const url = new URL(route, BASE_URL);
    url.searchParams.set('lang', 'ru');

    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    const noJsResponse = await noJsPage.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const before = await snapshot(noJsPage);
    await noJsContext.close();

    const jsContext = await browser.newContext();
    const jsPage = await jsContext.newPage();
    const errors = [];
    jsPage.on('pageerror', (error) => errors.push(String(error?.stack || error)));
    const jsResponse = await jsPage.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    await jsPage.waitForTimeout(500);
    const after = await snapshot(jsPage);
    await jsContext.close();

    report.cases.push({
      route,
      noJsStatus: noJsResponse?.status() ?? null,
      jsStatus: jsResponse?.status() ?? null,
      before,
      after,
      firstDiff: firstDiff(before.textNodes, after.textNodes),
      runtimeErrors: errors,
    });
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(ARTIFACT_DIR, 'dom-hydration-diff.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.cases.map(({ route, before, after, firstDiff, runtimeErrors }) => ({
  route,
  beforeLang: before.htmlLang,
  afterLang: after.htmlLang,
  beforeStylesInBody: before.stylesInBody,
  afterStylesInBody: after.stylesInBody,
  firstDiff,
  runtimeErrorCount: runtimeErrors.length,
})), null, 2));
