#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CODEX_REVIEW_LOGINS = new Set([
  'chatgpt-codex-connector',
  'chatgpt-codex-connector[bot]',
]);

export const COPILOT_REVIEW_LOGINS = new Set([
  'copilot-pull-request-reviewer[bot]',
]);

export const OCTOPUS_ACTION_SHA = 'c7156c0dc465c20e8b06da84b92b64f9ae8c7c36';
export const OCTOPUS_REVIEW_LOGIN = 'github-actions[bot]';
export const OCTOPUS_STATUS_CONTEXT = 'review-provider/octopus';
export const OCTOPUS_WORKFLOW_PATH = '.github/workflows/octopus-independent-review.yml';

export const LOCAL_QWEN_REVIEW_LOGIN = 'github-actions[bot]';
export const LOCAL_QWEN_STATUS_CONTEXT = 'review-provider/local-qwen';
export const LOCAL_QWEN_WORKFLOW_PATH = '.github/workflows/local-qwen-independent-review.yml';
export const LOCAL_QWEN_WORKFLOW_NAME = 'Local Qwen Independent Review';
export const LOCAL_QWEN_MODEL_REVISION = 'aebf6a0f72261b12fb8199bc580fe172fe86c901';
export const LOCAL_QWEN_MODEL_SHA256 = '724fb256bec1ff062b2f65e4569e871ad2e95ab2a3989723d1769c54294730b7';
export const LOCAL_QWEN_RUNTIME_BUILD = 'b10809';
export const LOCAL_QWEN_RUNTIME_SOURCE_COMMIT = '5266f24da75dc449bd56cbed7addb9c8e4a6a73e';
export const LOCAL_QWEN_RUNTIME_ARCHIVE_SHA256 = '5e34434ddc6d03cd1584f403201aff0d4bd1a5793a72ff7e286532dfd1e4b941';
export const LOCAL_QWEN_POLICY_SHA256 = '5e849bdc71ab93e5431904d8a31fc01262145517ea2d070ebd590b0da240d010';

const COMPLETED_REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
]);

const POSITIVE_CODEX_REVIEW_STATES = new Set(['APPROVED']);
const POSITIVE_COPILOT_REVIEW_STATES = new Set(['APPROVED', 'COMMENTED']);
const POSITIVE_PROVIDER_REVIEW_STATES = new Set(['APPROVED', 'COMMENTED']);
const GREEN_CHECK_STATES = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);

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

function normalizeLogin(review) {
  return String(review?.user?.login || review?.author?.login || '').trim();
}

function exactHeadReviewsByLogins(reviews, headSha, allowedLogins) {
  const expected = String(headSha || '').trim();
  return (reviews || []).filter((review) => {
    const login = normalizeLogin(review);
    const commitId = String(review?.commit_id || review?.commitId || '').trim();
    const state = String(review?.state || '').toUpperCase();
    return allowedLogins.has(login) && commitId === expected && COMPLETED_REVIEW_STATES.has(state);
  });
}

export function exactHeadCodexReviews(reviews, headSha) {
  return exactHeadReviewsByLogins(reviews, headSha, CODEX_REVIEW_LOGINS);
}

export function positiveExactHeadCodexReviews(reviews, headSha) {
  return exactHeadCodexReviews(reviews, headSha).filter((review) => (
    POSITIVE_CODEX_REVIEW_STATES.has(String(review?.state || '').toUpperCase())
  ));
}

export function exactHeadCopilotReviews(reviews, headSha) {
  return exactHeadReviewsByLogins(reviews, headSha, COPILOT_REVIEW_LOGINS);
}

export function positiveExactHeadCopilotReviews(reviews, headSha) {
  return exactHeadCopilotReviews(reviews, headSha).filter((review) => (
    POSITIVE_COPILOT_REVIEW_STATES.has(String(review?.state || '').toUpperCase())
  ));
}

