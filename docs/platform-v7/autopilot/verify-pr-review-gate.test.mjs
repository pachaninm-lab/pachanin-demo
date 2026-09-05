import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeUnresolvedThreads,
  exactHeadCodexReviews,
  latestBlockingChangeRequests,
} from './verify-pr-review-gate.mjs';

const head = 'a'.repeat(40);
const oldHead = 'b'.repeat(40);

test('accepts only a non-dismissed Codex review on the exact head', () => {
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

test('latest review from a reviewer controls CHANGES_REQUESTED state', () => {
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

test('dismissed latest review clears a previous change request', () => {
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
