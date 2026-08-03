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
  {
    id: 'potato-fertilizer', locale: 'ru', question: 'Чем удобрять картошку', subject: ['картоф'],
    supportGroups: [
      ['удобрен', 'подкорм'], ['калий', 'калийн'], ['фосфор', 'фосфорн'], ['азот', 'азотн'],
      ['почв', 'грунт'], ['органик', 'компост', 'перегно', 'навоз'], ['анализ почв', 'ph'],
    ],
  },
  {
    id: 'cucumber-yellow-leaves', locale: 'ru', question: 'Почему желтеют листья у огурцов в теплице?', subject: ['огур'],
    supportGroups: [
      ['полив', 'переувлажн', 'недополив'], ['питан', 'дефицит', 'азот', 'магни', 'желез'],
      ['корн', 'корне'], ['болезн', 'инфекц', 'гриб'], ['температур', 'жар', 'холод'], ['влажн', 'микроклимат'],
    ],
  },
  {
    id: 'wheat-low-yield', locale: 'ru', question: 'Почему падает урожайность озимой пшеницы?', subject: ['пшениц'],
    supportGroups: [
      ['почв', 'плодород'], ['влаг', 'засух', 'переувлажн'], ['питан', 'азот', 'фосфор', 'калий'],
      ['болезн', 'вредител'], ['сорняк'], ['сорт', 'семен'], ['срок посев', 'густот', 'норм высев'],
    ],
  },
  {
    id: 'tomato-blossom-drop', locale: 'ru', question: 'Почему у томатов опадают цветки?', subject: ['томат'],
    supportGroups: [
      ['температур', 'жар', 'холод'], ['влажн', 'сух'], ['опыл'], ['полив', 'вода'],
      ['питан', 'азот', 'бор', 'калий'], ['стресс'],
    ],
  },
  {
    id: 'apple-scab', locale: 'ru', question: 'Как снизить риск парши в яблоневом саду?', subject: ['яблон', 'парш'],
    supportGroups: [
      ['обработ', 'опрыскив', 'фунгиц'], ['лист', 'опавш', 'санитар'], ['влаг', 'дожд', 'проветр'],
      ['обрез', 'крон'], ['устойчив', 'сорт'], ['монитор', 'осмотр'],
    ],
  },
  {
    id: 'soil-acidity', locale: 'ru', question: 'Что делать с кислой почвой на участке?', subject: ['почв'],
    supportGroups: [
      ['ph', 'кислот'], ['анализ', 'измер'], ['извест', 'доломит', 'мел'], ['доз', 'норм внес'],
      ['культур', 'растен'], ['органик', 'компост'],
    ],
  },
  {
    id: 'drip-irrigation', locale: 'ru', question: 'Как подобрать капельный полив для небольшого огорода?', subject: ['капель', 'полив'],
    supportGroups: [
      ['давлен', 'напор', 'редуктор'], ['расход', 'дебит', 'производительност'],
      ['фильтр', 'фильтрац', 'засор', 'качество вод'],
      ['лент', 'шланг', 'капельниц', 'эмиттер', 'магистрал', 'труб'],
      ['зон', 'гряд', 'ряд', 'площад', 'длин', 'схем размещ'],
      ['бак', 'насос', 'источник вод', 'емкост'], ['почв', 'культур', 'потребност', 'норм полив'],
    ],
  },
  {
    id: 'cow-milk-drop', locale: 'ru', question: 'Почему у коров снизился удой?', subject: ['коров', 'удой'],
    supportGroups: [
      ['корм', 'рацион', 'энерги', 'протеин'], ['вода', 'поен'], ['здоров', 'мастит', 'болезн'],
      ['стресс', 'перегрев', 'температур'], ['доен', 'оборудован'], ['лактац', 'стад'],
    ],
  },
  {
    id: 'pig-feed-conversion', locale: 'ru', question: 'Как улучшить конверсию корма у свиней?', subject: ['свин'],
    supportGroups: [
      ['корм', 'рацион', 'протеин', 'энерги'], ['привес', 'рост', 'конверси'], ['здоров', 'болезн', 'паразит'],
      ['микроклимат', 'температур', 'вентиляц'], ['вода', 'поил'], ['групп', 'плотност'],
    ],
  },
  {
    id: 'chicken-egg-drop', locale: 'ru', question: 'Почему куры стали хуже нестись?', subject: ['кур', 'несуш'],
    supportGroups: [
      ['корм', 'рацион', 'кальци', 'протеин'], ['свет', 'светов', 'длин дня'], ['температур', 'жар', 'холод'],
      ['стресс'], ['здоров', 'болезн', 'паразит'], ['возраст', 'линьк'], ['вода', 'поил'],
    ],
  },
  {
    id: 'bee-wintering', locale: 'ru', question: 'Как подготовить пчёл к зимовке?', subject: ['пчел'],
    supportGroups: [
      ['корм', 'мед', 'запас'], ['клещ', 'варро'], ['семь', 'сил колони'], ['вентиляц', 'влажн'],
      ['матк'], ['утепл', 'улей'], ['осмотр', 'обработ'],
    ],
  },
  {
    id: 'tractor-overheat', locale: 'ru', question: 'Почему трактор перегревается под нагрузкой?', subject: ['трактор'],
    supportGroups: [
      ['радиатор', 'сот'], ['охлажд', 'антифриз', 'жидкост'], ['термостат'], ['насос', 'помп'],
      ['вентилятор', 'ремень'], ['нагруз', 'оборот'], ['масл'],
    ],
  },
  {
    id: 'combine-losses', locale: 'ru', question: 'Как уменьшить потери зерна за комбайном?', subject: ['комбайн', 'зерн'],
    supportGroups: [
      ['скорост', 'подач'], ['молотил', 'барабан', 'ротор', 'подбарабан'], ['решет', 'сито'],
      ['вентилятор', 'воздуш'], ['жатк', 'высот срез'], ['влажн'], ['настрой', 'калибров'],
    ],
  },
  {
    id: 'mower-vibration', locale: 'ru', question: 'Почему сильно вибрирует газонокосилка?', subject: ['газонокос'],
    supportGroups: [
      ['нож', 'лезви'], ['баланс', 'деформац'], ['креплен', 'болт'], ['вал', 'шпиндел'],
      ['подшип'], ['дек', 'корпус'], ['гряз', 'трава', 'намот'],
    ],
  },
  {
    id: 'grain-storage', locale: 'ru', question: 'Как безопасно хранить пшеницу после уборки?', subject: ['пшениц', 'хран'],
    supportGroups: [
      ['влажн'], ['температур'], ['вентиляц', 'аэраци'], ['сушк'], ['вредител', 'насеком', 'грызун'],
      ['очистк', 'сорн'], ['монитор', 'контрол'],
    ],
  },
  {
    id: 'farm-costs', locale: 'ru', question: 'Как уменьшить расходы небольшого хозяйства без потери урожайности?', subject: ['хозяйств', 'урожайн'],
    supportGroups: [
      ['затрат', 'себестоим', 'расход'], ['анализ', 'учет', 'бюджет'], ['техник', 'ремонт'],
      ['удобрен', 'семен', 'сзр'], ['топлив', 'логист'], ['план', 'нормирован'], ['урожайн', 'эффективност'],
    ],
  },
  {
    id: 'village-water', locale: 'ru', question: 'Как организовать водоснабжение фермы в деревне?', subject: ['вод', 'ферм'],
    supportGroups: [
      ['скважин', 'колод'], ['насос'], ['резерв', 'бак', 'емкост'], ['дебит', 'расход'],
      ['качество', 'анализ вод', 'фильтр'], ['труб', 'магистрал'], ['резервн', 'авари'],
    ],
  },
  {
    id: 'farm-excel', locale: 'ru', question: 'Как в Excel посчитать себестоимость тонны зерна?', subject: ['excel', 'себестоим', 'зерн'],
    supportGroups: [
      ['формул', 'делен'], ['затрат', 'расход', 'сумм'], ['тонн', 'объем', 'масса'], ['ячейк', 'таблиц'],
      ['постоянн', 'переменн'], ['итог', 'себестоим'],
    ],
  },
  {
    id: 'potato-en', locale: 'en', question: 'What should I fertilize potatoes with?', subject: ['potato'],
    supportGroups: [
      ['fertil', 'feed'], ['potassium', 'potash'], ['phosph'], ['nitrogen'], ['soil', 'ph'], ['manure', 'compost', 'organic'],
    ],
  },
  {
    id: 'cucumber-zh', locale: 'zh', question: '温室黄瓜叶子为什么发黄？', subject: ['黄瓜'],
    supportGroups: [
      ['浇水', '水分'], ['营养', '缺素', '氮', '镁', '铁'], ['根'], ['病', '真菌'], ['温度'], ['湿度', '通风'],
    ],
  },
  {
    id: 'context-followup', locale: 'ru', question: 'А без орошения?',
    history: [
      { role: 'user', content: 'Как повысить урожайность кукурузы?' },
      { role: 'assistant', content: 'Нужно оценить гибрид, почву, питание, густоту и влагу.' },
    ],
    subject: ['кукуруз', 'орошен', 'влаг'],
    supportGroups: [
      ['засух', 'влаг'], ['гибрид'], ['густот', 'норм высев'], ['почв', 'мульч'], ['срок', 'посев'], ['питан', 'удобрен'],
    ],
  },
];