function parseOctopusAttestation(review, headSha) {
  const expected = String(headSha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(expected)) return null;
  if (normalizeLogin(review) !== OCTOPUS_REVIEW_LOGIN) return null;
  const commitId = String(review?.commit_id || review?.commitId || '').trim();
  if (commitId !== expected) return null;
  const state = String(review?.state || '').toUpperCase();
  if (!POSITIVE_PROVIDER_REVIEW_STATES.has(state)) return null;

  const body = String(review?.body || '').trim();
  const match = body.match(/^OCTOPUS INDEPENDENT REVIEW: PASS\nExact head: `([0-9a-f]{40})`\nProvider workflow: `([^`]+)`\nProvider action: `([0-9a-f]{40})`\nFindings: `0`\nSummary SHA-256: `([0-9a-f]{64})`\nWorkflow run: `([1-9][0-9]*)`$/u);
  if (!match || match[1] !== expected || match[2] !== OCTOPUS_WORKFLOW_PATH || match[3] !== OCTOPUS_ACTION_SHA) return null;

  return { review, summarySha256: match[4], runId: match[5] };
}

export function positiveExactHeadOctopusAttestations(reviews, statuses, headSha, repo) {
  const repository = String(repo || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) return [];
  const latestProviderStatus = (statuses || []).find((status) => String(status?.context || '').trim() === OCTOPUS_STATUS_CONTEXT);
  if (!latestProviderStatus) return [];
  if (String(latestProviderStatus?.state || '').toLowerCase() !== 'success') return [];
  if (String(latestProviderStatus?.creator?.login || '').trim() !== OCTOPUS_REVIEW_LOGIN) return [];

  return (reviews || [])
    .map((review) => parseOctopusAttestation(review, headSha))
    .filter(Boolean)
    .filter((candidate) => {
      const expectedDescription = `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${candidate.summarySha256.slice(0, 16)}`;
      const expectedTarget = `https://github.com/${repository}/actions/runs/${candidate.runId}`;
      return String(latestProviderStatus?.description || '').trim() === expectedDescription
        && String(latestProviderStatus?.target_url || latestProviderStatus?.targetUrl || '').trim() === expectedTarget;
    });
}

