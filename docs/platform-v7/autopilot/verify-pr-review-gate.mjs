#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CODEX_REVIEW_LOGINS = new Set([
  'chatgpt-codex-connector',
  'chatgpt-codex-connector[bot]',
]);

const COMPLETED_REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
]);

const GREEN_CHECK_STATES = new Set([
  'SUCCESS',
  'SKIPPED',
  'NEUTRAL',
]);

const IGNORED_CHECK_WORKFLOWS = new Set([
  'Repo automations',
  'platform-v7 autopilot generated merge',
  'platform-v7 generated PR cleanup',
]);

const IGNORED_CHECK_NAMES = new Set([
  'Exact-head Codex review gate',
  'automerge',
  'merge-generated',
  'reconcile-generated',
  'deploy/pachaninm-lab/pachanin-demo',
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
    return CODEX_REVIEW_LOGINS.has(login) && commitId === expected && COMPLETED_REVIEW_STATES.has(state);
  });
}

export function cleanCodexReviewPrefixes(comments) {
  const prefixes = [];
  for (const comment of comments || []) {
    const login = normalizeLogin(comment);
    if (!CODEX_REVIEW_LOGINS.has(login)) continue;
    const body = String(comment?.body || '');
    if (!/Codex Review:\s*Didn't find any major issues\./u.test(body)) continue;
    const match = body.match(/\*\*Reviewed commit:\*\*\s*`([0-9a-f]{10,40})`/u);
    if (match) prefixes.push(match[1]);
  }
  return prefixes;
}

export function activeUnresolvedThreads(threads) {
  return (threads || []).filter((thread) => thread?.isResolved !== true && thread?.isOutdated !== true);
}

export function latestBlockingChangeRequests(reviews) {
  const blockedByReviewer = new Map();
  const ordered = [...(reviews || [])].sort((left, right) => {
    const leftTime = Date.parse(left?.submitted_at || left?.submittedAt || 0) || 0;
    const rightTime = Date.parse(right?.submitted_at || right?.submittedAt || 0) || 0;
    return leftTime - rightTime;
  });

  for (const review of ordered) {
    const login = normalizeLogin(review);
    if (!login) continue;
    const state = String(review?.state || '').toUpperCase();

    if (state === 'CHANGES_REQUESTED') {
      blockedByReviewer.set(login, review);
      continue;
    }

    if (state === 'APPROVED' || state === 'DISMISSED') {
      blockedByReviewer.delete(login);
    }

    // COMMENTED does not clear an earlier CHANGES_REQUESTED review.
  }

  return [...blockedByReviewer.entries()]
    .map(([login, review]) => ({ login, review }));
}

function checkName(check) {
  return String(check?.context || check?.name || check?.title || '').trim();
}

function checkWorkflow(check) {
  return String(check?.workflowName || check?.workflow || '').trim();
}

export function isIgnoredMergeGateCheck(check) {
  const name = checkName(check);
  const workflow = checkWorkflow(check);
  return IGNORED_CHECK_NAMES.has(name) || IGNORED_CHECK_WORKFLOWS.has(workflow);
}

export function substantiveChecks(checks) {
  return (checks || []).filter((check) => !isIgnoredMergeGateCheck(check));
}

export function checkRollupBlockers(checks) {
  const blockers = [];

  for (const check of substantiveChecks(checks)) {
    const name = checkName(check) || 'unnamed-check';
    const workflow = checkWorkflow(check);
    const status = String(check?.status || '').toUpperCase();
    const terminalState = String(check?.conclusion || check?.state || '').toUpperCase();

    if (status && status !== 'COMPLETED') {
      blockers.push(`${workflow ? `${workflow} / ` : ''}${name}:${status}`);
      continue;
    }

    if (!terminalState || !GREEN_CHECK_STATES.has(terminalState)) {
      blockers.push(`${workflow ? `${workflow} / ` : ''}${name}:${terminalState || 'UNKNOWN'}`);
    }
  }

  return blockers;
}

export function ciSnapshotMatchesHead(snapshotHeadSha, expectedHeadSha) {
  const snapshot = String(snapshotHeadSha || '').trim();
  const expected = String(expectedHeadSha || '').trim();
  return /^[0-9a-f]{40}$/u.test(snapshot) && snapshot === expected;
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

function fetchAllIssueComments(repo, prNumber) {
  const pages = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/issues/${prNumber}/comments?per_page=100`,
  ]) || [];
  return pages.flatMap((page) => Array.isArray(page) ? page : []);
}

function resolveCommitSha(repo, ref) {
  const commit = ghJson(['api', `repos/${repo}/commits/${ref}`]);
  return String(commit?.sha || '').trim();
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

function fetchCheckSnapshot(repo, prNumber) {
  const value = ghJson([
    'pr',
    'view',
    String(prNumber),
    '--repo',
    repo,
    '--json',
    'headRefOid,statusCheckRollup',
  ]);

  return {
    headSha: String(value?.headRefOid || '').trim(),
    checks: Array.isArray(value?.statusCheckRollup) ? value.statusCheckRollup : [],
  };
}

function fetchLivePrHead(repo, prNumber) {
  const pr = ghJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  return String(pr?.head?.sha || '').trim();
}

function fail(code, message) {
  console.error(`${code}: ${message}`);
  process.exit(1);
}

function main() {
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
  const prNumber = Number(process.env.PR_NUMBER || 0);
  const expectedHead = String(process.env.HEAD_SHA || '').trim();
  const requireGreenCi = process.env.REQUIRE_GREEN_CI === '1';

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
  const comments = fetchAllIssueComments(repo, prNumber);
  const cleanPrefixes = cleanCodexReviewPrefixes(comments);
  let exactCleanCodex = 0;
  for (const prefix of cleanPrefixes) {
    try {
      if (resolveCommitSha(repo, prefix) === headSha) exactCleanCodex += 1;
    } catch {
      // Ignore a stale or no-longer-resolvable short review prefix.
    }
  }

  if (exactCodex.length === 0 && exactCleanCodex === 0) {
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

  let checkedCi = 0;
  if (requireGreenCi) {
    const snapshot = fetchCheckSnapshot(repo, prNumber);
    if (!ciSnapshotMatchesHead(snapshot.headSha, headSha)) {
      fail(
        'REVIEW_GATE_CI_HEAD_MISMATCH',
        `CI snapshot head ${snapshot.headSha || 'missing'} does not match verified head ${headSha}.`,
      );
    }

    const observed = substantiveChecks(snapshot.checks);
    checkedCi = observed.length;
    if (observed.length === 0) {
      fail('REVIEW_GATE_CI_EVIDENCE_MISSING', `No substantive CI/status evidence exists for exact head ${headSha}.`);
    }

    const ciBlockers = checkRollupBlockers(snapshot.checks);
    if (ciBlockers.length > 0) {
      fail(
        'REVIEW_GATE_CI_NOT_GREEN',
        `${ciBlockers.length} exact-head check(s) are pending or non-green: ${ciBlockers.slice(0, 30).join(', ')}`,
      );
    }
  }

  const finalHead = fetchLivePrHead(repo, prNumber);
  if (finalHead !== headSha) {
    fail(
      'REVIEW_GATE_HEAD_MOVED_DURING_VERIFICATION',
      `Verified head ${headSha}, current head is now ${finalHead || 'missing'}.`,
    );
  }

  console.log(`PR_REVIEW_GATE=PASS pr=${prNumber} head=${headSha} codexExactHeadReviews=${exactCodex.length} codexExactHeadCleanComments=${exactCleanCodex} unresolvedCurrentThreads=0 ciChecks=${checkedCi}`);
}

const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  main();
}
