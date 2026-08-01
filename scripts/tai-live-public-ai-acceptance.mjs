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
let multilingualQwen = null;

function parseSseFrames(text) {
  const frames = [];
  for (const block of text.split('\n\n')) {
    for (const line of block.splitlines?.() || block.split('\n')) {
      if (line.startsWith('data: ')) frames.push(JSON.parse(line.slice(6)));
    }
  }
  return frames;
}

function languageAndTopicEvidence(locale, answer) {
  const normalized = answer.normalize('NFKC').toLocaleLowerCase(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU');
  const terms = locale === 'ru'
    ? ['качество', 'логист', 'сезон', 'спрос', 'предлож', 'экспорт', 'валют', 'базис', 'урож', 'хранен']
    : locale === 'en'
      ? ['quality', 'logistic', 'season', 'demand', 'supply', 'export', 'currency', 'basis', 'harvest', 'storage']
      : ['质量', '物流', '季节', '需求', '供应', '出口', '汇率', '交货', '收获', '储存', '库存'];
  const topicMatches = terms.filter(term => normalized.includes(term));
  const languageCharacters = locale === 'ru'
    ? (answer.match(/[А-Яа-яЁё]/gu) || []).length
    : locale === 'en'
      ? (answer.match(/[A-Za-z]/gu) || []).length
      : (answer.match(/[\u3400-\u9FFF]/gu) || []).length;
  const minimumLanguageCharacters = locale === 'zh' ? 10 : 30;
  if (languageCharacters < minimumLanguageCharacters) throw new Error(`sse_language_invalid:${locale}:${languageCharacters}`);
  if (topicMatches.length < 2) throw new Error(`sse_topic_relevance_invalid:${locale}:${topicMatches.join(',')}`);
  return { languageCharacters, topicMatches };
}

async function verifyRealQwenSse() {
  const cases = [
    ['ru', 'Что влияет на цену зерна?'],
    ['en', 'What affects grain prices?'],
    ['zh', '哪些因素影响粮食价格？'],
  ];
  const results = [];
  for (const [locale, question] of cases) {
    const text = await page.evaluate(async ({ locale, question }) => {
      const response = await fetch('/api/public-platform-assistant?stream=1', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: question, locale }),
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) throw new Error(`sse_http_${response.status}`);
      return response.text();
    }, { locale, question });
    const frames = parseSseFrames(text);
    const assessmentFrame = frames.find(frame => frame.event === 'assessment');
    const done = frames.at(-1);
    const assessment = assessmentFrame?.summary ? JSON.parse(String(assessmentFrame.summary)) : null;
    const answer = frames.filter(frame => frame.event === 'token').map(frame => String(frame.text || '')).join('').trim();
    if (!assessment) throw new Error(`sse_assessment_missing:${locale}`);
    if (assessment.source !== 'local_qwen') throw new Error(`sse_source_invalid:${locale}:${assessment.source}`);
    if (assessment.modelIdentity !== 'tai-qwen3-8b-q4km') throw new Error(`sse_model_identity_invalid:${locale}`);
    if (assessment.answerMode !== 'general_agro' || assessment.currentDataRequired !== false) {
      throw new Error(`sse_answer_mode_invalid:${locale}`);
    }
    const flags = Array.isArray(assessment.safetyFlags) ? assessment.safetyFlags.map(String) : [];
    if (flags.some(flag => /FALLBACK|RUNTIME_UNAVAILABLE/iu.test(flag))) {
      throw new Error(`sse_fallback_flag_present:${locale}:${flags.join(',')}`);
    }
    if (frames.some(frame => frame.event === 'citation')) throw new Error(`sse_fake_general_agro_citation:${locale}`);
    if (done?.event !== 'done' || done.complete !== true) throw new Error(`sse_incomplete:${locale}`);
    if (answer.length < 80) throw new Error(`sse_answer_too_short:${locale}:${answer.length}`);
    for (const forbidden of ['192.168.0.206', 'tenantId', 'membershipId', 'subjectId', 'AI_ASSISTANT_API_KEY', 'TAI_PUBLIC_GATEWAY_HMAC_SECRET']) {
      if (text.includes(forbidden)) throw new Error(`sse_forbidden_material:${locale}:${forbidden}`);
    }
    const evidence = languageAndTopicEvidence(locale, answer);
    results.push({
      locale,
      answerCharacters: answer.length,
      source: assessment.source,
      modelIdentity: assessment.modelIdentity,
      latencyMs: typeof assessment.latencyMs === 'number' ? assessment.latencyMs : null,
      safetyFlags: flags,
      ...evidence,
      status: 'PASS',
    });
  }
  return results;
}

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
  multilingualQwen = await verifyRealQwenSse();

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
    multilingualQwen,
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
    multilingualQwen,
    pageErrors,
    error: errorText,
    status: 'FAIL',
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
console.log('LIVE_PUBLIC_AI_UI=PASS');
