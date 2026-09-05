import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeUnresolvedThreads,
  checkRollupBlockers,
  exactHeadCodexReviews,
  isIgnoredMergeGateCheck,
  latestBlockingChangeRequests,
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
    { workflowName: 'CI', name: 'web-unit', status: 'COMPLETED', conclusion: 'SUCCESS' },
  ];

  assert.equal(isIgnoredMergeGateCheck(checks[0]), true);
  assert.equal(isIgnoredMergeGateCheck(checks[1]), false);
  assert.deepEqual(substantiveChecks(checks), [checks[1]]);
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
