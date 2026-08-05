#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const liveBase = process.env.LIVE_BASE;
const targetSha = process.env.TARGET_SHA;
const evidenceDir = process.env.UI_EVIDENCE_DIR;
if (!liveBase || !/^[0-9a-f]{40}$/u.test(targetSha || '') || !evidenceDir) process.exit(2);
fs.mkdirSync(evidenceDir, { recursive: true });

const CASES = [
  { id: 'potato-fertilizer', locale: 'ru', question: 'Чем удобрять картошку', subject: ['картоф'], support: ['удобрен', 'калий', 'фосфор', 'азот', 'почв', 'органик', 'навоз'] },
  {
    id: 'cucumber-yellow-leaves',
    locale: 'ru',
    question: 'Почему желтеют листья у огурцов в теплице?',
    subject: ['огур'],
    support: ['полив', 'питан', 'азот', 'корн', 'болезн', 'температур'],
    supportGroups: [
      { id: 'nutrition', terms: ['питан', 'азот', 'калий', 'магни', 'фосфор', 'дефицит', 'ph'] },
      { id: 'water-root', terms: ['полив', 'влаг', 'корн', 'переувлаж', 'засух'] },
      { id: 'disease-pests', terms: ['болезн', 'гриб', 'инфекц', 'вредител', 'тля', 'клещ'] },
      { id: 'climate', terms: ['температур', 'жар', 'холод', 'влажност'] },
    ],
  },
  { id: 'wheat-low-yield', locale: 'ru', question: 'Почему падает урожайность озимой пшеницы?', subject: ['пшениц'], support: ['почв', 'влаг', 'питан', 'болезн', 'сорняк', 'сорт'] },
  { id: 'tomato-blossom-drop', locale: 'ru', question: 'Почему у томатов опадают цветки?', subject: ['томат'], support: ['температур', 'влажн', 'опыл', 'полив', 'питан'] },
  {
    id: 'apple-scab',
    locale: 'ru',
    question: 'Как снизить риск парши в яблоневом саду?',
    subject: ['яблон', 'парш'],
    support: ['обработ', 'лист', 'влаг', 'санитар', 'фунгиц'],
    supportGroups: [
      { id: 'weather-moisture', terms: ['влажн', 'намокан', 'роса', 'осадк', 'дожд', 'температур'] },
      { id: 'sanitation-inoculum', terms: ['санитар', 'пораженн', 'растительн остат', 'опавш', 'источник инфекц', 'запас возбудител', 'инокул'] },
      { id: 'canopy-airflow', terms: ['крон', 'проветр', 'воздухообмен', 'загущ', 'обрезк'] },
      { id: 'resistant-genetics', terms: ['устойчив', 'сорт', 'подвой'] },
      { id: 'monitoring-treatment', terms: ['монитор', 'осмотр', 'прогноз', 'обработ', 'фунгиц', 'этикетк', 'инструкц'] },
    ],
  },
  { id: 'soil-acidity', locale: 'ru', question: 'Что делать с кислой почвой на участке?', subject: ['почв'], support: ['ph', 'извест', 'анализ', 'доломит', 'кислот'] },
  { id: 'drip-irrigation', locale: 'ru', question: 'Как подобрать капельный полив для небольшого огорода?', subject: ['капель', 'полив'], support: ['давлен', 'расход', 'фильтр', 'лента', 'зон'] },
  { id: 'cow-milk-drop', locale: 'ru', question: 'Почему у коров снизился удой?', subject: ['коров', 'удой'], support: ['корм', 'здоров', 'вода', 'стресс', 'рацион', 'мастит'] },
  { id: 'pig-feed-conversion', locale: 'ru', question: 'Как улучшить конверсию корма у свиней?', subject: ['свин'], support: ['корм', 'рацион', 'здоров', 'микроклимат', 'вода'] },
  { id: 'chicken-egg-drop', locale: 'ru', question: 'Почему куры стали хуже нестись?', subject: ['кур'], support: ['корм', 'свет', 'температур', 'стресс', 'здоров'] },
  { id: 'bee-wintering', locale: 'ru', question: 'Как подготовить пчёл к зимовке?', subject: ['пчел'], support: ['корм', 'клещ', 'семь', 'вентиляц', 'запас'] },
  { id: 'tractor-overheat', locale: 'ru', question: 'Почему трактор перегревается под нагрузкой?', subject: ['трактор'], support: ['радиатор', 'охлажд', 'термостат', 'насос', 'нагруз'] },
  { id: 'combine-losses', locale: 'ru', question: 'Как уменьшить потери зерна за комбайном?', subject: ['комбайн', 'зерн'], support: ['скорост', 'молотил', 'решет', 'вентилятор', 'жатк'] },
  { id: 'mower-vibration', locale: 'ru', question: 'Почему сильно вибрирует газонокосилка?', subject: ['газонокос'], support: ['нож', 'баланс', 'креплен', 'вал', 'подшип'] },
  { id: 'grain-storage', locale: 'ru', question: 'Как безопасно хранить пшеницу после уборки?', subject: ['пшениц', 'хран'], support: ['влажн', 'температур', 'вентиляц', 'сушк', 'вредител'] },
  { id: 'farm-costs', locale: 'ru', question: 'Как уменьшить расходы небольшого хозяйства без потери урожайности?', subject: ['хозяйств', 'урожайн'], support: ['затрат', 'анализ', 'техник', 'удобрен', 'топлив', 'план'] },
  { id: 'village-water', locale: 'ru', question: 'Как организовать водоснабжение фермы в деревне?', subject: ['вод', 'ферм'], support: ['скважин', 'насос', 'резерв', 'дебит', 'качество'] },
  { id: 'farm-excel', locale: 'ru', question: 'Как в Excel посчитать себестоимость тонны зерна?', subject: ['excel', 'себестоим', 'зерн'], support: ['формул', 'затрат', 'тонн', 'сумм', 'объем'] },
  { id: 'potato-en', locale: 'en', question: 'What should I fertilize potatoes with?', subject: ['potato'], support: ['fertil', 'potassium', 'phosph', 'nitrogen', 'soil', 'manure'] },
  { id: 'cucumber-zh', locale: 'zh', question: '温室黄瓜叶子为什么发黄？', subject: ['黄瓜'], support: ['浇水', '营养', '氮', '根', '病', '温度'] },
  { id: 'context-followup', locale: 'ru', question: 'А без орошения?', history: [{ role: 'user', content: 'Как повысить урожайность кукурузы?' }, { role: 'assistant', content: 'Нужно оценить гибрид, почву, питание, густоту и влагу.' }], subject: ['кукуруз', 'орошен', 'влаг'], support: ['засух', 'гибрид', 'густот', 'почв', 'срок'] },
];

