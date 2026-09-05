#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

export const CODEX_REVIEW_LOGINS = new Set([
  'chatgpt-codex-connector',
  'chatgpt-codex-connector[bot]',
]);

function normalizeLogin(review) {
  return String(review?.user?.login || review?.author?.login || '').trim();
}

export function exactHeadCodexReviews(reviews, headSha) {
  const expected = String(headSha || '').trim();
  return (reviews || []).filter((review) => {
    const login = normalizeLogin(review);
    const commitId = String(review?.commit_id || review?.commitId || '').trim();
    const state = String(review?.state || '').toUpperCase();
    return CODEX_REVIEW_LOGINS.has(login) && commitId === expected && state !== 'DISMISSED';
  });
}

export function activeUnresolvedThreads(threads) {
  return (threads || []).filter((thread) => thread?.isResolved !== true && thread?.isOutdated !== true);
}

export function latestBlockingChangeRequests(reviews) {
  const latestByReviewer = new Map();
  const ordered = [...(reviews || [])].sort((left, right) => {
    const leftTime = Date.parse(left?.submitted_at || left?.submittedAt || 0) || 0;
    const rightTime = Date.parse(right?.submitted_at || right?.submittedAt || 0) || 0;
    return leftTime - rightTime;
  });

  for (const review of ordered) {
    const login = normalizeLogin(review);
    if (!login) continue;
    const state = String(review?.state || '').toUpperCase();
    if (state === 'DISMISSED') {
      latestByReviewer.delete(login);
      continue;
    }
    latestByReviewer.set(login, review);
  }

  return [...latestByReviewer.entries()]
    .filter(([, review]) => String(review?.state || '').toUpperCase() === 'CHANGES_REQUESTED')
    .map(([login, review]) => ({ login, review }));
}

function runGh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function ghJson(args) {
  const raw = runGh(args);
  return raw ? JSON.parse(raw) : null;
}

function fetchAllReviews(repo, prNumber) {
  const pages = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
  ]) || [];
  return pages.flatMap((page) => Array.isArray(page) ? page : []);
}

function fetchAllReviewThreads(repo, prNumber) {
  const [owner, name] = String(repo).split('/');
  if (!owner || !name) throw new Error(`Invalid repository name: ${repo}`);

  const query = `
    query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $endCursor) {
            nodes {
              isResolved
              isOutdated
              path
              line
              comments(first: 10) {
                nodes {
                  author { login }
                  body
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;

  const pages = ghJson([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `number=${prNumber}`,
  ]) || [];

  return pages.flatMap((page) => page?.data?.repository?.pullRequest?.reviewThreads?.nodes || []);
}

function fail(code, message) {
  console.error(`${code}: ${message}`);
  process.exit(1);
}

function main() {
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
  const prNumber = Number(process.env.PR_NUMBER || 0);
  const expectedHead = String(process.env.HEAD_SHA || '').trim();

  if (!repo) fail('REVIEW_GATE_REPO_MISSING', 'REPO/GITHUB_REPOSITORY is required.');
  if (!Number.isInteger(prNumber) || prNumber <= 0) fail('REVIEW_GATE_PR_MISSING', 'PR_NUMBER must be a positive integer.');

  const pr = ghJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  if (!pr) fail('REVIEW_GATE_PR_UNAVAILABLE', `Unable to read PR #${prNumber}.`);

  if (String(pr.state).toLowerCase() !== 'open') {
    console.log(`PR_REVIEW_GATE=SKIP_CLOSED pr=${prNumber}`);
    return;
  }
  if (pr.draft === true) {
    console.log(`PR_REVIEW_GATE=SKIP_DRAFT pr=${prNumber}`);
    return;
  }

  const headSha = String(pr?.head?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(headSha)) fail('REVIEW_GATE_HEAD_INVALID', `Invalid PR head SHA for #${prNumber}.`);
  if (expectedHead && expectedHead !== headSha) {
    fail('REVIEW_GATE_HEAD_MOVED', `Expected ${expectedHead}, current head is ${headSha}.`);
  }

  const reviews = fetchAllReviews(repo, prNumber);
  const exactCodex = exactHeadCodexReviews(reviews, headSha);
  if (exactCodex.length === 0) {
    fail('REVIEW_GATE_CODEX_EXACT_HEAD_MISSING', `No completed Codex review is bound to exact head ${headSha}.`);
  }

  const blockingReviews = latestBlockingChangeRequests(reviews);
  if (blockingReviews.length > 0) {
    fail(
      'REVIEW_GATE_CHANGES_REQUESTED',
      `Active CHANGES_REQUESTED review(s): ${blockingReviews.map(({ login }) => login).join(', ')}.`,
    );
  }

  const threads = fetchAllReviewThreads(repo, prNumber);
  const unresolved = activeUnresolvedThreads(threads);
  if (unresolved.length > 0) {
    const locations = unresolved
      .slice(0, 20)
      .map((thread) => `${thread.path || 'unknown'}:${thread.line || 'n/a'}`)
      .join(', ');
    fail(
      'REVIEW_GATE_UNRESOLVED_THREADS',
      `${unresolved.length} current review thread(s) unresolved: ${locations}`,
    );
  }

  console.log(`PR_REVIEW_GATE=PASS pr=${prNumber} head=${headSha} codexExactHeadReviews=${exactCodex.length} unresolvedCurrentThreads=0`);
}

const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === new URL(`file://${invokedPath}`).href) {
  main();
}
