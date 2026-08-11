#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { IDENTITY_AUTHORITY, assertRealGeneralQwen } from './tai-public-assessment-contract.mjs';
import { requireSubject, requireSubjectDominance } from './tai-conversation-subject-contract.mjs';

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
let conversationalBreadth = null;
let progressiveRendering = null;
let multiTurn = null;
let explicitCorrection = null;
let topicShift = null;
let newConversation = null;
let stopControl = null;
let retryControl = null;
let widthSafety = null;

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

async function requestPublicSse({ locale, question, history = [] }) {
  const text = await page.evaluate(async ({ locale, question, history }) => {
    const response = await fetch('/api/public-platform-assistant?stream=1', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message: question, locale, history }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!response.ok) throw new Error(`sse_http_${response.status}`);
    return response.text();
  }, { locale, question, history });
  const frames = parseSseFrames(text);
  const assessmentFrame = frames.find(frame => frame.event === 'assessment');
  const done = frames.at(-1);
  const assessment = assessmentFrame?.summary ? JSON.parse(String(assessmentFrame.summary)) : null;
  const answer = frames.filter(frame => frame.event === 'token').map(frame => String(frame.text || '')).join('').trim();
  return { text, frames, assessment, done, answer };
}

/* ── Browser matrix helpers ───────────────────────────────────────────────
 *
 * Everything below drives the real panel. The SSE checks above prove the
 * transport streams; these prove the reader *sees* it stream, that context
 * survives across turns, and that the controls behave. They are deliberately
 * in this governed script rather than a parallel workflow.
 */

/**
 * Control labels per locale.
 *
 * The panel is fully localized, so a Russian aria-label finds nothing on the
 * EN or ZH panel — and the multi-turn cases open exactly those. Keyed by the
 * same locale the panel was opened with, so a case cannot silently drive the
 * wrong panel.
 */
const UI_COPY = {
  ru: {
    title: 'Гекта',
    subtitle: 'Аграрный интеллект для земли, урожая и решений.',
    composer: 'Спроси Гекту о земле, урожае или агробизнесе',
    send: 'Отправить',
    stop: 'Остановить ответ',
    newChat: 'Новый диалог',
    retry: 'Повторить запрос',
  },
  en: {
    title: 'Gekta',
    subtitle: 'Agricultural intelligence for land, crops and decisions.',
    composer: 'Ask Gekta about land, crops or agribusiness',
    send: 'Send',
    stop: 'Stop answer',
    newChat: 'New chat',
    retry: 'Retry request',
  },
  zh: {
    title: 'Gekta',
    subtitle: '服务于土地、作物与决策的农业智能。',
    composer: '向 Gekta 咨询土地、作物或农业经营',
    send: '发送',
    stop: '停止回答',
    newChat: '新对话',
    retry: '重试问题',
  },
};

function uiFor(lang) {
  const copy = UI_COPY[lang];
  if (!copy) throw new Error(`ui_copy_missing:${lang}`);
  return copy;
}

const UI = UI_COPY.ru;

const RETIRED_PUBLIC_IDENTITY_PATTERN = /\bTAI\b|Transparent Agro Intelligence|ИИ для агробизнеса|AI for agribusiness|农业商业人工智能/u;

async function assertNoRetiredPublicIdentity(page, lang) {
  const visibleText = await page.locator('body').innerText();
  const retiredIdentity = visibleText.match(RETIRED_PUBLIC_IDENTITY_PATTERN)?.[0];
  if (retiredIdentity) throw new Error(`retired_public_identity_visible:${lang}:${retiredIdentity}`);
}

/**
 * Open the assistant panel on a fresh page load in `lang`.
 *
 * Reloading is what makes each matrix case independent: the panel restores its
 * transcript from session storage, so reusing a page would let one case's
 * conversation state answer another case's follow-up and the multi-turn results
 * would prove nothing.
 */
