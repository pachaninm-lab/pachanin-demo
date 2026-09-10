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
export const LOCAL_QWEN_WORKFLOW_NAME = 'Local Qwen Independent Review';
export const LOCAL_QWEN_WORKFLOW_PATH = '.github/workflows/local-qwen-independent-review.yml';
export const LOCAL_QWEN_MODEL_REVISION = 'aebf6a0f72261b12fb8199bc580fe172fe86c901';
export const LOCAL_QWEN_MODEL_SHA256 = '724fb256bec1ff062b2f65e4569e871ad2e95ab2a3989723d1769c54294730b7';
export const LOCAL_QWEN_LLAMA_BUILD = 'b10809';
export const LOCAL_QWEN_LLAMA_SOURCE_COMMIT = '5266f24da75dc449bd56cbed7addb9c8e4a6a73e';
export const LOCAL_QWEN_LLAMA_ARCHIVE_SHA256 = '5e34434ddc6d03cd1584f403201aff0d4bd1a5793a72ff7e286532dfd1e4b941';
export const LOCAL_QWEN_POLICY_SHA256 = '5e849bdc71ab93e5431904d8a31fc01262145517ea2d070ebd590b0da240d010';
export const LOCAL_QWEN_MAX_DIFF_BYTES = 400000;
export const LOCAL_QWEN_MAX_CHUNK_DIFF_BYTES = 72000;
export const LOCAL_QWEN_MAX_CHUNKS = 96;


const COMPLETED_REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
]);

const POSITIVE_CODEX_REVIEW_STATES = new Set([
  'APPROVED',
]);

const POSITIVE_COPILOT_REVIEW_STATES = new Set([
  'APPROVED',
  'COMMENTED',
]);

const POSITIVE_OCTOPUS_REVIEW_STATES = new Set([
  'APPROVED',
  'COMMENTED',
]);

const POSITIVE_LOCAL_QWEN_REVIEW_STATES = new Set([
  'APPROVED',
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
  'review-gate/exact-head',
  'automerge',
  'merge-generated',
  'reconcile-generated',
  'deploy/pachaninm-lab/pachanin-demo',
]);

function normalizeLogin(review) {
  return String(review?.user?.login || review?.author?.login || '').trim();
}