function parseLocalQwenAttestation(review, headSha) {
  const expected = String(headSha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(expected)) return null;
  if (normalizeLogin(review) !== LOCAL_QWEN_REVIEW_LOGIN) return null;
  const commitId = String(review?.commit_id || review?.commitId || '').trim();
  if (commitId !== expected) return null;
  const state = String(review?.state || '').toUpperCase();
  if (!POSITIVE_PROVIDER_REVIEW_STATES.has(state)) return null;

  const body = String(review?.body || '').trim();
  const match = body.match(/^LOCAL QWEN INDEPENDENT REVIEW: PASS\nExact head: `([0-9a-f]{40})`\nProvider workflow: `([^`]+)`\nModel revision: `([0-9a-f]{40})`\nModel SHA-256: `([0-9a-f]{64})`\nRuntime build: `(b[0-9]+)`\nRuntime source commit: `([0-9a-f]{40})`\nRuntime archive SHA-256: `([0-9a-f]{64})`\nPolicy SHA-256: `([0-9a-f]{64})`\nDiff SHA-256: `([0-9a-f]{64})`\nResponse SHA-256: `([0-9a-f]{64})`\nWorkflow run: `([1-9][0-9]*)`\nVerdict: `PASS`\nFindings: `0`$/u);
  if (!match) return null;
  if (match[1] !== expected) return null;
  if (match[2] !== LOCAL_QWEN_WORKFLOW_PATH) return null;
  if (match[3] !== LOCAL_QWEN_MODEL_REVISION) return null;
  if (match[4] !== LOCAL_QWEN_MODEL_SHA256) return null;
  if (match[5] !== LOCAL_QWEN_RUNTIME_BUILD) return null;
  if (match[6] !== LOCAL_QWEN_RUNTIME_SOURCE_COMMIT) return null;
  if (match[7] !== LOCAL_QWEN_RUNTIME_ARCHIVE_SHA256) return null;
  if (match[8] !== LOCAL_QWEN_POLICY_SHA256) return null;

  return {
    review,
    diffSha256: match[9],
    responseSha256: match[10],
    runId: match[11],
  };
}

/**
 * Binds an Octopus attestation to the pinned provider workflow's own run.
 *
 * Without this the Octopus path is satisfied by a review body and a commit status
 * alone, and both are written by github-actions[bot] — the shared identity of every
 * workflow in this repository holding pull-requests:write and statuses:write. The
 * run id is read out of the review body, so it is caller-supplied and every field
 * is checked against the live run rather than trusted. A run that merely exists is
 * not enough either: the provider workflow publishes a run with the same path,
 * event, head and pull request when its clean-review validation FAILS (exit 20 on
 * findings, 21 on an empty summary, 22 while indexing). Only a completed successful
 * run is evidence, and unlike a commit status — last-writer-wins — a finished run's
 * conclusion cannot be rewritten afterwards.
 */
export function octopusRunMatches(run, candidate, headSha, repo, prNumber) {
  const expectedHead = String(headSha || '').trim();
  const repository = String(repo || '').trim();
  const expectedPr = Number(prNumber || 0);
  if (!run || !candidate || !/^[0-9a-f]{40}$/u.test(expectedHead) || !repository) return false;
  if (!Number.isInteger(expectedPr) || expectedPr <= 0) return false;
  if (String(run?.id || '') !== String(candidate.runId || '')) return false;
  if (String(run?.path || '') !== OCTOPUS_WORKFLOW_PATH) return false;
  if (String(run?.event || '') !== 'pull_request_target') return false;
  if (String(run?.status || '') !== 'completed' || String(run?.conclusion || '') !== 'success') return false;
  if (String(run?.head_sha || '') !== expectedHead) return false;
  if (String(run?.repository?.full_name || '') !== repository) return false;
  if (!Array.isArray(run?.pull_requests) || !run.pull_requests.some((pr) => Number(pr?.number) === expectedPr)) return false;
  return true;
}

export function positiveExactHeadLocalQwenPairs(reviews, statuses, headSha, repo) {
  const repository = String(repo || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) return [];
  const latestProviderStatus = (statuses || []).find((status) => String(status?.context || '').trim() === LOCAL_QWEN_STATUS_CONTEXT);
  if (!latestProviderStatus) return [];
  if (String(latestProviderStatus?.state || '').toLowerCase() !== 'success') return [];
  if (String(latestProviderStatus?.creator?.login || '').trim() !== LOCAL_QWEN_REVIEW_LOGIN) return [];

  return (reviews || [])
    .map((review) => parseLocalQwenAttestation(review, headSha))
    .filter(Boolean)
    .filter((candidate) => {
      const expectedDescription = `Qwen clean model=${LOCAL_QWEN_MODEL_SHA256.slice(0, 8)} response=${candidate.responseSha256.slice(0, 16)}`;
      const expectedTarget = `https://github.com/${repository}/actions/runs/${candidate.runId}`;
      return String(latestProviderStatus?.description || '').trim() === expectedDescription
        && String(latestProviderStatus?.target_url || latestProviderStatus?.targetUrl || '').trim() === expectedTarget;
    })
    .map((candidate) => ({ ...candidate, status: latestProviderStatus }));
}

function timestampWithinRun(timestamp, run) {
  const value = Date.parse(String(timestamp || ''));
  const started = Date.parse(String(run?.run_started_at || run?.created_at || ''));
  const ended = Date.parse(String(run?.updated_at || ''));
  if (!Number.isFinite(value) || !Number.isFinite(started) || !Number.isFinite(ended)) return false;
  return value >= started - 5000 && value <= ended + 60000;
}