async function openAssistantPanel(page, lang) {
  const response = await page.goto(`${liveBase}/platform-v7?lang=${lang}&release=${targetSha}`, {
    waitUntil: 'domcontentloaded', timeout: 120_000,
  });
  if (!response?.ok()) throw new Error(`live_page_http_${response?.status()}:${lang}`);
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });

  const hidden = page.locator('.pc-public-assistant-shortcut');
  await hidden.waitFor({ state: 'attached', timeout: 30_000 });
  const dock = page.locator('.pc-public-contact-dock-assistant');
  await page.evaluate(() => window.scrollTo(0, 180));
  try {
    await dock.waitFor({ state: 'visible', timeout: 10_000 });
    await dock.click();
  } catch {
    await hidden.evaluate(node => node.click());
  }
  const dialog = page.locator('#pc-public-assistant-panel');
  try { await dialog.waitFor({ state: 'visible', timeout: 5_000 }); }
  catch { await hidden.evaluate(node => node.click()); }
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  const copy = uiFor(lang);
  const panelTitle = ((await dialog.locator('#pc-public-assistant-title').textContent()) || '').trim();
  const panelSubtitle = ((await dialog.locator('[data-pc-public-assistant-subtitle="true"]:visible').textContent()) || '').trim();
  if (panelTitle !== copy.title) throw new Error(`gekta_title_mismatch:${lang}:${panelTitle}`);
  if (panelSubtitle !== copy.subtitle) throw new Error(`gekta_subtitle_mismatch:${lang}:${panelSubtitle}`);
  await assertNoRetiredPublicIdentity(page, lang);
  return dialog;
}

/**
 * Every answer the matrix has seen, kept so a failure can be diagnosed.
 *
 * The first live run failed on the correction case and there was no way to tell
 * whether the model had ignored the correction or had simply used a synonym the
 * term list missed — the answer existed only inside a Playwright variable, and
 * the uploaded artifact is not reachable from every environment that needs to
 * read it. An assertion that cannot be investigated when it fires is only half a
 * check, so the observed text now goes to the job log as well.
 */
const observations = [];

function observe(id, question, answer) {
  observations.push({ id, question, answer });
  return answer;
}

function reportObservations() {
  if (observations.length === 0) return;
  process.stderr.write('\n===== MATRIX OBSERVATIONS =====\n');
  for (const row of observations) {
    process.stderr.write(`--- ${row.id}\n  Q: ${row.question}\n  A: ${row.answer.slice(0, 700)}\n`);
  }
  process.stderr.write('===== END MATRIX OBSERVATIONS =====\n\n');
}

const ASSISTANT = '.pc-public-assistant-message[data-role="assistant"]';
const STREAMING = `${ASSISTANT}[data-stream-status="streaming"]`;
const ANSWERED = `${ASSISTANT}[data-stream-status="answered"]`;
const USER_TURN = '.pc-public-assistant-message[data-role="user"]';

async function answeredCount(dialog) {
  return dialog.locator(ANSWERED).count();
}

/**
 * All assistant turns, however they settled.
 *
 * Indexing by answered-count only holds while every prior turn answered; one
 * refusal makes the two counts diverge and every later index points at the
 * wrong message. The position of a turn is what identifies it, not its outcome.
 */
async function assistantCount(dialog) {
  return dialog.locator(ASSISTANT).count();
}

