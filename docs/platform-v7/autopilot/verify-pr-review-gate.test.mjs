import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  activeUnresolvedThreads,
  checkRollupBlockers,
  ciSnapshotMatchesHead,
  cleanCodexReviewPrefixes,
  exactHeadCodexReviews,
  isIgnoredMergeGateCheck,
  latestBlockingChangeRequests,
  reviewGatePrState,
  substantiveChecks,
} from './verify-pr-review-gate.mjs';

const head = 'a'.repeat(40);
const oldHead = 'b'.repeat(40);

test('accepts only a completed Codex review on the exact head', () => {
  const reviews = [
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      commit_id: oldHead,
      state: 'COMMENTED',
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      commit_id: head,
      state: 'DISMISSED',
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      commit_id: head,
      state: 'PENDING',
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      commit_id: head,
      state: 'COMMENTED',
    },
  ];

  assert.equal(exactHeadCodexReviews(reviews, head).length, 1);
});

test('recognizes clean Codex review evidence only from the Codex bot and a reviewed commit prefix', () => {
  const comments = [
    {
      user: { login: 'someone-else' },
      body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `1234567890`",
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: 'Codex Review summary without clean-review sentence. **Reviewed commit:** `abcdef1234`',
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: "Codex Review: Didn't find any major issues. Keep it up!\n\n**Reviewed commit:** `deadbeef42`",
    },
  ];

  assert.deepEqual(cleanCodexReviewPrefixes(comments), ['deadbeef42']);
});

test('rejects short or malformed clean-review commit prefixes', () => {
  const comments = [
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `abc1234`",
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `not-a-sha!`",
    },
  ];

  assert.deepEqual(cleanCodexReviewPrefixes(comments), []);
});

test('rejects a review from another actor even when commit matches', () => {
  const reviews = [
    {
      user: { login: 'someone-else' },
      commit_id: head,
      state: 'APPROVED',
    },
  ];

  assert.equal(exactHeadCodexReviews(reviews, head).length, 0);
});

test('blocks only unresolved non-outdated review threads', () => {
  const threads = [
    { isResolved: false, isOutdated: false, path: 'a.ts', line: 1 },
    { isResolved: true, isOutdated: false, path: 'b.ts', line: 2 },
    { isResolved: false, isOutdated: true, path: 'c.ts', line: 3 },
  ];

  assert.deepEqual(activeUnresolvedThreads(threads), [threads[0]]);
});

test('approval clears an earlier CHANGES_REQUESTED from the same reviewer', () => {
  const reviews = [
    {
      user: { login: 'reviewer-a' },
      state: 'CHANGES_REQUESTED',
      submitted_at: '2026-09-05T01:00:00Z',
    },
    {
      user: { login: 'reviewer-a' },
      state: 'APPROVED',
      submitted_at: '2026-09-05T02:00:00Z',
    },
    {
      user: { login: 'reviewer-b' },
      state: 'CHANGES_REQUESTED',
      submitted_at: '2026-09-05T03:00:00Z',
    },
  ];

  assert.deepEqual(
    latestBlockingChangeRequests(reviews).map(({ login }) => login),
    ['reviewer-b'],
  );
});

test('a later COMMENTED review does not clear CHANGES_REQUESTED', () => {
  const reviews = [
    {
      user: { login: 'reviewer-a' },
      state: 'CHANGES_REQUESTED',
      submitted_at: '2026-09-05T01:00:00Z',
    },
    {
      user: { login: 'reviewer-a' },
      state: 'COMMENTED',
      submitted_at: '2026-09-05T02:00:00Z',
    },
  ];

  assert.deepEqual(
    latestBlockingChangeRequests(reviews).map(({ login }) => login),
    ['reviewer-a'],
  );
});

test('dismissal clears a previous change request', () => {
  const reviews = [
    {
      user: { login: 'reviewer-a' },
      state: 'CHANGES_REQUESTED',
      submitted_at: '2026-09-05T01:00:00Z',
    },
    {
      user: { login: 'reviewer-a' },
      state: 'DISMISSED',
      submitted_at: '2026-09-05T02:00:00Z',
    },
  ];

  assert.equal(latestBlockingChangeRequests(reviews).length, 0);
});

test('ignores only review-gate automation checks to avoid self-deadlock', () => {
  const checks = [
    { workflowName: 'Repo automations', name: 'Exact-head Codex review gate', status: 'IN_PROGRESS' },
    { context: 'review-gate/exact-head', state: 'SUCCESS' },
    { workflowName: 'CI', name: 'web-unit', status: 'COMPLETED', conclusion: 'SUCCESS' },
  ];

  assert.equal(isIgnoredMergeGateCheck(checks[0]), true);
  assert.equal(isIgnoredMergeGateCheck(checks[1]), true);
  assert.equal(isIgnoredMergeGateCheck(checks[2]), false);
  assert.deepEqual(substantiveChecks(checks), [checks[2]]);
});

