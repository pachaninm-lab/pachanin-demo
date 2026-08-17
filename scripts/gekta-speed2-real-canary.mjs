#!/usr/bin/env node

import { createRequire } from 'node:module';
import { prepareAnonymousPage, measurePreparedPage } from './gekta-speed-browser-baseline.mjs';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const CASES = Object.freeze({
  'ru-cold': Object.freeze({
    locale: 'ru',
    question: 'Почему весной желтеют листья озимой пшеницы? Назови основные причины и что проверить сначала.',
    history: Object.freeze([]),
    quality: /(азот|корн|влаг|переувлаж|мороз|болез|почв)/iu,
  }),
  'ru-repeat': Object.freeze({
    locale: 'ru',
    question: 'Если пожелтение озимой пшеницы идёт очагами, что проверить в поле первым шагом?',
    history: Object.freeze([]),
    quality: /(осмотр|корн|почв|влаг|дренаж|болез|питан)/iu,
  }),
  'en': Object.freeze({
    locale: 'en',
    question: 'Why can winter wheat leaves turn yellow in spring, and what should be checked first in the field?',
    history: Object.freeze([]),
    quality: /(nitrogen|root|water|drain|frost|disease|soil|nutrient)/iu,
  }),
  'zh': Object.freeze({
    locale: 'zh',
    question: '冬小麦春季叶片发黄常见原因有哪些？田间首先应检查什么？',
    history: Object.freeze([]),
    quality: /(氮|根|水|湿|冻|病|土|养分)/u,
  }),
  'follow-up': Object.freeze({
    locale: 'ru',
    question: 'Если корни потемнели и есть неприятный запах, как это меняет приоритет проверки?',
    history: Object.freeze([
      Object.freeze({ role: 'user', text: 'У озимой пшеницы весной очагами желтеют листья.' }),
      Object.freeze({ role: 'assistant', text: 'Нужно различить питание, переувлажнение, повреждение корней, холодовой стресс и болезни по полевым признакам.' }),
    ]),
    quality: /(корн|гнил|переувлаж|дренаж|кислород|инфек|болез)/iu,
  }),
});

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const baseUrl = arg('base-url');
const caseId = arg('case-id');
const timeoutMs = Number(arg('timeout-ms') || '60000');
if (!baseUrl || !caseId || !CASES[caseId] || !Number.isFinite(timeoutMs) || timeoutMs < 5000 || timeoutMs > 150000) {
  process.exit(2);
}

const selected = CASES[caseId];
const browser = await chromium.launch({ headless: true });
let surface;
try {
  surface = await prepareAnonymousPage(browser, baseUrl, `speed2-${caseId}-${Date.now()}`);
  const sample = await measurePreparedPage(surface.page, {
    question: selected.question,
    locale: selected.locale,
    history: selected.history,
    timeoutMs,
    conversationId: `speed2-${caseId}-${Date.now()}`,
  });
  const answerText = String(sample.answerText || '');
  const qualityPass = sample.ok === true
    && sample.modelBacked === true
    && sample.source === 'local_qwen'
    && selected.quality.test(answerText)
    && !/<\/?(?:think(?:ing)?|analysis|reasoning|scratchpad)/iu.test(answerText);
  const evidence = {
    schema: 'gekta.speed2.real-canary.sample.v1',
    caseId,
    locale: selected.locale,
    ok: sample.ok === true,
    qualityPass,
    error: sample.error || null,
    reservationMs: sample.reservationMs,
    headersMs: sample.headersMs,
    firstTokenMs: sample.firstTokenMs,
    firstMeaningfulTextMs: sample.firstMeaningfulTextMs,
    completedMs: sample.completedMs,
    answerChars: sample.answerChars,
    meaningfulChars: sample.meaningfulChars,
    tokenFrames: sample.tokenFrames,
    source: sample.source,
    answerMode: sample.answerMode,
    streaming: sample.streaming,
    modelBacked: sample.modelBacked === true,
    promptContentPublished: false,
    answerContentPublished: false,
    userDataUsed: false,
  };
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
  if (!qualityPass) process.exitCode = 40;
} finally {
  await surface?.context?.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