export function isGitHubRepositorySlug(repo) {
  const repository = String(repo || '').trim();
  const match = repository.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/u);
  if (!match) return false;
  return match[1] !== '.' && match[1] !== '..' && match[2] !== '.' && match[2] !== '..';
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
  if (!POSITIVE_OCTOPUS_REVIEW_STATES.has(state)) return null;

  const body = String(review?.body || '').trim();
  const match = body.match(/^OCTOPUS INDEPENDENT REVIEW: PASS\nExact head: `([0-9a-f]{40})`\nProvider workflow: `([^`]+)`\nProvider action: `([0-9a-f]{40})`\nFindings: `0`\nSummary SHA-256: `([0-9a-f]{64})`\nWorkflow run: `([1-9][0-9]{0,19})`$/u);
  if (!match) return null;
  if (match[1] !== expected) return null;
  if (match[2] !== OCTOPUS_WORKFLOW_PATH) return null;
  if (match[3] !== OCTOPUS_ACTION_SHA) return null;

  return {
    review,
    summarySha256: match[4],
    runId: match[5],
  };
}


function parseLocalQwenAttestation(review, headSha) {
  const expected = String(headSha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(expected)) return null;
  if (normalizeLogin(review) !== LOCAL_QWEN_REVIEW_LOGIN) return null;
  const commitId = String(review?.commit_id || review?.commitId || '').trim();
  if (commitId !== expected) return null;
  const state = String(review?.state || '').toUpperCase();
  if (!POSITIVE_LOCAL_QWEN_REVIEW_STATES.has(state)) return null;

  const lines = String(review?.body || '').trim().split('\n');
  if (lines.length !== 18 || lines[0] !== 'LOCAL QWEN INDEPENDENT REVIEW: PASS') return null;
  const capture = (index, pattern) => lines[index].match(pattern)?.[1] || '';
  const attestedHead = capture(1, /^Exact head: \x60([0-9a-f]{40})\x60$/u);
  const workflowPath = capture(2, /^Provider workflow: \x60([^\x60]+)\x60$/u);
  const modelRevision = capture(3, /^Model revision: \x60([0-9a-f]{40})\x60$/u);
  const modelSha256 = capture(4, /^Model SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const llamaBuild = capture(5, /^Runtime build: \x60([^\x60]+)\x60$/u);
  const llamaSourceCommit = capture(6, /^Runtime source commit: \x60([0-9a-f]{40})\x60$/u);
  const llamaArchiveSha256 = capture(7, /^Runtime archive SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const policySha256 = capture(8, /^Policy SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const diffSha256 = capture(9, /^Full diff SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const diffBytesText = capture(10, /^Diff bytes: \x60([1-9][0-9]{0,8})\x60$/u);
  const chunkCountText = capture(11, /^Chunk count: \x60([1-9][0-9]{0,2})\x60$/u);
  const manifestSha256 = capture(12, /^Review manifest SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const promptBundleSha256 = capture(13, /^Prompt bundle SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const responseSha256 = capture(14, /^Response SHA-256: \x60([0-9a-f]{64})\x60$/u);
  const runId = capture(15, /^Workflow run: \x60([1-9][0-9]{0,19})\x60$/u);
  if (
    !attestedHead
    || !workflowPath
    || !modelRevision
    || !modelSha256
    || !llamaBuild
    || !llamaSourceCommit
    || !llamaArchiveSha256
    || !policySha256
    || !diffSha256
    || !diffBytesText
    || !chunkCountText
    || !manifestSha256
    || !promptBundleSha256
    || !responseSha256
    || !runId
  ) return null;
  if (
    attestedHead !== expected
    || workflowPath !== LOCAL_QWEN_WORKFLOW_PATH
    || modelRevision !== LOCAL_QWEN_MODEL_REVISION
    || modelSha256 !== LOCAL_QWEN_MODEL_SHA256
    || llamaBuild !== LOCAL_QWEN_LLAMA_BUILD
    || llamaSourceCommit !== LOCAL_QWEN_LLAMA_SOURCE_COMMIT
    || llamaArchiveSha256 !== LOCAL_QWEN_LLAMA_ARCHIVE_SHA256
    || policySha256 !== LOCAL_QWEN_POLICY_SHA256
    || lines[16] !== 'Verdict: \x60PASS\x60'
    || lines[17] !== 'Findings: \x600\x60'
  ) return null;
  const diffBytes = Number(diffBytesText);
  const chunkCount = Number(chunkCountText);
  if (
    !Number.isSafeInteger(diffBytes)
    || diffBytes < 1
    || diffBytes > LOCAL_QWEN_MAX_DIFF_BYTES
    || !Number.isSafeInteger(chunkCount)
    || chunkCount < 1
    || chunkCount > LOCAL_QWEN_MAX_CHUNKS
  ) return null;

  return {
    review,
    runId,
    diffSha256,
    diffBytes,
    chunkCount,
    manifestSha256,
    promptBundleSha256,
    responseSha256,
  };
}

export function positiveExactHeadLocalQwenAttestations(reviews, statuses, headSha, repo) {
  const repository = String(repo || '').trim();
  if (!isGitHubRepositorySlug(repository)) return [];
  const latestProviderStatus = (statuses || []).find((status) => (
    String(status?.context || '').trim() === LOCAL_QWEN_STATUS_CONTEXT
  ));
  if (!latestProviderStatus) return [];
  if (String(latestProviderStatus?.state || '').toLowerCase() !== 'success') return [];
  if (String(latestProviderStatus?.creator?.login || '').trim() !== LOCAL_QWEN_REVIEW_LOGIN) return [];

  const candidates = (reviews || [])
    .map((review) => parseLocalQwenAttestation(review, headSha))
    .filter(Boolean);
  return candidates.filter((candidate) => {
    const expectedDescription = [
      'Qwen clean model=',
      LOCAL_QWEN_MODEL_SHA256.slice(0, 8),
      ' response=',
      candidate.responseSha256.slice(0, 16),
      ' chunks=',
      String(candidate.chunkCount),
      ' manifest=',
      candidate.manifestSha256.slice(0, 16),
    ].join('');
    const expectedTarget = 'https://github.com/'
      + repository
      + '/actions/runs/'
      + candidate.runId;
    return String(latestProviderStatus?.description || '').trim() === expectedDescription
      && String(latestProviderStatus?.target_url || latestProviderStatus?.targetUrl || '').trim() === expectedTarget;
  });
}

export function localQwenAttestationMatchesWorkflowRun(attestation, run, repo, prNumber, headSha) {
  const repository = String(repo || '').trim();
  const expectedHead = String(headSha || '').trim();
  const expectedPr = Number(prNumber || 0);
  if (!attestation || !run) return false;
  if (!isGitHubRepositorySlug(repository)) return false;
  if (!/^[0-9a-f]{40}$/u.test(expectedHead)) return false;
  if (!Number.isInteger(expectedPr) || expectedPr <= 0) return false;
  const attestedRunId = String(attestation?.runId || '').trim();
  if (!/^[1-9][0-9]{0,19}$/u.test(attestedRunId)) return false;
  if (String(run?.id ?? '').trim() !== attestedRunId) return false;
  if (String(run?.name || '').trim() !== LOCAL_QWEN_WORKFLOW_NAME) return false;
  if (String(run?.path || '').trim() !== LOCAL_QWEN_WORKFLOW_PATH) return false;
  if (String(run?.event || '').trim() !== 'pull_request_target') return false;
  if (String(run?.status || '').trim() !== 'completed') return false;
  if (String(run?.conclusion || '').trim() !== 'success') return false;
  if (String(run?.repository?.full_name || '').trim() !== repository) return false;
  if (String(run?.head_sha || '').trim() !== expectedHead) return false;

  const runPrs = Array.isArray(run?.pull_requests) ? run.pull_requests : [];
  return runPrs.some((runPr) => (
    Number(runPr?.number) === expectedPr
    && String(runPr?.head?.sha || '').trim() === expectedHead
    && Number(runPr?.head?.repo?.id || 0) === Number(run?.repository?.id || 0)
  ));
}

export function positiveExactHeadOctopusAttestations(reviews, statuses, headSha, repo) {
  const repository = String(repo || '').trim();
  if (!isGitHubRepositorySlug(repository)) return [];

  // GitHub's commit-status endpoint is reverse chronological. Authority is
  // deliberately bound to the newest provider status: a later failure/pending
  // state invalidates an older clean review instead of being shadowed by it.
  const latestProviderStatus = (statuses || []).find((status) => (
    String(status?.context || '').trim() === OCTOPUS_STATUS_CONTEXT
  ));
  if (!latestProviderStatus) return [];
  if (String(latestProviderStatus?.state || '').toLowerCase() !== 'success') return [];
  if (String(latestProviderStatus?.creator?.login || '').trim() !== OCTOPUS_REVIEW_LOGIN) return [];

  const candidates = (reviews || [])
    .map((review) => parseOctopusAttestation(review, headSha))
    .filter(Boolean);

  return candidates.filter((candidate) => {
    const expectedDescription = `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${candidate.summarySha256.slice(0, 16)}`;
    const expectedTarget = `https://github.com/${repository}/actions/runs/${candidate.runId}`;
    return String(latestProviderStatus?.description || '').trim() === expectedDescription
      && String(latestProviderStatus?.target_url || latestProviderStatus?.targetUrl || '').trim() === expectedTarget;
  });
}

