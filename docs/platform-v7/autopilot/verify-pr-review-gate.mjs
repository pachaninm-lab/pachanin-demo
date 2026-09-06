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

const POSITIVE_REVIEW_STATES = new Set([
  'APPROVED',
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
  'review-gate/exact-head',
  'automerge',
  'merge-generated',
  'reconcile-generated',
  'deploy/pachaninm-lab/pachanin-demo',
]);

const MACHINE_REVIEW_WORKFLOWS = new Set([
  'CodeQL platform-v7 report',
  'Qodana platform-v7 report',
  'Security Quality Gate',
  'Security Abuse and Evidence Acceptance',
  'Runtime Context Security Gate',
  'Dependency Review',
  'Canonical SBOM Generation & IP Clean Room',
]);

export const MIN_MACHINE_REVIEW_AUTHORITIES = 3;

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

export function positiveExactHeadCodexReviews(reviews, headSha) {
  return exactHeadCodexReviews(reviews, headSha).filter((review) => (
    POSITIVE_REVIEW_STATES.has(String(review?.state || '').toUpperCase())
  ));
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

export function exactHeadOwnerSelfAudits(comments, ownerLogin, headSha) {
  const owner = String(ownerLogin || '').trim();
  const expected = String(headSha || '').trim();
  if (!owner || !/^[0-9a-f]{40}$/u.test(expected)) return [];

  return (comments || []).filter((comment) => {
    if (normalizeLogin(comment) !== owner) return false;
    const body = String(comment?.body || '');
    const matches = [...body.matchAll(/OWNER SELF-AUDIT:\s*PASS exact head\s*`([0-9a-f]{40})`/gu)];
    return matches.some((match) => match[1] === expected);
  });
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

function checkTerminalState(check) {
  return String(check?.conclusion || check?.state || '').toUpperCase();
}

export function isIgnoredMergeGateCheck(check) {
  const name = checkName(check);
  const workflow = checkWorkflow(check);
  return IGNORED_CHECK_NAMES.has(name) || IGNORED_CHECK_WORKFLOWS.has(workflow);
}

export function substantiveChecks(checks) {
  return (checks || []).filter((check) => !isIgnoredMergeGateCheck(check));
}

export function machineReviewAuthorities(checks) {
  const authorities = new Set();
  for (const check of substantiveChecks(checks)) {
    const workflow = checkWorkflow(check);
    if (!MACHINE_REVIEW_WORKFLOWS.has(workflow)) continue;
    const status = String(check?.status || '').toUpperCase();
    const terminalState = checkTerminalState(check);
    if (status && status !== 'COMPLETED') continue;
    if (!GREEN_CHECK_STATES.has(terminalState)) continue;
    authorities.add(workflow);
  }
  return [...authorities].sort();
}

export function checkRollupBlockers(checks) {
  const blockers = [];

  for (const check of substantiveChecks(checks)) {
    const name = checkName(check) || 'unnamed-check';
    const workflow = checkWorkflow(check);
    const status = String(check?.status || '').toUpperCase();
    const terminalState = checkTerminalState(check);

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

export function reviewGatePrState(pr) {
  const state = String(pr?.state || '').toLowerCase();
  if (state === 'closed') return 'CLOSED';
  if (state !== 'open' || typeof pr?.draft !== 'boolean') return 'INVALID';
  return pr.draft ? 'DRAFT' : 'REVIEWABLE';
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
  const prefix = String(ref || '').trim();
  if (!/^[0-9a-f]{10,40}$/u.test(prefix)) return '';
  const commit = ghJson(['api', `repos/${repo}/commits/${prefix}`]);
  const sha = String(commit?.sha || '').trim();
  return /^[0-9a-f]{40}$/u.test(sha) && sha.startsWith(prefix) ? sha : '';
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

  const [ownerLogin] = String(repo).split('/');
  if (!ownerLogin) fail('REVIEW_GATE_OWNER_MISSING', `Unable to resolve repository owner from ${repo}.`);

  const pr = ghJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  if (!pr) fail('REVIEW_GATE_PR_UNAVAILABLE', `Unable to read PR #${prNumber}.`);

  const prState = reviewGatePrState(pr);
  if (prState === 'INVALID') {
    fail('REVIEW_GATE_PR_STATE_INVALID', `PR #${prNumber} has an incomplete or unsupported live state.`);
  }
  if (prState === 'CLOSED') {
    console.log(`PR_REVIEW_GATE=SKIP_CLOSED pr=${prNumber}`);
    return;
  }
  if (prState === 'DRAFT') {
    fail('REVIEW_GATE_DRAFT', `Draft PR #${prNumber} cannot satisfy exact-head review authority.`);
  }

  const headSha = String(pr?.head?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(headSha)) fail('REVIEW_GATE_HEAD_INVALID', `Invalid PR head SHA for #${prNumber}.`);
  if (expectedHead && expectedHead !== headSha) {
    fail('REVIEW_GATE_HEAD_MOVED', `Expected ${expectedHead}, current head is ${headSha}.`);
  }

  const reviews = fetchAllReviews(repo, prNumber);
  const comments = fetchAllIssueComments(repo, prNumber);
  const positiveCodexReviews = positiveExactHeadCodexReviews(reviews, headSha);
  const cleanPrefixes = cleanCodexReviewPrefixes(comments);
  let exactCleanCodexComments = 0;
  for (const prefix of cleanPrefixes) {
    try {
      if (resolveCommitSha(repo, prefix) === headSha) exactCleanCodexComments += 1;
    } catch {
      // Ignore stale or no-longer-resolvable reviewed-commit prefixes.
    }
  }
  const codexAuthority = positiveCodexReviews.length > 0 || exactCleanCodexComments > 0;

  const ownerSelfAudits = exactHeadOwnerSelfAudits(comments, ownerLogin, headSha);
  if (ownerSelfAudits.length === 0) {
    fail(
      'REVIEW_GATE_OWNER_SELF_AUDIT_MISSING',
      `No repository-owner self-audit PASS attestation is bound to exact head ${headSha}.`,
    );
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

  if (!codexAuthority && !requireGreenCi) {
    fail(
      'REVIEW_GATE_MACHINE_FALLBACK_REQUIRES_GREEN_CI',
      'Codex authority is absent, so provider-independent machine review fallback requires REQUIRE_GREEN_CI=1.',
    );
  }

  let checkedCi = 0;
  let machineAuthorities = [];
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

    machineAuthorities = machineReviewAuthorities(snapshot.checks);
  }

  if (!codexAuthority && machineAuthorities.length < MIN_MACHINE_REVIEW_AUTHORITIES) {
    fail(
      'REVIEW_GATE_INDEPENDENT_MACHINE_REVIEW_INSUFFICIENT',
      `Codex authority is unavailable and only ${machineAuthorities.length}/${MIN_MACHINE_REVIEW_AUTHORITIES} independent machine-review authorities are green: ${machineAuthorities.join(', ') || 'none'}.`,
    );
  }

  const finalHead = fetchLivePrHead(repo, prNumber);
  if (finalHead !== headSha) {
    fail(
      'REVIEW_GATE_HEAD_MOVED_DURING_VERIFICATION',
      `Verified head ${headSha}, current head is now ${finalHead || 'missing'}.`,
    );
  }

  const reviewAuthority = codexAuthority ? 'CODEX' : 'MACHINE_FALLBACK';
  console.log(`PR_REVIEW_GATE=PASS pr=${prNumber} head=${headSha} reviewAuthority=${reviewAuthority} codexApprovals=${positiveCodexReviews.length} codexExactHeadCleanComments=${exactCleanCodexComments} machineReviewAuthorities=${machineAuthorities.length} ownerSelfAuditAttestations=${ownerSelfAudits.length} unresolvedCurrentThreads=0 ciChecks=${checkedCi}`);
}

const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  main();
}
