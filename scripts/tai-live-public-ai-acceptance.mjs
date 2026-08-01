#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const liveBase = process.env.LIVE_BASE;
const targetSha = process.env.TARGET_SHA;
const evidenceDir = process.env.UI_EVIDENCE_DIR;
if (!liveBase || !/^[0-9a-f]{40}$/.test(targetSha || '') || !evidenceDir) process.exit(2);
fs.mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

let manifestSha = null;
let title = '';
let subtitle = '';
let fullscreenDomCount = null;
let fullscreenVisible = null;
let answerCharacters = 0;

try {
  const response = await page.goto(`${liveBase}/platform-v7?lang=ru&release=${targetSha}`, {
    waitUntil: 'domcontentloaded', timeout: 120000,
  });
  if (!response?.ok()) throw new Error(`live_page_http_${response?.status()}`);
  const manifest = await page.evaluate(async sha => {
    const response = await fetch(`/manifest-pc-deploy.json?ui=${sha}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest_http_${response.status}`);
    return response.json();
  }, targetSha);
  manifestSha = manifest.commitSha;
  if (manifestSha !== targetSha) throw new Error(`manifest_sha_mismatch:${manifestSha}`);

  const hidden = page.locator('.pc-public-assistant-shortcut');
  await hidden.waitFor({ state: 'attached', timeout: 30000 });
  const dock = page.locator('.pc-public-contact-dock-assistant');
  await page.evaluate(() => window.scrollTo(0, 180));
  await dock.waitFor({ state: 'visible', timeout: 30000 });
  await dock.click();
  const dialog = page.locator('#pc-public-assistant-panel');
  try { await dialog.waitFor({ state: 'visible', timeout: 5000 }); }
  catch { await hidden.evaluate(node => node.click()); }
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => (
    document.querySelector('#pc-public-assistant-panel')?.getAttribute('data-pc-mobile-viewport-authority') === 'true'
  ), null, { timeout: 30000 });

  title = ((await page.locator('#pc-public-assistant-title').textContent()) || '').trim();
  subtitle = ((await dialog.locator('[data-pc-public-assistant-subtitle="true"]:visible').textContent()) || '').trim();
  if (title !== 'ИИ для агробизнеса') throw new Error('approved_title_missing');
  if (subtitle !== 'Разработан Прозрачной ценой для сельского хозяйства.') throw new Error('approved_subtitle_missing');
  if (await dialog.locator('.pc-modal-sheet-fullscreen-button').count()) throw new Error('duplicate_fullscreen_control_present');

  const fullscreen = dialog.locator('button[aria-label="Развернуть на весь экран"]');
  fullscreenDomCount = await fullscreen.count();
  if (fullscreenDomCount !== 1) throw new Error(`native_fullscreen_dom_count_invalid:${fullscreenDomCount}`);
  fullscreenVisible = await fullscreen.isVisible();
  if (fullscreenVisible) throw new Error('mobile_fullscreen_control_visible');

  const composer = dialog.getByRole('textbox', { name: 'Задай вопрос об агробизнесе или платформе' });
  await composer.fill('Что влияет на цену зерна?');
  await dialog.getByRole('button', { name: 'Отправить' }).click();
  const answered = dialog.locator('.pc-public-assistant-message[data-role="assistant"][data-stream-status="answered"]').last();
  await answered.waitFor({ state: 'visible', timeout: 240000 });
  const answer = ((await answered.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
  answerCharacters = answer.length;
  if (answerCharacters < 20) throw new Error('answer_too_short');
  if (await dialog.locator('[role="alert"]').count()) throw new Error('ui_alert_present');
  const overflow = await dialog.evaluate(node => ({
    horizontal: node.scrollWidth - node.clientWidth,
    viewportRight: node.getBoundingClientRect().right - window.innerWidth,
  }));
  if (overflow.horizontal > 1 || overflow.viewportRight > 1) throw new Error(`ui_overflow:${JSON.stringify(overflow)}`);
  if (pageErrors.length) throw new Error(`page_errors:${pageErrors.join('|')}`);

  await page.screenshot({ path: path.join(evidenceDir, 'public-ai-window-390x844.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'public-ai-window.json'), JSON.stringify({
    schemaVersion: 'tai.public-ai-ui.acceptance.v2',
    targetSha,
    manifestSha,
    title,
    subtitle,
    answerCharacters,
    viewport: '390x844',
    mobileViewportAuthority: true,
    fullscreenDomCount,
    fullscreenVisible,
    status: 'PASS',
  }, null, 2));
} catch (error) {
  const errorText = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await page.screenshot({ path: path.join(evidenceDir, 'public-ai-window-failure-390x844.png'), fullPage: true }).catch(() => undefined);
  fs.writeFileSync(path.join(evidenceDir, 'public-ai-window-failure.json'), JSON.stringify({
    schemaVersion: 'tai.public-ai-ui.acceptance-failure.v1',
    targetSha,
    manifestSha,
    title,
    subtitle,
    answerCharacters,
    viewport: '390x844',
    fullscreenDomCount,
    fullscreenVisible,
    pageErrors,
    error: errorText,
    status: 'FAIL',
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
console.log('LIVE_PUBLIC_AI_UI=PASS');
