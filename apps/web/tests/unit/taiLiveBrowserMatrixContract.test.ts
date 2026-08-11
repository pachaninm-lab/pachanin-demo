import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The hosted browser matrix, pinned where it is declared.
 *
 * The script cannot run here — it drives production in Chromium — so what this
 * suite guards is that the checks still exist and still assert the ordering
 * that makes them meaningful. That matters because the weaker version is the
 * tempting one: waiting for the final answered state is simpler, never flakes,
 * and passes identically for a route that buffered the whole answer and
 * revealed it at the end. Progressive rendering is only proven by the ordering.
 */

const root = path.resolve(process.cwd(), '../..');
const acceptance = fs.readFileSync(path.join(root, 'scripts/tai-live-public-ai-acceptance.mjs'), 'utf8');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml'),
  'utf8',
);

describe('progressive rendering is proven by ordering, not by completion', () => {
  it('requires visible substantive text while the message is still streaming', () => {
    expect(acceptance).toContain('data-stream-status="streaming"');
    expect(acceptance).toContain('async function verifyProgressiveRendering(');
    expect(acceptance).toContain('const firstVisibleContentAt = Date.now() - startedAt;');
    expect(acceptance).toContain('const doneVisibleAt = Date.now() - startedAt;');
    expect(acceptance).toContain('if (!(firstVisibleContentAt < doneVisibleAt))');
  });

  it('refuses partial text that is really a finished answer', () => {
    // Without this, a buffered route could satisfy the ordering by completing
    // between the two observations.
    expect(acceptance).toContain('ui_progressive_answer_already_complete');
    expect(acceptance).toContain('ui_progressive_no_growth');
  });

  it('is actually invoked, not merely defined', () => {
    expect(acceptance).toMatch(/progressiveRendering = await verifyProgressiveRendering\(/u);
    expect(acceptance).toContain('progressiveRendering,');
  });
});

describe('conversation state is exercised across languages and turns', () => {
  it('covers RU, EN and ZH with a subject-free follow-up', () => {
    expect(acceptance).toContain('async function verifyMultiTurn(');
    for (const fragment of ["id: 'ru'", "id: 'en'", "id: 'zh'"]) expect(acceptance).toContain(fragment);
    expect(acceptance).toContain('А что проверить в первую очередь?');
    expect(acceptance).toContain('And what should I check first?');
    expect(acceptance).toContain('那应该先检查什么？');
    expect(acceptance).toContain('ui_follow_up_too_short');
  });

  it('requires the newest fact to win an explicit correction', () => {
    expect(acceptance).toContain('async function verifyExplicitCorrection(');
    expect(acceptance).toContain("id: 'correction'");
    expect(acceptance).toContain('requireSubjectDominance');
  });

  it('requires a topic shift to drop the previous subject', () => {
    expect(acceptance).toContain('async function verifyTopicShift(');
    expect(acceptance).toContain("id: 'topic-shift'");
    expect(acceptance).toContain("superseded: ['удой', 'дойн', 'коров']");
  });

  it('imports the subject rules rather than restating them', () => {
    expect(acceptance).toContain("from './tai-conversation-subject-contract.mjs'");
    expect(workflow).toContain('cp "$GITHUB_WORKSPACE/scripts/tai-conversation-subject-contract.mjs"');
    expect(workflow).toContain('node --check scripts/tai-conversation-subject-contract.mjs');
  });

  it('proves New Conversation resets history on the wire, not just on screen', () => {
    expect(acceptance).toContain('async function verifyNewConversation(');
    // A cleared transcript with a populated history would still leak the old
    // subject into the model, so the request body is what is inspected.
    expect(acceptance).toContain('page.waitForRequest(');
    expect(acceptance).toContain('ui_new_conversation_history_inherited');
    expect(acceptance).toContain('ui_new_conversation_subject_inherited');
    expect(acceptance).toContain('ui_new_conversation_not_empty');
    // The confirmation only appears past a single turn, so the setup must be
    // long enough to meet the dialog a reader actually sees.
    expect(acceptance).toContain("await askInPanel(dialog, 'А если полив нормальный?')");
    expect(acceptance).toContain("page.once('dialog'");
    expect(acceptance).toContain('confirmationAccepted: confirmed');
  });

  it('drives each localized panel with its own control labels', () => {
    // The panel is fully localized, so a Russian aria-label finds nothing on
    // the EN or ZH panel — and the multi-turn cases open exactly those.
    expect(acceptance).toContain('const UI_COPY = {');
    expect(acceptance).toContain("composer: 'Ask Gekta about land, crops or agribusiness'");
    expect(acceptance).toContain("composer: '向 Gekta 咨询土地、作物或农业经营'");
    expect(acceptance).toContain('function uiFor(lang)');
    expect(acceptance).toContain('ui_copy_missing');
    expect(acceptance).toContain('askInPanel(dlg, testCase.first, { lang: testCase.lang })');
    expect(acceptance).toContain('askInPanel(dlg, testCase.followUp, { lang: testCase.lang })');
  });

  it('keeps the component copy and the matrix labels in agreement', () => {
    // A copy change that leaves this script behind would fail only in
    // production, at the end of a release.
    const component = fs.readFileSync(
      path.join(root, 'apps/web/components/platform-v7/PublicPlatformAssistant.tsx'),
      'utf8',
    );
    for (const label of [
      'Спроси Гекту о земле, урожае или агробизнесе',
      'Ask Gekta about land, crops or agribusiness',
      '向 Gekta 咨询土地、作物或农业经营',
      'Остановить ответ',
      'Stop answer',
      '停止回答',
      'Новый диалог',
      'New chat',
      '新对话',
      'Повторить запрос',
      'Retry request',
      '重试问题',
    ]) {
      expect(component).toContain(label);
      expect(acceptance).toContain(label);
    }
  });

  it('runs each case on a freshly opened panel', () => {
    // Session storage restores the transcript, so a reused page would let one
    // case answer another case's follow-up.
    expect(acceptance).toContain('async function openAssistantPanel(page, lang)');
    expect(acceptance).toContain('window.sessionStorage.clear()');
  });
});

describe('the controls behave', () => {
  it('requires Stop to end streaming, keep partial text and recover', () => {
    expect(acceptance).toContain('async function verifyStop(');
    expect(acceptance).toContain('ui_stop_spinner_stuck');
    expect(acceptance).toContain('ui_stop_discarded_partial_answer');
    expect(acceptance).toContain('ui_stop_recovery_failed');
    // A deliberate halt must not surface to the reader as an error banner.
    expect(acceptance).toContain('ui_stop_reported_as_error');
    expect(acceptance).toContain('const stopLatencyMs = Date.now() - stoppedAt;');
  });

  it('requires Retry to regenerate without duplicating the user turn', () => {
    expect(acceptance).toContain('async function verifyRetry(');
    expect(acceptance).toContain('ui_retry_duplicated_user_turn');
    expect(acceptance).toContain('ui_retry_duplicated_answer');
    expect(acceptance).toContain('ui_retry_question_repeated');
  });

  it('checks the three widths readers actually use', () => {
    expect(acceptance).toContain('async function verifyWidths(');
    expect(acceptance).toContain('for (const width of [320, 390, 430])');
    expect(acceptance).toContain('ui_width_overflow');
    expect(acceptance).toContain('ui_width_document_overflow');
    expect(acceptance).toContain('ui_width_control_offscreen');
    expect(acceptance).toContain('ui_width_control_too_small');
    expect(acceptance).toContain('ui_width_duplicate_fullscreen_control');
  });

  it('fails on any page error raised during the matrix', () => {
    expect(acceptance).toContain('page_errors_after_matrix');
  });

  /**
   * A live assertion that fires must be readable.
   *
   * The first production run failed on the correction case and the answer
   * existed only inside a Playwright variable — the evidence artifact is not
   * reachable from every environment that has to diagnose it, so there was no
   * way to tell an ignored correction from a missed synonym.
   */
  it('writes every observed answer to the job log when the matrix fails', () => {
    expect(acceptance).toContain('const observations = [];');
    expect(acceptance).toContain('function observe(id, question, answer)');
    expect(acceptance).toContain('function reportObservations()');
    expect(acceptance).toContain('MATRIX OBSERVATIONS');
    // Every panel question flows through askInPanel, so recording it there
    // covers multi-turn, correction, topic shift, New Conversation and retry.
    expect(acceptance).toContain('return observe(`ask[${lang}]`, question, answer);');
    // And it must run before the failure evidence is written.
    const catchBlock = acceptance.slice(acceptance.indexOf('} catch (error) {'));
    expect(catchBlock.indexOf('reportObservations();'))
      .toBeLessThan(catchBlock.indexOf('public-ai-window-failure.json'));
  });

  it('judges how a turn settled instead of timing out on one outcome', () => {
    // A refusal settles as `refused` and a knowledge-base fallback renders with
    // no stream status at all. Waiting only for `answered` cannot observe
    // either, so a failed turn is indistinguishable from a slow one until the
    // wait expires — four minutes to learn nothing.
    expect(acceptance).toContain('ui_answer_never_settled');
    expect(acceptance).toContain('ui_turn_not_answered');
    expect(acceptance).toContain('async function panelState(dialog)');
    expect(acceptance).toContain("if (status !== 'answered')");
    // Turn position identifies a turn; its outcome does not.
    expect(acceptance).toContain('async function assistantCount(dialog)');
    expect(acceptance).toContain('const before = await assistantCount(dialog);');
  });

  it('recognises both everyday Russian names for the corrected crop', () => {
    // A term list naming only `картофель` misses `картошка`. Widening the
    // current subject cannot mask a regression: dominance still requires the
    // corrected subject to outweigh the superseded one.
    expect(acceptance).toContain("current: ['картоф', 'картош', 'клубн'],");
    expect(acceptance).toContain("superseded: ['пшениц'],");
  });
});

describe('the matrix reaches production through the governed chain', () => {
  it('bounds the hosted run instead of inheriting the six-hour default', () => {
    const job = workflow.slice(workflow.indexOf('\n  acceptance:'), workflow.indexOf('\n  finalize:'));

    expect(job).toMatch(/timeout-minutes:\s*\d+/u);
  });

  it('runs inside the existing activation workflow, not a parallel one', () => {
    expect(workflow).toContain('cp "$GITHUB_WORKSPACE/scripts/tai-live-public-ai-acceptance.mjs" "$work/acceptance.mjs"');
    expect(workflow).toContain('LIVE_BASE="$LIVE_BASE" node "$work/acceptance.mjs"');
    expect(workflow).toContain('needs: [image_authority, activate]');
    expect(workflow).toContain("if: needs.activate.result == 'success'");
  });

  it('records every matrix result in the uploaded evidence', () => {
    for (const field of [
      'progressiveRendering,',
      'multiTurn,',
      'explicitCorrection,',
      'topicShift,',
      'newConversation,',
      'stopControl,',
      'retryControl,',
      'widthSafety,',
    ]) {
      // Present in both the success record and the failure record, so a failed
      // run still shows how far the matrix got.
      expect(acceptance.split(field).length - 1).toBeGreaterThanOrEqual(2);
    }
  });
});