const UI_CASE_IDS = new Set(['potato-fertilizer', 'cucumber-yellow-leaves', 'cow-milk-drop', 'tractor-overheat', 'farm-costs']);
const FORBIDDEN = [
  'как защищаются данные',
  'доступ назначает сервер',
  'подписанной сессии',
  'данные разных организаций изолированы',
  'журнале аудита',
  'публичный режим не имеет доступа',
  '192.168.0.206',
  'tenantid',
  'membershipid',
  'subjectid',
  'ai_assistant_api_key',
  'tai_public_gateway_hmac_secret',
];
const REFUSAL_PATTERNS = [
  'не могу ответить',
  'не относится к',
  'обратитесь к агроному',
  'обратитесь к специалисту',
  'i cannot answer',
  'i can’t answer',
  'not related to',
  '无法回答',
  '不能回答',
];

function normalize(value, locale = 'ru') {
  const tag = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
  return String(value || '').normalize('NFKC').toLocaleLowerCase(tag).replace(/ё/gu, 'е');
}

function matchedConceptGroups(answer, testCase) {
  const normalized = normalize(answer, testCase.locale);
  return testCase.supportGroups.flatMap((terms, index) => {
    const matches = terms.filter(term => normalized.includes(normalize(term, testCase.locale)));
    return matches.length ? [{ index, matches }] : [];
  });
}