export function octopusAttestationMatchesWorkflowRun(attestation, run, repo, prNumber, headSha) {
  const repository = String(repo || '').trim();
  const expectedHead = String(headSha || '').trim();
  const expectedPr = Number(prNumber || 0);
  if (!attestation || !run) return false;
  if (!isGitHubRepositorySlug(repository)) return false;
  if (!/^[0-9a-f]{40}$/u.test(expectedHead)) return false;
  if (!Number.isInteger(expectedPr) || expectedPr <= 0) return false;
  const attestedRunId = String(attestation?.runId || '').trim();
  if (!/^[1-9][0-9]{0,19}$/u.test(attestedRunId)) return false;
  if (String(run?.id ?? '').trim() !== attestedRunId) return false;
  if (String(run?.name || '').trim() !== 'Independent Octopus Review') return false;
  if (String(run?.path || '').trim() !== OCTOPUS_WORKFLOW_PATH) return false;
  if (String(run?.event || '').trim() !== 'pull_request_target') return false;
  if (String(run?.status || '').trim() !== 'completed') return false;
  if (String(run?.conclusion || '').trim() !== 'success') return false;
  if (String(run?.repository?.full_name || '').trim() !== repository) return false;
  if (String(run?.head_sha || '').trim() !== expectedHead) return false;

  const runPrs = Array.isArray(run?.pull_requests) ? run.pull_requests : [];
  return runPrs.some((runPr) => (
    Number(runPr?.number) === expectedPr
    && String(runPr?.head?.sha || '').trim() === expectedHead
    && Number(runPr?.head?.repo?.id || 0) === Number(run?.repository?.id || 0)
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

export function octopusActionsRunUrl(repo, runId) {
  const repository = String(repo || '').trim();
  const id = String(runId || '').trim();
  if (!isGitHubRepositorySlug(repository)) return '';
  if (!/^[1-9][0-9]{0,19}$/u.test(id)) return '';
  return `https://api.github.com/repos/${repository}/actions/runs/${id}`;
}

function fetchPublicActionsRun(repo, runId) {
  const url = octopusActionsRunUrl(repo, runId);
  if (!url) throw new Error('Invalid Octopus Actions run identity.');

  // Merge-controller GITHUB_TOKEN permissions deliberately remain minimal and
  // do not need `actions: read`. This repository is public, so resolve only the
  // fixed GitHub Actions run endpoint anonymously. Strip GitHub credentials and
  // ignore user curl configuration; any network/rate-limit/JSON failure is
  // caught by the caller and therefore fails closed rather than granting review.
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  delete env.GITHUB_AUTH_TOKEN;
  const raw = execFileSync('curl', [
    '--disable',
    '--fail',
    '--silent',
    '--show-error',
    '--proto', '=https',
    '--connect-timeout', '10',
    '--max-time', '20',
    '--retry', '2',
    '--retry-delay', '1',
    '--retry-max-time', '25',
    '--retry-all-errors',
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'X-GitHub-Api-Version: 2022-11-28',
    '-H', 'User-Agent: platform-v7-exact-head-review-gate',
    url,
  ], {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  return raw ? JSON.parse(raw) : null;
}

function fetchPublicOctopusActionsRun(repo, runId) {
  return fetchPublicActionsRun(repo, runId);
}

function fetchPublicLocalQwenActionsRun(repo, runId) {
  return fetchPublicActionsRun(repo, runId);
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

function fetchAllCommitStatuses(repo, headSha) {
  const pages = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/commits/${headSha}/statuses?per_page=100`,
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

  const positiveOctopusAttestations = positiveExactHeadOctopusAttestations(
    reviews,
    commitStatuses,
    headSha,
    repo,
  );
  const workflowBoundOctopusAttestations = positiveOctopusAttestations.filter((attestation) => {
    try {
      const run = fetchPublicOctopusActionsRun(repo, attestation.runId);
      return octopusAttestationMatchesWorkflowRun(attestation, run, repo, prNumber, headSha);
    } catch {
      // Provider evidence is fail-closed when its immutable Actions run cannot
      // be resolved or does not match the exact trusted workflow identity.
      return false;
    }
  });

  const octopusAuthority = workflowBoundOctopusAttestations.length > 0;

  const positiveLocalQwenAttestations = positiveExactHeadLocalQwenAttestations(
    reviews,
    commitStatuses,
    headSha,
    repo,
  );
  const workflowBoundLocalQwenAttestations = positiveLocalQwenAttestations.filter((attestation) => {
    try {
      const run = fetchPublicLocalQwenActionsRun(repo, attestation.runId);
      return localQwenAttestationMatchesWorkflowRun(attestation, run, repo, prNumber, headSha);
    } catch {
      // Local-Qwen evidence is fail-closed when its immutable Actions run cannot
      // be resolved or does not match the exact trusted workflow identity.
      return false;
    }
  });
  const localQwenAuthority = workflowBoundLocalQwenAttestations.length > 0;

  if (!codexAuthority && !copilotAuthority && !octopusAuthority && !localQwenAuthority) {
    fail(
      'REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING',
      'No genuine independent review authority is bound to exact head '
        + headSha
        + '; accepted providers are Codex clean/approved review, GitHub Copilot exact-head code review, Octopus exact-head clean attestation plus matching provider status, or Local Qwen exact-head clean attestation plus matching provider status and trusted Actions run.',
    );
  }

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


  const reviewAuthority = codexAuthority
    ? 'CODEX'
    : copilotAuthority
      ? 'GITHUB_COPILOT'
      : octopusAuthority
        ? 'OCTOPUS'
        : 'LOCAL_QWEN';
  console.log(
    'PR_REVIEW_GATE=PASS pr=' + prNumber
      + ' head=' + headSha
      + ' reviewAuthority=' + reviewAuthority
      + ' codexApprovals=' + positiveCodexReviews.length
      + ' codexExactHeadCleanComments=' + exactCleanCodexComments
      + ' copilotExactHeadReviews=' + positiveCopilotReviews.length
      + ' octopusExactHeadAttestations=' + workflowBoundOctopusAttestations.length
      + ' localQwenExactHeadAttestations=' + workflowBoundLocalQwenAttestations.length
      + ' ownerSelfAuditAttestations=' + ownerSelfAudits.length
      + ' unresolvedCurrentThreads=0'
      + ' ciChecks=' + checkedCi,
  );

}

const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  main();
}