export function localQwenRunMatches(run, candidate, headSha, repo, prNumber) {
  const expectedHead = String(headSha || '').trim();
  const repository = String(repo || '').trim();
  const expectedPr = Number(prNumber || 0);
  if (!run || !candidate || !/^[0-9a-f]{40}$/u.test(expectedHead) || !repository || !Number.isInteger(expectedPr) || expectedPr <= 0) return false;
  if (String(run?.id || '') !== String(candidate.runId || '')) return false;
  if (String(run?.name || '') !== LOCAL_QWEN_WORKFLOW_NAME) return false;
  if (String(run?.path || '') !== LOCAL_QWEN_WORKFLOW_PATH) return false;
  if (String(run?.event || '') !== 'pull_request_target') return false;
  if (String(run?.status || '') !== 'completed' || String(run?.conclusion || '') !== 'success') return false;
  if (String(run?.head_sha || '') !== expectedHead) return false;
  if (String(run?.head_commit?.id || '') !== expectedHead) return false;
  if (String(run?.repository?.full_name || '') !== repository) return false;
  if (String(run?.head_repository?.full_name || '') !== repository) return false;
  if (!Array.isArray(run?.pull_requests) || !run.pull_requests.some((pr) => Number(pr?.number) === expectedPr)) return false;
  if (!timestampWithinRun(candidate?.review?.submitted_at || candidate?.review?.submittedAt, run)) return false;
  if (!timestampWithinRun(candidate?.status?.created_at || candidate?.status?.updated_at, run)) return false;
  return true;
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
    if (state === 'APPROVED' || state === 'DISMISSED') blockedByReviewer.delete(login);
  }
  return [...blockedByReviewer.entries()].map(([login, review]) => ({ login, review }));
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
  const pages = ghJson(['api', '--paginate', '--slurp', `repos/${repo}/pulls/${prNumber}/reviews?per_page=100`]) || [];
  return pages.flatMap((page) => Array.isArray(page) ? page : []);
}

function fetchAllIssueComments(repo, prNumber) {
  const pages = ghJson(['api', '--paginate', '--slurp', `repos/${repo}/issues/${prNumber}/comments?per_page=100`]) || [];
  return pages.flatMap((page) => Array.isArray(page) ? page : []);
}

function fetchAllCommitStatuses(repo, headSha) {
  const pages = ghJson(['api', '--paginate', '--slurp', `repos/${repo}/commits/${headSha}/statuses?per_page=100`]) || [];
  return pages.flatMap((page) => Array.isArray(page) ? page : []);
}