function assertAgriculturalAnswer(answer, testCase, boundary) {
  const normalized = normalize(answer, testCase.locale);
  if (answer.length < 80) throw new Error(`${testCase.id}_${boundary}_answer_too_short:${answer.length}`);
  const wrong = FORBIDDEN.find(term => normalized.includes(normalize(term, testCase.locale)));
  if (wrong) throw new Error(`${testCase.id}_${boundary}_wrong_platform_article:${wrong}`);
  const refusal = REFUSAL_PATTERNS.find(term => normalized.includes(normalize(term, testCase.locale)));
  if (refusal) throw new Error(`${testCase.id}_${boundary}_refusal:${refusal}`);
  if (!testCase.subject.some(term => normalized.includes(normalize(term, testCase.locale)))) {
    throw new Error(`${testCase.id}_${boundary}_subject_missing`);
  }
  const conceptMatches = matchedConceptGroups(answer, testCase);
  const minimum = testCase.minConceptGroups ?? 2;
  if (conceptMatches.length < minimum) {
    throw new Error(`${testCase.id}_${boundary}_substance_missing:${conceptMatches.flatMap(group => group.matches).join(',')}`);
  }
  return conceptMatches;
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
const progressPath = path.join(evidenceDir, 'agro-wide-answer-progress.json');
function writeProgress(status = 'IN_PROGRESS') {
  fs.writeFileSync(progressPath, JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance-progress.v1',
    targetSha,
    manifestSha,
    endpointCaseCount: CASES.length,
    uiCaseCount: UI_CASE_IDS.size,
    cases: evidence,
    pageErrors,
    status,
  }, null, 2));
}

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
  writeProgress();

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
      answerCharacters: answer.length,
      answer,
      source: assessment?.source || null,
      modelIdentity: assessment?.modelIdentity || null,
      answerMode: assessment?.answerMode || null,
      streamComplete: done?.event === 'done' && done.complete === true,
    };
    evidence.push(row);
    writeProgress();

    if (!assessment) throw new Error(`${testCase.id}_assessment_missing`);
    if (assessment.source !== 'local_qwen') throw new Error(`${testCase.id}_source_invalid:${assessment.source}`);
    if (assessment.modelIdentity !== 'tai-qwen3-8b-q4km') throw new Error(`${testCase.id}_model_identity_invalid`);
    if (assessment.answerMode !== 'general_agro') throw new Error(`${testCase.id}_answer_mode_invalid:${assessment.answerMode}`);
    if (done?.event !== 'done' || done.complete !== true) throw new Error(`${testCase.id}_stream_incomplete`);
    row.matchedConceptGroups = assertAgriculturalAnswer(answer, testCase, 'endpoint');
    writeProgress();
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
    row.ui = { viewport: '390x844', answerCharacters: uiAnswer.length, answer: uiAnswer };
    writeProgress();
    row.ui.matchedConceptGroups = assertAgriculturalAnswer(uiAnswer, testCase, 'ui');
    writeProgress();
  }

  if (await dialog.locator('[role="alert"]').count()) throw new Error('agro_ui_alert_present');
  if (pageErrors.length) throw new Error(`agro_page_errors:${pageErrors.join('|')}`);
  await page.screenshot({ path: path.join(evidenceDir, 'agro-wide-answer-390x844.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'agro-wide-answer.json'), JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance.v1', targetSha, manifestSha,
    endpointCaseCount: CASES.length, uiCaseCount: UI_CASE_IDS.size, cases: evidence,
    forbiddenPlatformArticleAbsent: true, refusalOnlyAnswersAbsent: true, status: 'PASS',
  }, null, 2));
  writeProgress('PASS');
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await page.screenshot({ path: path.join(evidenceDir, 'agro-wide-answer-failure-390x844.png'), fullPage: true }).catch(() => undefined);
  fs.writeFileSync(path.join(evidenceDir, 'agro-wide-answer-failure.json'), JSON.stringify({
    schemaVersion: 'tai.agro-wide-mobile.acceptance-failure.v1', targetSha, manifestSha,
    endpointCaseCount: CASES.length, uiCaseCount: UI_CASE_IDS.size, cases: evidence, pageErrors, error: message, status: 'FAIL',
  }, null, 2));
  writeProgress('FAIL');
  throw error;
} finally {
  await browser.close();
}

console.log('TAI_AGRO_WIDE_MOBILE_LIVE=PASS');