/** Send one question through the composer and wait for a settled answer. */
async function askInPanel(dialog, question, { timeout = 240_000, lang = 'ru' } = {}) {
  const ui = uiFor(lang);
  const before = await assistantCount(dialog);
  await dialog.getByRole('textbox', { name: ui.composer }).fill(question);
  await dialog.getByRole('button', { name: ui.send }).click();

  try {
    // Wait for the turn to *settle*, not specifically to succeed. A refusal
    // settles as `refused`, and a knowledge-base fallback renders with no
    // stream status at all — waiting only for `answered` cannot observe either,
    // so a failed turn looked identical to a slow one and cost four minutes to
    // report nothing. Settle first, then judge what settled.
    await dialog.page().waitForFunction(
      ({ assistant, streaming, want }) => {
        const messages = document.querySelectorAll(`#pc-public-assistant-panel ${assistant}`);
        if (messages.length <= want) return false;
        return document.querySelectorAll(`#pc-public-assistant-panel ${streaming}`).length === 0;
      },
      { assistant: ASSISTANT, streaming: STREAMING, want: before },
      { timeout, polling: 500 },
    );
  } catch (cause) {
    const state = await panelState(dialog);
    observe(`ask[${lang}] NEVER SETTLED`, question, JSON.stringify(state));
    throw new Error(`ui_answer_never_settled:${lang}:${JSON.stringify(state)}`, { cause });
  }

  // Judged outside the wait, so a turn that settled the wrong way reports what
  // it actually was instead of being reported as a timeout.
  const settled = dialog.locator(ASSISTANT).nth(before);
  const status = await settled.getAttribute('data-stream-status');
  if (status !== 'answered') {
    const text = ((await settled.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
    observe(`ask[${lang}] NOT ANSWERED (${status ?? 'no-stream-status'})`, question, text);
    throw new Error(`ui_turn_not_answered:${lang}:${status ?? 'no-stream-status'}:${text.slice(0, 200)}`);
  }

  const answer = ((await settled.locator('.pc-public-assistant-bubble').textContent()) || '').trim();
  return observe(`ask[${lang}]`, question, answer);
}

/** What the panel is actually showing, for when a wait does not resolve. */
async function panelState(dialog) {
  return dialog.evaluate(node => ({
    assistantMessages: Array.from(node.querySelectorAll('.pc-public-assistant-message[data-role="assistant"]'))
      .map(message => ({
        status: message.getAttribute('data-stream-status'),
        text: (message.querySelector('.pc-public-assistant-bubble')?.textContent || '').trim().slice(0, 300),
      })),
    userMessages: node.querySelectorAll('.pc-public-assistant-message[data-role="user"]').length,
    alert: (node.querySelector('[role="alert"]')?.textContent || '').trim().slice(0, 300),
    processing: node.querySelectorAll('.pc-public-assistant-processing').length,
    composerValue: (node.querySelector('textarea')?.value || '').slice(0, 120),
  }));
}

/**
 * A. Progressive rendering.
 *
 * The proof is ordering, not speed: substantive text must be on screen while
 * the message is still marked streaming, and no answered message may exist at
 * that moment. Waiting only for the final state — which is all this script used
 * to do — passes identically for a route that buffered the whole answer and
 * revealed it at the end.
 */
async function verifyProgressiveRendering(page, dialog) {
  const before = await answeredCount(dialog);
  await dialog.getByRole('textbox', { name: UI.composer })
    .fill('Подробно объясни, как планировать севооборот на пять лет для зерновых и пропашных культур.');
  const startedAt = Date.now();
  await dialog.getByRole('button', { name: UI.send }).click();

  const streaming = dialog.locator(STREAMING).last();
  await streaming.waitFor({ state: 'visible', timeout: 240_000 });

  // Poll for substantive text that is visible *while still streaming*.
  const partial = await page.waitForFunction(({ streamingSelector, answeredSelector, floor }) => {
    const node = document.querySelectorAll(streamingSelector);
    const last = node[node.length - 1];
    if (!last) return null;
    const bubble = last.querySelector('.pc-public-assistant-bubble');
    const text = (bubble?.textContent || '').trim();
    if (text.length < floor) return null;
    return { text: text.slice(0, 400), answeredNow: document.querySelectorAll(answeredSelector).length };
  }, { streamingSelector: STREAMING, answeredSelector: ANSWERED, floor: 40 }, { timeout: 240_000, polling: 100 });

  const observed = await partial.jsonValue();
  const firstVisibleContentAt = Date.now() - startedAt;

  // Nothing may have completed yet — otherwise the "partial" text could be a
  // finished answer and the ordering would prove nothing.
  if (observed.answeredNow > before) {
    throw new Error(`ui_progressive_answer_already_complete:${observed.answeredNow}`);
  }

  await dialog.locator(ANSWERED).nth(before).waitFor({ state: 'visible', timeout: 240_000 });
  const doneVisibleAt = Date.now() - startedAt;
  const full = ((await dialog.locator(ANSWERED).nth(before).locator('.pc-public-assistant-bubble').textContent()) || '').trim();

  if (!(firstVisibleContentAt < doneVisibleAt)) {
    throw new Error(`ui_progressive_ordering_invalid:${firstVisibleContentAt}:${doneVisibleAt}`);
  }
  if (full.length <= observed.text.length) throw new Error(`ui_progressive_no_growth:${observed.text.length}:${full.length}`);

  return {
    firstVisibleContentAt,
    doneVisibleAt,
    partialCharacters: observed.text.length,
    finalCharacters: full.length,
    answeredWhilePartial: observed.answeredNow - before,
    status: 'PASS',
  };
}

/** B. Multi-turn: a short follow-up must resolve against the live subject. */
async function verifyMultiTurn(page, openPanel) {
  const cases = [
    {
      id: 'ru',
      lang: 'ru',
      first: 'Почему падает урожайность озимой пшеницы?',
      followUp: 'А что проверить в первую очередь?',
      subject: ['пшениц', 'озим', 'урожай', 'посев', 'почв'],
    },
    {
      id: 'en',
      lang: 'en',
      first: 'Why is winter wheat yield falling?',
      followUp: 'And what should I check first?',
      subject: ['wheat', 'yield', 'soil', 'sowing', 'winter'],
    },
    {
      id: 'zh',
      lang: 'zh',
      first: '冬小麦产量为什么下降？',
      followUp: '那应该先检查什么？',
      subject: ['小麦', '产量', '土壤', '播种', '冬'],
    },
  ];

  const results = [];
  for (const testCase of cases) {
    const dlg = await openPanel(testCase.lang);
    const first = await askInPanel(dlg, testCase.first, { lang: testCase.lang });
    const followUp = await askInPanel(dlg, testCase.followUp, { lang: testCase.lang });

    // The follow-up names no subject of its own, so a matching subject term can
    // only have come from retained conversation state.
    const hits = requireSubject({ id: `multiturn-${testCase.id}`, answer: followUp, expect: testCase.subject });
    if (followUp.length < 40) throw new Error(`ui_follow_up_too_short:${testCase.id}:${followUp.length}`);

    results.push({
      id: testCase.id,
      firstCharacters: first.length,
      followUpCharacters: followUp.length,
      resolvedSubjectTerms: hits,
      status: 'PASS',
    });
  }
  return results;
}

/** C. An explicit correction outranks the fact it replaces. */
async function verifyExplicitCorrection(dialog) {
  await askInPanel(dialog, 'У меня поле озимой пшеницы 120 гектаров, планирую подкормку.');
  await askInPanel(dialog, 'Извини, я ошибся: это не пшеница, а картофель, и площадь 40 гектаров.');
  const answer = await askInPanel(dialog, 'С учётом этого, для какой культуры и как планировать подкормку?');

  // The correction must have taken: potato leads, wheat does not.
  const dominance = requireSubjectDominance({
    id: 'correction',
    answer,
    current: ['картоф', 'картош', 'клубн'],
    superseded: ['пшениц'],
  });
  return {
    correctedSubjectTerms: dominance.currentHits,
    currentSubjectMentions: dominance.currentCount,
    supersededSubjectMentions: dominance.supersededCount,
    answerCharacters: answer.length,
    status: 'PASS',
  };
}

/** D. A topic shift clears subject-bound state instead of blending it. */
async function verifyTopicShift(dialog) {
  await askInPanel(dialog, 'Почему у коров снизился удой?');
  const answer = await askInPanel(dialog, 'Теперь другой вопрос: почему перегревается трактор под нагрузкой?');

  const dominance = requireSubjectDominance({
    id: 'topic-shift',
    answer,
    current: ['трактор', 'охлажд', 'радиатор', 'двигател', 'нагруз'],
    superseded: ['удой', 'дойн', 'коров'],
    minimumCurrent: 2,
  });
  return {
    newSubjectTerms: dominance.currentHits,
    currentSubjectMentions: dominance.currentCount,
    supersededSubjectMentions: dominance.supersededCount,
    answerCharacters: answer.length,
    status: 'PASS',
  };
}

/**
 * E. New Conversation inherits nothing — proven on the wire, not just on screen.
 *
 * The next request body must carry an empty history; a cleared transcript with
 * a populated history would still leak the old subject into the model.
 */
async function verifyNewConversation(page, dialog) {
  // Two exchanges, not one: the panel only asks for confirmation once the
  // conversation is longer than a single turn, so a shorter setup would skip
  // the dialog a reader actually meets.
  await askInPanel(dialog, 'Почему желтеют листья у огурцов в теплице?');
  await askInPanel(dialog, 'А если полив нормальный?');

  let confirmed = false;
  page.once('dialog', confirmation => {
    confirmed = true;
    confirmation.accept().catch(() => undefined);
  });
  await dialog.getByRole('button', { name: UI.newChat }).click();

  await page.waitForFunction(
    selector => document.querySelectorAll(selector).length === 0,
    `${USER_TURN}, ${ASSISTANT}`,
    { timeout: 30_000 },
  );
  const remaining = await dialog.locator(`${USER_TURN}, ${ASSISTANT}`).count();
  if (remaining !== 0) throw new Error(`ui_new_conversation_not_empty:${remaining}`);

  const nextRequest = page.waitForRequest(
    request => request.url().includes('/api/public-platform-assistant') && request.method() === 'POST',
    { timeout: 60_000 },
  );
  await dialog.getByRole('textbox', { name: UI.composer }).fill('Чем подкормить томаты?');
  await dialog.getByRole('button', { name: UI.send }).click();
  const request = await nextRequest;

  let body = {};
  try { body = JSON.parse(request.postData() || '{}'); } catch { throw new Error('ui_new_conversation_body_unreadable'); }
  const history = Array.isArray(body.history) ? body.history : null;
  if (history === null) throw new Error('ui_new_conversation_history_missing');
  if (history.length !== 0) throw new Error(`ui_new_conversation_history_inherited:${history.length}`);
  if (JSON.stringify(body).includes('огурц')) throw new Error('ui_new_conversation_subject_inherited');

  await dialog.locator(ANSWERED).first().waitFor({ state: 'visible', timeout: 240_000 });
  return { historyLength: history.length, inheritedSubject: false, confirmationAccepted: confirmed, status: 'PASS' };
}

/** F. Stop ends generation promptly and leaves the panel usable. */
async function verifyStop(page, dialog) {
  await dialog.getByRole('textbox', { name: UI.composer })
    .fill('Максимально подробно опиши полный годовой план работ для молочной фермы на 400 голов.');
  await dialog.getByRole('button', { name: UI.send }).click();

  const streaming = dialog.locator(STREAMING).last();
  await streaming.waitFor({ state: 'visible', timeout: 240_000 });
  const partial = ((await streaming.locator('.pc-public-assistant-bubble').textContent()) || '').trim();

  const stopButton = dialog.getByRole('button', { name: UI.stop });
  await stopButton.waitFor({ state: 'visible', timeout: 30_000 });
  const stoppedAt = Date.now();
  await stopButton.click();

  // The streaming indicator must terminate, and the send control must come back
  // — a panel stuck on a spinner is the failure this guards.
  await page.waitForFunction(
    selector => document.querySelectorAll(selector).length === 0,
    STREAMING,
    { timeout: 15_000 },
  );
  const stopLatencyMs = Date.now() - stoppedAt;
  await dialog.getByRole('button', { name: UI.send }).waitFor({ state: 'visible', timeout: 15_000 });
  if (await dialog.locator('.pc-public-assistant-processing').count()) throw new Error('ui_stop_spinner_stuck');
  // A deliberate halt is not an error, and must not be reported to the reader
  // as one.
  if (await dialog.locator('[role="alert"]').count()) throw new Error('ui_stop_reported_as_error');

  // Whatever had already been emitted stays readable rather than vanishing.
  const retained = ((await dialog.locator(ASSISTANT).last().locator('.pc-public-assistant-bubble').textContent()) || '').trim();
  if (partial.length > 0 && retained.length === 0) throw new Error('ui_stop_discarded_partial_answer');

  // And the panel still works afterwards.
  const recovery = await askInPanel(dialog, 'Как хранить зерно после уборки?');
  if (recovery.length < 40) throw new Error(`ui_stop_recovery_failed:${recovery.length}`);

  return {
    stopLatencyMs,
    partialCharacters: partial.length,
    retainedCharacters: retained.length,
    recoveryCharacters: recovery.length,
    status: 'PASS',
  };
}

/** G. Retry regenerates without re-asking — no duplicated user turn. */
async function verifyRetry(dialog) {
  const question = 'Чем удобрять картофель?';
  await askInPanel(dialog, question);

  const userTurnsBefore = await dialog.locator(USER_TURN).count();
  const answeredBefore = await answeredCount(dialog);

  await dialog.getByRole('button', { name: UI.retry }).last().click();

  // The replacement lands at the same index the old answer occupied, so waiting
  // for that index alone can match the answer still on screen. Wait for the
  // regeneration to start, then for it to settle.
  await dialog.locator(STREAMING).first().waitFor({ state: 'visible', timeout: 240_000 });
  await dialog.locator(ANSWERED).nth(answeredBefore - 1).waitFor({ state: 'visible', timeout: 240_000 });
  await dialog.page().waitForFunction(
    selector => document.querySelectorAll(selector).length === 0,
    STREAMING,
    { timeout: 240_000 },
  );

  const userTurnsAfter = await dialog.locator(USER_TURN).count();
  const answeredAfter = await answeredCount(dialog);
  if (userTurnsAfter !== userTurnsBefore) throw new Error(`ui_retry_duplicated_user_turn:${userTurnsBefore}:${userTurnsAfter}`);
  if (answeredAfter !== answeredBefore) throw new Error(`ui_retry_duplicated_answer:${answeredBefore}:${answeredAfter}`);

  const visibleQuestions = await dialog.locator(USER_TURN).allTextContents();
  const repeats = visibleQuestions.filter(text => text.includes(question)).length;
  if (repeats !== 1) throw new Error(`ui_retry_question_repeated:${repeats}`);

  // The regenerated answer must still be usable context for the next turn.
  const next = await askInPanel(dialog, 'А когда именно вносить?');
  requireSubject({ id: 'retry-followup', answer: next, expect: ['картоф', 'подкорм', 'внесен', 'посадк', 'клубн'] });

  return { userTurns: userTurnsAfter, answeredMessages: answeredAfter, followUpCharacters: next.length, status: 'PASS' };
}

/** H. The panel stays inside the viewport at the widths readers actually use. */
async function verifyWidths(page, openPanel) {
  const results = [];
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const dialog = await openPanel('ru');
    await askInPanel(dialog, 'Как подготовить пчёл к зимовке?');

    const geometry = await dialog.evaluate(node => ({
      horizontal: node.scrollWidth - node.clientWidth,
      viewportRight: node.getBoundingClientRect().right - window.innerWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    if (geometry.horizontal > 1 || geometry.viewportRight > 1) {
      throw new Error(`ui_width_overflow:${width}:${JSON.stringify(geometry)}`);
    }
    if (geometry.documentOverflow > 1) throw new Error(`ui_width_document_overflow:${width}:${geometry.documentOverflow}`);
    if (await dialog.locator('.pc-modal-sheet-fullscreen-button').count()) {
      throw new Error(`ui_width_duplicate_fullscreen_control:${width}`);
    }

    // Every control a reader needs mid-conversation must be reachable and big
    // enough to hit, not merely present in the DOM.
    const controls = {};
    for (const [name, label] of [['send', UI.send], ['newChat', UI.newChat], ['retry', UI.retry]]) {
      const control = dialog.getByRole('button', { name: label }).last();
      if (!await control.count()) throw new Error(`ui_width_control_missing:${width}:${name}`);
      const box = await control.boundingBox();
      if (!box) throw new Error(`ui_width_control_not_rendered:${width}:${name}`);
      if (box.width < 24 || box.height < 24) throw new Error(`ui_width_control_too_small:${width}:${name}:${box.width}x${box.height}`);
      if (box.x < -1 || box.x + box.width > width + 1) throw new Error(`ui_width_control_offscreen:${width}:${name}`);
      controls[name] = { width: Math.round(box.width), height: Math.round(box.height) };
    }

    await page.screenshot({ path: path.join(evidenceDir, `public-ai-window-${width}x844.png`), fullPage: true });
    results.push({ width, ...geometry, controls, status: 'PASS' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  return results;
}

function assertNoThematicRefusal({ id, locale, answer, expectedTerms = [] }) {
  const normalized = answer.normalize('NFKC').toLocaleLowerCase(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU');
  const refusalPatterns = locale === 'en'
    ? [/outside (?:my|the) (?:area|scope|domain)/iu, /i (?:only )?speciali[sz]e in agriculture/iu, /cannot help with this unrelated/iu]
    : locale === 'zh'
      ? [/不在我的(?:专业)?范围/u, /我只专注于农业/u, /无法帮助这个无关/u]
      : [/это не моя область/iu, /здесь я не помогу/iu, /я занимаюсь только (?:сельским хозяйством|агробизнесом)/iu, /не относится к моей специализации/iu];
  const refusal = refusalPatterns.find(pattern => pattern.test(normalized));
  if (refusal) throw new Error(`sse_thematic_refusal:${id}:${refusal.source}`);
  if (expectedTerms.length && !expectedTerms.some(term => normalized.includes(term.toLocaleLowerCase(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU')))) {
    throw new Error(`sse_expected_substance_missing:${id}:${expectedTerms.join(',')}`);
  }
}

async function verifyRealQwenSse() {
  const cases = [
    ['ru', 'Что влияет на цену зерна?'],
    ['en', 'What affects grain prices?'],
    ['zh', '哪些因素影响粮食价格？'],
  ];
  const results = [];
  for (const [locale, question] of cases) {
    const response = await requestPublicSse({ locale, question });
    const verified = assertRealGeneralQwen({
      id: locale,
      locale,
      ...response,
      minimumAnswerCharacters: 80,
    });
    assertNoThematicRefusal({ id: locale, locale, answer: response.answer });
    const evidence = languageAndTopicEvidence(locale, response.answer);
    results.push({
      locale,
      answerCharacters: response.answer.length,
      ...verified,
      ...evidence,
      status: 'PASS',
    });
  }
  return results;
}

async function verifyConversationalBreadth() {
  const cases = [
    {
      id: 'greeting',
      locale: 'ru',
      question: 'Привет',
      history: [],
      minimumAnswerCharacters: 5,
      expectedTerms: [],
    },
    {
      id: 'rare_crop_term',
      locale: 'ru',
      question: 'Как интерпретировать коэффициент кущения и продуктивную кустистость?',
      history: [],
      minimumAnswerCharacters: 60,
      expectedTerms: ['кущ', 'побег', 'растен'],
    },
    {
      id: 'livestock_microclimate',
      locale: 'ru',
      question: 'Как интерпретировать THI 78 для высокопродуктивной группы животных?',
      history: [],
      minimumAnswerCharacters: 60,
      expectedTerms: ['теплов', 'стресс', 'температур', 'влажност'],
    },
    {
      id: 'machinery_pto',
      locale: 'ru',
      question: 'Что проверить при нестабильной частоте вращения ВОМ под нагрузкой?',
      history: [],
      minimumAnswerCharacters: 60,
      expectedTerms: ['вом', 'нагруз', 'привод', 'обороты'],
    },
    {
      id: 'contextual_follow_up',
      locale: 'ru',
      question: 'А что проверить сначала?',
      history: [
        { role: 'user', text: 'Что проверить при нестабильной частоте вращения ВОМ под нагрузкой?' },
        { role: 'assistant', text: 'Нужно последовательно проверить привод, нагрузку и режим работы.' },
      ],
      minimumAnswerCharacters: 40,
      expectedTerms: ['вом', 'привод', 'нагруз', 'обороты'],
    },
    {
      id: 'safe_general_excel_ru',
      locale: 'ru',
      question: 'Как в Excel посчитать процент одного значения от другого?',
      history: [],
      minimumAnswerCharacters: 30,
      expectedTerms: ['процент', 'формул', 'ячейк', '%'],
    },
    {
      id: 'safe_general_excel_en',
      locale: 'en',
      question: 'How do I calculate one value as a percentage of another in Excel?',
      history: [],
      minimumAnswerCharacters: 30,
      expectedTerms: ['percent', 'formula', 'cell', '%'],
    },
    {
      id: 'safe_general_excel_zh',
      locale: 'zh',
      question: '如何在 Excel 中计算一个数值占另一个数值的百分比？',
      history: [],
      minimumAnswerCharacters: 20,
      expectedTerms: ['百分比', '公式', '单元格', '%'],
    },
    {
      id: 'underspecified_farm_costs',
      locale: 'ru',
      question: 'Как уменьшить расходы?',
      history: [
        { role: 'user', text: 'У нас молочная ферма на 180 коров. Корма, электроэнергия и ремонт дорожают.' },
        { role: 'assistant', text: 'Нужно разобрать структуру себестоимости и производственные показатели.' },
      ],
      minimumAnswerCharacters: 80,
      expectedTerms: ['затрат', 'себесто', 'корм', 'энерг', 'ремонт'],
    },
    {
      id: 'missing_platform_module_explanation',
      locale: 'ru',
      question: 'Функция автоматического расчёта кормового рациона не подключена. Объясни методику расчёта и какие исходные данные нужны, не заявляя о выполнении операции.',
      history: [],
      minimumAnswerCharacters: 100,
      expectedTerms: ['рацион', 'корм', 'сух', 'потребн', 'продуктив'],
    },
  ];
  const results = [];
  for (const testCase of cases) {
    const response = await requestPublicSse(testCase);
    const verified = assertRealGeneralQwen({ ...testCase, ...response });
    assertNoThematicRefusal({ ...testCase, answer: response.answer });
    results.push({
      id: testCase.id,
      locale: testCase.locale,
      question: testCase.question,
      answerCharacters: response.answer.length,
      ...verified,
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
  conversationalBreadth = await verifyConversationalBreadth();

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

  title = ((await dialog.locator('#pc-public-assistant-title').textContent()) || '').trim();
  subtitle = ((await dialog.locator('[data-pc-public-assistant-subtitle="true"]:visible').textContent()) || '').trim();
  if (title !== UI.title) throw new Error(`gekta_title_mismatch:ru:${title}`);
  if (subtitle !== UI.subtitle) throw new Error(`gekta_subtitle_mismatch:ru:${subtitle}`);
  await assertNoRetiredPublicIdentity(page, 'ru');
  if (await dialog.locator('.pc-modal-sheet-fullscreen-button').count()) throw new Error('duplicate_fullscreen_control_present');

  const fullscreen = dialog.locator('button[aria-label="Развернуть на весь экран"]');
  fullscreenDomCount = await fullscreen.count();
  if (fullscreenDomCount !== 1) throw new Error(`native_fullscreen_dom_count_invalid:${fullscreenDomCount}`);
  fullscreenVisible = await fullscreen.isVisible();
  if (fullscreenVisible) throw new Error('mobile_fullscreen_control_visible');

  const composer = dialog.getByRole('textbox', { name: UI.composer });
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

  /*
   * The live browser matrix.
   *
   * Each block below starts from a fresh panel so one case cannot inherit
   * another's conversation state — the isolation is part of what is being
   * proven, and a shared panel would make the multi-turn results meaningless.
   */
  const openPanel = lang => openAssistantPanel(page, lang);

  progressiveRendering = await verifyProgressiveRendering(page, await openPanel('ru'));

  multiTurn = await verifyMultiTurn(page, openPanel);

  explicitCorrection = await verifyExplicitCorrection(await openPanel('ru'));
  topicShift = await verifyTopicShift(await openPanel('ru'));
  newConversation = await verifyNewConversation(page, await openPanel('ru'));
  stopControl = await verifyStop(page, await openPanel('ru'));
  retryControl = await verifyRetry(await openPanel('ru'));
  widthSafety = await verifyWidths(page, openPanel);

  if (pageErrors.length) throw new Error(`page_errors_after_matrix:${pageErrors.join('|')}`);
  fs.writeFileSync(path.join(evidenceDir, 'public-ai-window.json'), JSON.stringify({
    schemaVersion: 'tai.public-ai-ui.acceptance.v5',
    targetSha,
    manifestSha,
    title,
    subtitle,
    answerCharacters,
    viewport: '390x844',
    mobileViewportAuthority: true,
    // Not observed here and deliberately not restated: the public contour
    // publishes no model identity, and the admitted model is enforced by the
    // relay's identity check and by protected activation, upstream of this job.
    identityAuthority: IDENTITY_AUTHORITY,
    publicModelIdentityExposed: false,
    fullscreenDomCount,
    fullscreenVisible,
    multilingualQwen,
    conversationalBreadth,
    progressiveRendering,
    multiTurn,
    explicitCorrection,
    topicShift,
    newConversation,
    stopControl,
    retryControl,
    widthSafety,
    status: 'PASS',
  }, null, 2));
} catch (error) {
  const errorText = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // Printed before anything else so the cause is in the log even when the
  // evidence artifact cannot be retrieved.
  reportObservations();
  await page.screenshot({ path: path.join(evidenceDir, 'public-ai-window-failure-390x844.png'), fullPage: true }).catch(() => undefined);
  fs.writeFileSync(path.join(evidenceDir, 'public-ai-window-failure.json'), JSON.stringify({
    schemaVersion: 'tai.public-ai-ui.acceptance-failure.v4',
    targetSha,
    manifestSha,
    title,
    subtitle,
    answerCharacters,
    viewport: '390x844',
    identityAuthority: IDENTITY_AUTHORITY,
    publicModelIdentityExposed: false,
    fullscreenDomCount,
    fullscreenVisible,
    multilingualQwen,
    conversationalBreadth,
    progressiveRendering,
    multiTurn,
    explicitCorrection,
    topicShift,
    newConversation,
    stopControl,
    retryControl,
    widthSafety,
    pageErrors,
    error: errorText,
    status: 'FAIL',
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
console.log('LIVE_PUBLIC_AI_UI=PASS');
