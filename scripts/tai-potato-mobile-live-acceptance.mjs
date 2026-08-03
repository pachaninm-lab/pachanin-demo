#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const liveBase = process.env.LIVE_BASE;
const targetSha = process.env.TARGET_SHA;
const evidenceDir = process.env.UI_EVIDENCE_DIR;
if (!liveBase || !/^[0-9a-f]{40}$/u.test(targetSha || '') || !evidenceDir) process.exit(2);
fs.mkdirSync(evidenceDir, { recursive: true });

const QUESTION = 'Чем удобрять картошку';
const REQUIRED_PRIMARY = ['картоф'];
const REQUIRED_SUPPORT = ['удобрен', 'калий', 'фосфор', 'азот', 'почв', 'органик', 'навоз'];
const FORBIDDEN_SECURITY_ARTICLE = [
  'как защищаются данные',
  'доступ назначает сервер',
  'подписанной сессии',
  'данные разных организаций изолированы',
  'журнале аудита',
  'публичный режим не имеет доступа',
];

function normalize(value) {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е');
}

function assertPotatoAnswer(answer, boundary) {
  const normalized = normalize(answer);
  if (answer.length < 80) throw new Error(`${boundary}_answer_too_short:${answer.length}`);
  for (const term of REQUIRED_PRIMARY) {
    if (!normalized.includes(term)) throw new Error(`${boundary}_potato_subject_missing:${term}`);
  }
  const supportMatches = REQUIRED_SUPPORT.filter(term => normalized.includes(term));
  if (supportMatches.length < 2) {
    throw new Error(`${boundary}_fertilizer_substance_missing:${supportMatches.join(',')}`);
  }
  const wrongArticle = FORBIDDEN_SECURITY_ARTICLE.find(term => normalized.includes(term));
  if (wrongArticle) throw new Error(`${boundary}_wrong_platform_article:${wrongArticle}`);
  return supportMatches;
}

function parseSse(text) {
  const frames = [];
  for (const block of text.split('\n\n')) {
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) frames.push(JSON.parse(line.slice(6)));
    }
  }
  return frames;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
await page.addInitScript(() => window.sessionStorage.clear());
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

let manifestSha = null;
let endpointAnswerLength = 0;
let endpointTerms = [];
let uiAnswerLength = 0;
let uiTerms = [];
let assessment = null;

try {
  const response = await page.goto(`${liveBase}/platform-v7?lang=ru&release=${targetSha}&potato=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (!response?.ok()) throw new Error(`live_page_http_${response?.status()}`);

  const manifest = await page.evaluate(async sha => {
    const result = await fetch(`/manifest-pc-deploy.json?potato=${sha}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!result.ok) throw new Error(`manifest_http_${result.status}`);
    return result.json();
  }, targetSha);
  manifestSha = manifest.commitSha;
  if (manifestSha !== targetSha) throw new Error(`manifest_sha_mismatch:${manifestSha}`);

  const sseText = await page.evaluate(async question => {
    const result = await fetch('/api/public-platform-assistant?stream=1', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message: question, locale: 'ru', history: [] }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!result.ok) throw new Error(`potato_sse_http_${result.status}`);
    return result.text();
  }, QUESTION);

  const frames = parseSse(sseText);
  const assessmentFrame = frames.find(frame => frame.event === 'assessment');
  assessment = assessmentFrame?.summary ? JSON.parse(String(assessmentFrame.summary)) : null;
  const endpointAnswer = frames
    .filter(frame => frame.event === 'token')
    .map(frame => String(frame.text || ''))
    .join('')
    .trim();
  const done = frames.at(-1);
  if (!assessment) throw new Error('potato_assessment_missing');
  if (assessment.source !== 'local_qwen') throw new Error(`potato_source_invalid:${assessment.source}`);
  if (assessment.modelIdentity !== 'tai-qwen3-8b-q4km') throw new Error('potato_model_identity_invalid');
  if (assessment.answerMode !== 'general_agro') throw new Error(`potato_answer_mode_invalid:${assessment.answerMode}`);
  if (done?.event !== 'done' || done.complete !== true) throw new Error('potato_stream_incomplete');
  if (frames.some(frame => frame.event === 'citation')) throw new Error('potato_general_answer_has_citation');
  endpointAnswerLength = endpointAnswer.length;
  endpointTerms = assertPotatoAnswer(endpointAnswer, 'endpoint');

  const hidden = page.locator('.pc-public-assistant-shortcut');
  await hidden.waitFor({ state: 'attached', timeout: 30_000 });
  await hidden.evaluate(node => node.click());
  const dialog = page.locator('#pc-public-assistant-panel');
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });

  const composer = dialog.getByRole('textbox', { name: 'Задай вопрос об агробизнесе или платформе' });
  await composer.fill(QUESTION);
  await dialog.getByRole('button', { name: 'Отправить' }).click();
  const answered = dialog.locator('.pc-public-assistant-message[data-role="assistant"][data-stream-status="answered"]').last();
  await answered.waitFor({ state: 'visible', timeout: 240_000 });
  const uiAnswer = ((await answered.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
  uiAnswerLength = uiAnswer.length;
  uiTerms = assertPotatoAnswer(uiAnswer, 'ui');

  if (await dialog.locator('[role="alert"]').count()) throw new Error('potato_ui_alert_present');
  if (pageErrors.length) throw new Error(`potato_page_errors:${pageErrors.join('|')}`);

  await page.screenshot({
    path: path.join(evidenceDir, 'potato-answer-390x844.png'),
    fullPage: true,
  });
  fs.writeFileSync(path.join(evidenceDir, 'potato-answer.json'), JSON.stringify({
    schemaVersion: 'tai.potato-mobile.acceptance.v1',
    targetSha,
    manifestSha,
    question: QUESTION,
    endpoint: {
      source: assessment.source,
      modelIdentity: assessment.modelIdentity,
      answerMode: assessment.answerMode,
      answerCharacters: endpointAnswerLength,
      matchedTerms: endpointTerms,
    },
    ui: {
      viewport: '390x844',
      answerCharacters: uiAnswerLength,
      matchedTerms: uiTerms,
    },
    forbiddenPlatformArticleAbsent: true,
    status: 'PASS',
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await page.screenshot({
    path: path.join(evidenceDir, 'potato-answer-failure-390x844.png'),
    fullPage: true,
  }).catch(() => undefined);
  fs.writeFileSync(path.join(evidenceDir, 'potato-answer-failure.json'), JSON.stringify({
    schemaVersion: 'tai.potato-mobile.acceptance-failure.v1',
    targetSha,
    manifestSha,
    question: QUESTION,
    endpointAnswerLength,
    endpointTerms,
    uiAnswerLength,
    uiTerms,
    assessment,
    pageErrors,
    error: message,
    status: 'FAIL',
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}

console.log('TAI_POTATO_MOBILE_LIVE=PASS');