function fetchWorkflowRun(repo, runId) {
  return ghJson(['api', `repos/${repo}/actions/runs/${runId}`]);
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
              comments(first: 10) { nodes { author { login } body } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  `;
  const pages = ghJson([
    'api', 'graphql', '--paginate', '--slurp',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `number=${prNumber}`,
  ]) || [];
  return pages.flatMap((page) => page?.data?.repository?.pullRequest?.reviewThreads?.nodes || []);
}

function fetchCheckSnapshot(repo, prNumber) {
  const value = ghJson(['pr', 'view', String(prNumber), '--repo', repo, '--json', 'headRefOid,statusCheckRollup']);
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
  if (prState === 'INVALID') fail('REVIEW_GATE_PR_STATE_INVALID', `PR #${prNumber} has an incomplete or unsupported live state.`);
  if (prState === 'CLOSED') {
    console.log(`PR_REVIEW_GATE=SKIP_CLOSED pr=${prNumber}`);
    return;
  }
  if (prState === 'DRAFT') fail('REVIEW_GATE_DRAFT', `Draft PR #${prNumber} cannot satisfy exact-head review authority.`);

  const headSha = String(pr?.head?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(headSha)) fail('REVIEW_GATE_HEAD_INVALID', `Invalid PR head SHA for #${prNumber}.`);
  if (expectedHead && expectedHead !== headSha) fail('REVIEW_GATE_HEAD_MOVED', `Expected ${expectedHead}, current head is ${headSha}.`);

  const reviews = fetchAllReviews(repo, prNumber);
  const comments = fetchAllIssueComments(repo, prNumber);
  const commitStatuses = fetchAllCommitStatuses(repo, headSha);

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

  const positiveCopilotReviews = positiveExactHeadCopilotReviews(reviews, headSha);
  const copilotAuthority = positiveCopilotReviews.length > 0;

  const octopusPairs = positiveExactHeadOctopusAttestations(reviews, commitStatuses, headSha, repo);
  const positiveOctopusAttestations = [];
  for (const candidate of octopusPairs) {
    try {
      const run = fetchWorkflowRun(repo, candidate.runId);
      if (octopusRunMatches(run, candidate, headSha, repo, prNumber)) positiveOctopusAttestations.push(candidate);
    } catch {
      // Missing/inaccessible workflow-run evidence cannot satisfy review authority.
    }
  }
  const octopusAuthority = positiveOctopusAttestations.length > 0;

  const localQwenPairs = positiveExactHeadLocalQwenPairs(reviews, commitStatuses, headSha, repo);
  const positiveLocalQwenAttestations = [];
  for (const candidate of localQwenPairs) {
    try {
      const run = fetchWorkflowRun(repo, candidate.runId);
      if (localQwenRunMatches(run, candidate, headSha, repo, prNumber)) positiveLocalQwenAttestations.push(candidate);
    } catch {
      // Missing/inaccessible workflow-run evidence cannot satisfy review authority.
    }
  }
  const localQwenAuthority = positiveLocalQwenAttestations.length > 0;

  if (!codexAuthority && !copilotAuthority && !octopusAuthority && !localQwenAuthority) {
    fail(
      'REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING',
      `No genuine independent review authority is bound to exact head ${headSha}; accepted providers are Codex, GitHub Copilot, Octopus paired evidence, or pinned local-Qwen paired review/status/run evidence.`,
    );
  }

  const ownerSelfAudits = exactHeadOwnerSelfAudits(comments, ownerLogin, headSha);
  if (ownerSelfAudits.length === 0) {
    fail('REVIEW_GATE_OWNER_SELF_AUDIT_MISSING', `No repository-owner self-audit PASS attestation is bound to exact head ${headSha}.`);
  }

  const blockingReviews = latestBlockingChangeRequests(reviews);
  if (blockingReviews.length > 0) {
    fail('REVIEW_GATE_CHANGES_REQUESTED', `Active CHANGES_REQUESTED review(s): ${blockingReviews.map(({ login }) => login).join(', ')}.`);
  }

  const threads = fetchAllReviewThreads(repo, prNumber);
  const unresolved = activeUnresolvedThreads(threads);
  if (unresolved.length > 0) {
    const locations = unresolved.slice(0, 20).map((thread) => `${thread.path || 'unknown'}:${thread.line || 'n/a'}`).join(', ');
    fail('REVIEW_GATE_UNRESOLVED_THREADS', `${unresolved.length} current review thread(s) unresolved: ${locations}`);
  }

  let checkedCi = 0;
  if (requireGreenCi) {
    const snapshot = fetchCheckSnapshot(repo, prNumber);
    if (!ciSnapshotMatchesHead(snapshot.headSha, headSha)) {
      fail('REVIEW_GATE_CI_HEAD_MISMATCH', `CI snapshot head ${snapshot.headSha || 'missing'} does not match verified head ${headSha}.`);
    }
    const observed = substantiveChecks(snapshot.checks);
    checkedCi = observed.length;
    if (observed.length === 0) fail('REVIEW_GATE_CI_EVIDENCE_MISSING', `No substantive CI/status evidence exists for exact head ${headSha}.`);
    const ciBlockers = checkRollupBlockers(snapshot.checks);
    if (ciBlockers.length > 0) {
      fail('REVIEW_GATE_CI_NOT_GREEN', `${ciBlockers.length} exact-head check(s) are pending or non-green: ${ciBlockers.slice(0, 30).join(', ')}`);
    }
  }

  const finalHead = fetchLivePrHead(repo, prNumber);
  if (finalHead !== headSha) {
    fail('REVIEW_GATE_HEAD_MOVED_DURING_VERIFICATION', `Verified head ${headSha}, current head is now ${finalHead || 'missing'}.`);
  }

  const reviewAuthority = codexAuthority
    ? 'CODEX'
    : copilotAuthority
      ? 'GITHUB_COPILOT'
      : localQwenAuthority
        ? 'LOCAL_QWEN_CODER'
        : 'OCTOPUS';
  console.log(`PR_REVIEW_GATE=PASS pr=${prNumber} head=${headSha} reviewAuthority=${reviewAuthority} codexApprovals=${positiveCodexReviews.length} codexExactHeadCleanComments=${exactCleanCodexComments} copilotExactHeadReviews=${positiveCopilotReviews.length} octopusExactHeadAttestations=${positiveOctopusAttestations.length} localQwenExactHeadAttestations=${positiveLocalQwenAttestations.length} ownerSelfAuditAttestations=${ownerSelfAudits.length} unresolvedCurrentThreads=0 ciChecks=${checkedCi}`);
}

const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  main();
}