const UI_CASE_IDS = new Set(['potato-fertilizer', 'cucumber-yellow-leaves', 'cow-milk-drop', 'tractor-overheat', 'farm-costs']);
const FORBIDDEN = [
  'как защищаются данные',
  'доступ назначает сервер',
  'подписанной сессии',
  'данные разных организаций изолированы',
  'журнале аудита',
  'публичный режим не имеет доступа',
];

function normalize(value, locale = 'ru') {
  const tag = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
  return value.normalize('NFKC').toLocaleLowerCase(tag).replace(/ё/gu, 'е');
}

function assertAgriculturalAnswer(answer, testCase, boundary) {
  const normalized = normalize(answer, testCase.locale);
  if (answer.length < 80) throw new Error(`${testCase.id}_${boundary}_answer_too_short:${answer.length}`);
  if (!testCase.subject.some(term => normalized.includes(normalize(term, testCase.locale)))) {
    throw new Error(`${testCase.id}_${boundary}_subject_missing`);
  }
  const supportGroups = testCase.supportGroups || testCase.support.map(term => ({ id: term, terms: [term] }));
  const matchedGroups = supportGroups
    .filter(group => group.terms.some(term => normalized.includes(normalize(term, testCase.locale))))
    .map(group => group.id);
  if (matchedGroups.length < 2) {
    throw new Error(`${testCase.id}_${boundary}_substance_missing:${matchedGroups.join(',')}`);
  }
  const wrong = FORBIDDEN.find(term => normalized.includes(term));
  if (wrong) throw new Error(`${testCase.id}_${boundary}_wrong_platform_article:${wrong}`);
  return matchedGroups;
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

const evidence = [];
let manifestSha = null;
try {
  const response = await page.goto(`${liveBase}/platform-v7?lang=ru&release=${targetSha}&agro=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (!response?.ok()) throw new Error(`live_page_http_${response?.status()}`);

  const manifest = await page.evaluate(async sha => {
    const result = await fetch(`/manifest-pc-deploy.json?agro=${sha}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!result.ok) throw new Error(`manifest_http_${result.status}`);
    return result.json();
  }, targetSha);
  manifestSha = manifest.commitSha;
  if (manifestSha !== targetSha) throw new Error(`manifest_sha_mismatch:${manifestSha}`);

  for (const testCase of CASES) {
    const sseText = await page.evaluate(async payload => {
      const result = await fetch('/api/public-platform-assistant?stream=1', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(240_000),
      });
      if (!result.ok) throw new Error(`agro_sse_http_${result.status}`);
      return result.text();
    }, { message: testCase.question, locale: testCase.locale, history: testCase.history || [] });

    const frames = parseSse(sseText);
    const assessmentFrame = frames.find(frame => frame.event === 'assessment');
    const assessment = assessmentFrame?.summary ? JSON.parse(String(assessmentFrame.summary)) : null;
    const answer = frames.filter(frame => frame.event === 'token').map(frame => String(frame.text || '')).join('').trim();
    const done = frames.at(-1);
    const row = {
      id: testCase.id,
      locale: testCase.locale,
      question: testCase.question,
      answer: answer.slice(0, 4_000),
      answerCharacters: answer.length,
      source: assessment?.source ?? null,
      answerMode: assessment?.answerMode ?? null,
      modelIdentity: assessment?.modelIdentity ?? null,
      streamComplete: done?.event === 'done' && done.complete === true,
      status: 'PENDING',
    };
    evidence.push(row);
    if (!assessment) throw new Error(`${testCase.id}_assessment_missing`);
    if (assessment.source !== 'local_qwen') throw new Error(`${testCase.id}_source_invalid:${assessment.source}`);
    if (assessment.modelIdentity !== 'tai-qwen3-8b-q4km') throw new Error(`${testCase.id}_model_identity_invalid`);
    if (assessment.answerMode !== 'general_agro') throw new Error(`${testCase.id}_answer_mode_invalid:${assessment.answerMode}`);
    if (done?.event !== 'done' || done.complete !== true) throw new Error(`${testCase.id}_stream_incomplete`);
    row.matchedTerms = assertAgriculturalAnswer(answer, testCase, 'endpoint');
    row.status = 'PASS';
  }

  const hidden = page.locator('.pc-public-assistant-shortcut');
  await hidden.waitFor({ state: 'attached', timeout: 30_000 });
  await hidden.evaluate(node => node.click());
  const dialog = page.locator('#pc-public-assistant-panel');
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  const composer = dialog.getByRole('textbox', { name: 'Задай вопрос об агробизнесе или платформе' });

  for (const testCase of CASES.filter(item => UI_CASE_IDS.has(item.id))) {
    await composer.fill(testCase.question);
    await dialog.getByRole('button', { name: 'Отправить' }).click();
    const answered = dialog.locator('.pc-public-assistant-message[data-role="assistant"][data-stream-status="answered"]').last();
    await answered.waitFor({ state: 'visible', timeout: 240_000 });
    const uiAnswer = ((await answered.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
    const row = evidence.find(item => item.id === testCase.id);
    row.ui = {
      viewport: '390x844',
      answer: uiAnswer.slice(0, 4_000),
      answerCharacters: uiAnswer.length,
      status: 'PENDING',
    };
    row.ui.matchedTerms = assertAgriculturalAnswer(uiAnswer, testCase, 'ui');
    row.ui.status = 'PASS';
  }

  if (await dialog.locator('[role="alert"]').count()) throw new Error('agro_ui_alert_present');
  if (pageErrors.length) throw new Error(`agro_page_errors:${pageErrors.join('|')}`);
  await page.screenshot({ path: path.join(evidenceDir, 'agro-wide-answer-390x844.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'agro-wide-answer.json'), JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance.v1', targetSha, manifestSha,
    endpointCaseCount: CASES.length, uiCaseCount: UI_CASE_IDS.size, cases: evidence,
    forbiddenPlatformArticleAbsent: true, status: 'PASS',
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await page.screenshot({ path: path.join(evidenceDir, 'agro-wide-answer-failure-390x844.png'), fullPage: true }).catch(() => undefined);
  fs.writeFileSync(path.join(evidenceDir, 'agro-wide-answer-failure.json'), JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance-failure.v1', targetSha, manifestSha, completedCases: evidence, pageErrors, error: message, status: 'FAIL',
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}

console.log('TAI_AGRO_WIDE_MOBILE_LIVE=PASS');