test('green, skipped and neutral exact-head checks are accepted', () => {
  const checks = [
    { workflowName: 'CI', name: 'unit', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { workflowName: 'CI', name: 'optional', status: 'COMPLETED', conclusion: 'SKIPPED' },
    { workflowName: 'Security', name: 'advisory', status: 'COMPLETED', conclusion: 'NEUTRAL' },
  ];

  assert.deepEqual(checkRollupBlockers(checks), []);
});

test('pending and red exact-head checks both block automated merge', () => {
  const checks = [
    { workflowName: 'CI', name: 'pending', status: 'IN_PROGRESS', conclusion: null },
    { workflowName: 'Security', name: 'failed', status: 'COMPLETED', conclusion: 'FAILURE' },
  ];

  assert.deepEqual(checkRollupBlockers(checks), [
    'CI / pending:IN_PROGRESS',
    'Security / failed:FAILURE',
  ]);
});

test('legacy status contexts are evaluated by state', () => {
  const checks = [
    { context: 'legacy-green', state: 'SUCCESS' },
    { context: 'legacy-pending', state: 'PENDING' },
  ];

  assert.deepEqual(checkRollupBlockers(checks), ['legacy-pending:PENDING']);
});

test('CI snapshot must be bound to the exact verified head', () => {
  assert.equal(ciSnapshotMatchesHead(head, head), true);
  assert.equal(ciSnapshotMatchesHead(oldHead, head), false);
  assert.equal(ciSnapshotMatchesHead('not-a-sha', head), false);
  assert.equal(ciSnapshotMatchesHead('', head), false);
});

test('draft PR state is never reviewable authority', () => {
  assert.equal(reviewGatePrState({ state: 'open', draft: false }), 'REVIEWABLE');
  assert.equal(reviewGatePrState({ state: 'open', draft: true }), 'DRAFT');
  assert.equal(reviewGatePrState({ state: 'closed', draft: false }), 'CLOSED');
});

test('review reconciliation workflow uses supported dispatch wiring and complete pagination', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/automerge.yml', import.meta.url),
    'utf8',
  );

  // YAML parseability itself is enforced by Workflow Syntax Guard; this test binds
  // the semantic reconciliation contract so an unsupported trigger or broken payload
  // cannot silently replace the supported repository_dispatch path again.
  assert.doesNotMatch(workflow, /^\s*pull_request_review_thread:/mu);
  assert.match(
    workflow,
    /^\s*types:\s*\[[^\]]*ready_for_review[^\]]*converted_to_draft[^\]]*\]\s*$/mu,
  );
  assert.match(workflow, /^\s*repository_dispatch:\s*$/mu);
  assert.match(workflow, /^\s*types:\s*\[review-gate-reconcile\]\s*$/mu);
  assert.match(
    workflow,
    /group:\s*repo-automerge-\$\{\{[^\n]*github\.event\.client_payload\.pr_number[^\n]*\}\}/u,
  );
  assert.match(workflow, /^\s*cancel-in-progress:\s*false\s*$/mu);
  assert.doesNotMatch(workflow, /^\s*cancel-in-progress:\s*true\s*$/mu);
  assert.match(workflow, /^\s*queue:\s*max\s*$/mu);
  const finalLiveStateChecks = workflow.match(/--json headRefOid,isDraft,state/gu) || [];
  assert.ok(finalLiveStateChecks.length >= 3);
  const draftInvalidations = workflow.match(/\[ "\$current_state" != OPEN \] \|\| \[ "\$current_draft" = true \]/gu) || [];
  assert.ok(draftInvalidations.length >= 3);
  assert.match(workflow, /^\s*exact-head-dispatched-gate:\s*$/mu);
  assert.match(
    workflow,
    /github\.event_name == 'repository_dispatch' && github\.event\.action == 'review-gate-reconcile'/u,
  );
  assert.match(workflow, /PR_NUMBER:\s*\$\{\{ github\.event\.client_payload\.pr_number \}\}/u);
  assert.match(workflow, /EXPECTED_HEAD:\s*\$\{\{ github\.event\.client_payload\.head_sha \}\}/u);
  assert.match(workflow, /gh api --paginate --slurp/u);
  assert.match(workflow, /repos\/\$REPO\/pulls\?state=open&per_page=100/u);
  assert.match(workflow, /repos\/\$REPO\/dispatches/u);
  assert.match(workflow, /event_type=review-gate-reconcile/u);
  assert.match(workflow, /client_payload\[pr_number\]=\$pr_number/u);
  assert.match(workflow, /client_payload\[head_sha\]=\$head_sha/u);
});
