#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
export const LOCAL_QWEN_MODEL_REVISION = '895c8d171bc03c30e113cd7a28c02494b5e068b7';
export const LOCAL_QWEN_MODEL_SHA256 = '107afd988cdbdcced3b8e76ebc3a8e83b5a18a5c796fca20778410cb9c47a814';
export const LOCAL_QWEN_LLAMA_BUILD = 'b9637';
export const LOCAL_QWEN_LLAMA_SOURCE_COMMIT = 'aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3';
export const LOCAL_QWEN_LLAMA_ARCHIVE_SHA256 = '3857876e4a2461f7041166bd74b5d39e3db51b8639353d55f87d6f904b3b75bd';
export const LOCAL_QWEN_POLICY_SHA256 = 'e083823ced2f5b63ecfaca345e59274c5f194e36c0cdd20b2cae9cee3b4f9ed3';
export const LOCAL_QWEN_MAX_DIFF_BYTES = 400000;
export const LOCAL_QWEN_MAX_CHUNK_DIFF_BYTES = 8000;
export const LOCAL_QWEN_MAX_CHUNKS = 96;
export const INDEPENDENT_REVIEW_CLASSIFICATION = 'INDEPENDENT_EXACT_HEAD_REVIEW';
export const PROVIDER_MAINTENANCE_BOOTSTRAP_CLASSIFICATION = 'SCOPED_PROVIDER_MAINTENANCE_BOOTSTRAP_NOT_INDEPENDENT_REVIEW';
export const PROVIDER_MAINTENANCE_BOOTSTRAP_MANIFEST_PATH = 'docs/platform-v7/autopilot/scopes/local-qwen-exact-line-evidence-20260913.json';
export const REVIEW_GATE_RESULT_SCHEMA = 'platform-v7.review-gate-result.v1';

const REVIEW_GATE_RESULT_KEYS = Object.freeze([
  'classification',
  'head',
  'reviewAuthority',
  'schemaVersion',
  'status',
]);
const PROVIDER_MAINTENANCE_VERIFIER_PATH = 'docs/platform-v7/autopilot/verify-pr-review-gate.mjs';
const PROVIDER_MAINTENANCE_VERIFIER_TEST_PATH = 'docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs';
const PROVIDER_MAINTENANCE_ALLOWED_PATHS = [
  LOCAL_QWEN_WORKFLOW_PATH,
  PROVIDER_MAINTENANCE_VERIFIER_PATH,
  PROVIDER_MAINTENANCE_VERIFIER_TEST_PATH,
];
const PROVIDER_MAINTENANCE_AUTHORITY_MAX_BYTES = 65536;
const PROVIDER_MAINTENANCE_BOOTSTRAP_KEYS = [
  'activeChangesRequestedRequired',
  'allOtherRequiredChecksTerminalGreen',
  'allowedImplementationPaths',
  'authorityManifestPath',
  'authorityManifestSelfModificationByImplementationForbidden',
  'authorityMustBeAncestorOfImplementationHead',
  'authoritySource',
  'enabled',
  'generatedIndependentProviderPassForbidden',
  'generatedProviderSuccessStatusForbidden',
  'implementationBranch',
  'implementationMustBeForwardSynchronizedToLiveMain',
  'liveMainMustEqualImplementationBaseBeforeMerge',
  'onAnyMismatch',
  'ownerExactHeadSelfAuditRequired',
  'productPullRequestsEligible',
  'providerStatusContext',
  'providerWorkflowPath',
  'resultClassification',
  'unresolvedReviewThreadsRequired',
  'verifierPath',
  'verifierTestPath',
];
const INDEPENDENT_REVIEW_AUTHORITIES = new Set([
  'CODEX',
  'GITHUB_COPILOT',
  'OCTOPUS',
  'LOCAL_QWEN',
]);

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
  'Exact-head review gate',
  'review-gate/exact-head',
  'automerge',
  'merge-generated',
  'reconcile-generated',
  'deploy/pachaninm-lab/pachanin-demo',
]);

const PROVIDER_REVIEW_WORKFLOWS = new Set([
  'Independent Octopus Review',
  LOCAL_QWEN_WORKFLOW_NAME,
]);

const PROVIDER_REVIEW_CHECK_NAMES = new Set([
  OCTOPUS_STATUS_CONTEXT,
  LOCAL_QWEN_STATUS_CONTEXT,
  'Octopus exact-head independent review',
  'Local Qwen exact-head independent review',
]);

function normalizeLogin(review) {
  return String(review?.user?.login || review?.author?.login || '').trim();
}

export function canonicalSha40(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{40}$/u.test(normalized) ? normalized : '';
}

// Workflow-run payloads are GitHub authority inputs: require canonical lowercase SHA-40 as emitted.
// Never normalize malformed or uppercase run identities into exact-head review authority.
function strictWorkflowRunSha40(value) {
  const raw = String(value || '').trim();
  return /^[0-9a-f]{40}$/u.test(raw) ? raw : '';
}

export function isGitHubRepositorySlug(repo) {
  const repository = String(repo || '').trim();
  const match = repository.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/u);
  if (!match) return false;
  return match[1] !== '.' && match[1] !== '..' && match[2] !== '.' && match[2] !== '..';
}

function exactHeadReviewsByLogins(reviews, headSha, allowedLogins) {
  const expected = canonicalSha40(headSha);
  if (!expected) return [];
  return (reviews || []).filter((review) => {
    const login = normalizeLogin(review);
    const commitId = canonicalSha40(review?.commit_id || review?.commitId);
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
  const expected = canonicalSha40(headSha);
  if (!expected) return null;
  if (normalizeLogin(review) !== OCTOPUS_REVIEW_LOGIN) return null;
  const commitId = canonicalSha40(review?.commit_id || review?.commitId);
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
  const expected = canonicalSha40(headSha);
  if (!expected) return null;
  if (normalizeLogin(review) !== LOCAL_QWEN_REVIEW_LOGIN) return null;
  const commitId = canonicalSha40(review?.commit_id || review?.commitId);
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

function providerStatusCreatedAt(status) {
  const timestamp = Date.parse(String(status?.created_at || status?.createdAt || ''));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

export function latestProviderStatusForContext(statuses, context) {
  const expectedContext = String(context || '').trim();
  if (!expectedContext) return null;
  const candidates = (statuses || []).filter((status) => (
    String(status?.context || '').trim() === expectedContext
  ));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const ranked = candidates.map((status) => {
    const createdAt = providerStatusCreatedAt(status);
    const id = Number(status?.id || 0);
    if (!createdAt || !Number.isSafeInteger(id) || id <= 0) return null;
    return { status, createdAt, id };
  });
  if (ranked.some((entry) => entry === null)) return null;
  ranked.sort((left, right) => right.createdAt - left.createdAt || right.id - left.id);
  if (
    ranked.length > 1
    && ranked[0].createdAt === ranked[1].createdAt
    && ranked[0].id === ranked[1].id
  ) return null;
  return ranked[0].status;
}

export function positiveExactHeadLocalQwenAttestations(reviews, statuses, headSha, repo) {
  const repository = String(repo || '').trim();
  if (!isGitHubRepositorySlug(repository)) return [];
  const latestProviderStatus = latestProviderStatusForContext(statuses, LOCAL_QWEN_STATUS_CONTEXT);
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
  const rawHead = String(headSha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(rawHead)) return false;
  const expectedHead = strictWorkflowRunSha40(rawHead);
  const expectedPr = Number(prNumber || 0);
  if (!attestation || !run) return false;
  if (!isGitHubRepositorySlug(repository)) return false;
  if (!expectedHead) return false;
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
  const runHead = strictWorkflowRunSha40(run?.head_sha);
  if (!runHead || runHead !== expectedHead) return false;

  const runPrs = Array.isArray(run?.pull_requests) ? run.pull_requests : [];
  return runPrs.some((runPr) => {
    const runPrHead = strictWorkflowRunSha40(runPr?.head?.sha);
    return Number(runPr?.number) === expectedPr
      && runPrHead === expectedHead
      && Number(runPr?.head?.repo?.id || 0) === Number(run?.repository?.id || 0);
  });
}

export function positiveExactHeadOctopusAttestations(reviews, statuses, headSha, repo) {
  const repository = String(repo || '').trim();
  if (!isGitHubRepositorySlug(repository)) return [];

  const latestProviderStatus = latestProviderStatusForContext(statuses, OCTOPUS_STATUS_CONTEXT);
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
  const rawHead = String(headSha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(rawHead)) return false;
  const expectedHead = strictWorkflowRunSha40(rawHead);
  const expectedPr = Number(prNumber || 0);
  if (!attestation || !run) return false;
  if (!isGitHubRepositorySlug(repository)) return false;
  if (!expectedHead) return false;
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
  const runHead = strictWorkflowRunSha40(run?.head_sha);
  if (!runHead || runHead !== expectedHead) return false;

  const runPrs = Array.isArray(run?.pull_requests) ? run.pull_requests : [];
  return runPrs.some((runPr) => {
    const runPrHead = strictWorkflowRunSha40(runPr?.head?.sha);
    return Number(runPr?.number) === expectedPr
      && runPrHead === expectedHead
      && Number(runPr?.head?.repo?.id || 0) === Number(run?.repository?.id || 0);
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

export function exactHeadOwnerSelfAudits(comments, ownerLogin, headSha) {
  const owner = String(ownerLogin || '').trim();
  const expected = canonicalSha40(headSha);
  if (!owner || !expected) return [];

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
  }

  return [...blockedByReviewer.entries()]
    .map(([login, review]) => ({ login, review }));
}

export function exactHeadProviderBlockingEvidence(reviews, headSha) {
  const expected = canonicalSha40(headSha);
  if (!expected) return [];
  return (reviews || []).filter((review) => {
    const commitId = canonicalSha40(review?.commit_id || review?.commitId);
    if (commitId !== expected) return false;
    const body = String(review?.body || '').trim();
    return /^LOCAL QWEN INDEPENDENT REVIEW: BLOCK(?:\n|$)/u.test(body)
      || /^OCTOPUS INDEPENDENT REVIEW: BLOCK(?:\n|$)/u.test(body);
  });
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

export function isProviderReviewCheck(check) {
  const name = checkName(check);
  const workflow = checkWorkflow(check);
  return PROVIDER_REVIEW_CHECK_NAMES.has(name) || PROVIDER_REVIEW_WORKFLOWS.has(workflow);
}

export function substantiveChecks(checks) {
  return (checks || []).filter((check) => !isIgnoredMergeGateCheck(check));
}

// Bootstrap CI evidence is intentionally narrower than ordinary merge CI:
// remove self-deadlocking automation checks first, then remove provider-review availability checks only here.
export function providerMaintenanceBootstrapSubstantiveChecks(checks) {
  const observed = substantiveChecks(checks);
  return observed.filter((check) => !isProviderReviewCheck(check));
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

export function providerMaintenanceBootstrapCheckRollupBlockers(checks) {
  const blockers = [];

  for (const check of providerMaintenanceBootstrapSubstantiveChecks(checks)) {
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
  const snapshot = canonicalSha40(snapshotHeadSha);
  const expected = canonicalSha40(expectedHeadSha);
  return Boolean(snapshot && expected && snapshot === expected);
}

export function reviewGatePrState(pr) {
  const state = String(pr?.state || '').toLowerCase();
  if (state === 'closed') return 'CLOSED';
  if (state !== 'open' || typeof pr?.draft !== 'boolean') return 'INVALID';
  return pr.draft ? 'DRAFT' : 'REVIEWABLE';
}

function sameStringSet(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  if (actual.some((value) => typeof value !== 'string' || value !== value.trim() || !value)) return false;
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

export function validateProviderMaintenanceBootstrapAuthority(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null;
  const bootstrap = manifest.providerMaintenanceBootstrap;
  if (!bootstrap || typeof bootstrap !== 'object' || Array.isArray(bootstrap)) return null;
  if (!sameStringSet(Object.keys(bootstrap), PROVIDER_MAINTENANCE_BOOTSTRAP_KEYS)) return null;
  if (manifest.schemaVersion !== 'platform-v7.concurrent-scope.v1') return null;
  if (manifest.status !== 'active') return null;
  if (manifest.branch !== 'fix/local-qwen-evidence-binding-20260913') return null;
  if (bootstrap.enabled !== true) return null;
  if (bootstrap.authorityManifestPath !== PROVIDER_MAINTENANCE_BOOTSTRAP_MANIFEST_PATH) return null;
  if (bootstrap.implementationBranch !== manifest.branch) return null;
  if (bootstrap.providerWorkflowPath !== LOCAL_QWEN_WORKFLOW_PATH) return null;
  if (bootstrap.providerStatusContext !== LOCAL_QWEN_STATUS_CONTEXT) return null;
  if (bootstrap.verifierPath !== PROVIDER_MAINTENANCE_VERIFIER_PATH) return null;
  if (bootstrap.verifierTestPath !== PROVIDER_MAINTENANCE_VERIFIER_TEST_PATH) return null;
  if (!sameStringSet(bootstrap.allowedImplementationPaths, PROVIDER_MAINTENANCE_ALLOWED_PATHS)) return null;
  if (bootstrap.authoritySource !== 'MERGED_LIVE_MAIN_ONLY') return null;
  if (bootstrap.authorityMustBeAncestorOfImplementationHead !== true) return null;
  if (bootstrap.implementationMustBeForwardSynchronizedToLiveMain !== true) return null;
  if (bootstrap.ownerExactHeadSelfAuditRequired !== true) return null;
  if (bootstrap.allOtherRequiredChecksTerminalGreen !== true) return null;
  if (bootstrap.unresolvedReviewThreadsRequired !== 0) return null;
  if (bootstrap.activeChangesRequestedRequired !== 0) return null;
  if (bootstrap.liveMainMustEqualImplementationBaseBeforeMerge !== true) return null;
  if (bootstrap.generatedIndependentProviderPassForbidden !== true) return null;
  if (bootstrap.generatedProviderSuccessStatusForbidden !== true) return null;
  if (bootstrap.productPullRequestsEligible !== false) return null;
  if (bootstrap.authorityManifestSelfModificationByImplementationForbidden !== true) return null;
  if (bootstrap.onAnyMismatch !== 'FAIL_CLOSED') return null;
  if (bootstrap.resultClassification !== PROVIDER_MAINTENANCE_BOOTSTRAP_CLASSIFICATION) return null;

  // The merged manifest is the validation envelope. Runtime bootstrap mutation is intentionally narrower:
  // only the provider workflow may use NONE authority. Verifier/test remain independent-review trust boundaries.
  return Object.freeze({
    implementationBranch: bootstrap.implementationBranch,
    allowedImplementationPaths: Object.freeze([bootstrap.providerWorkflowPath]),
    resultClassification: bootstrap.resultClassification,
  });
}

export function parseProviderMaintenanceBootstrapAuthority(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.includes('\u0000')) return null;
  if (Buffer.byteLength(raw, 'utf8') > PROVIDER_MAINTENANCE_AUTHORITY_MAX_BYTES) return null;
  try {
    return validateProviderMaintenanceBootstrapAuthority(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadProviderMaintenanceBootstrapAuthority() {
  try {
    const raw = readFileSync(resolve(PROVIDER_MAINTENANCE_BOOTSTRAP_MANIFEST_PATH), 'utf8');
    return parseProviderMaintenanceBootstrapAuthority(raw);
  } catch {
    return null;
  }
}

export function selectReviewGateDecision(authorities, bootstrapEligible = false) {
  const ordered = [
    ['CODEX', Boolean(authorities?.codex)],
    ['GITHUB_COPILOT', Boolean(authorities?.copilot)],
    ['OCTOPUS', Boolean(authorities?.octopus)],
    ['LOCAL_QWEN', Boolean(authorities?.localQwen)],
  ];
  const provider = ordered.find(([, present]) => present)?.[0] || '';
  if (provider) {
    return Object.freeze({
      classification: INDEPENDENT_REVIEW_CLASSIFICATION,
      reviewAuthority: provider,
    });
  }
  if (bootstrapEligible === true) {
    return Object.freeze({
      classification: PROVIDER_MAINTENANCE_BOOTSTRAP_CLASSIFICATION,
      reviewAuthority: 'NONE',
    });
  }
  return null;
}

export function reviewGateResultMode(value, expectedHeadSha, independentOnly = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  if (!sameStringSet(Object.keys(value), REVIEW_GATE_RESULT_KEYS)) return '';
  const expectedHead = canonicalSha40(expectedHeadSha);
  if (!expectedHead || value.head !== expectedHead) return '';
  if (value.schemaVersion !== REVIEW_GATE_RESULT_SCHEMA || value.status !== 'PASS') return '';
  const bootstrapPair = value.classification === PROVIDER_MAINTENANCE_BOOTSTRAP_CLASSIFICATION
    && value.reviewAuthority === 'NONE';
  const independentPair = value.classification === INDEPENDENT_REVIEW_CLASSIFICATION
    && INDEPENDENT_REVIEW_AUTHORITIES.has(value.reviewAuthority);
  if (independentPair) return 'INDEPENDENT';
  if (!independentOnly && bootstrapPair) return 'BOOTSTRAP';
  return '';
}

export function reviewGateResultContract(headSha, decision) {
  const head = canonicalSha40(headSha);
  if (!head || !decision || typeof decision !== 'object' || Array.isArray(decision)) return null;
  const contract = Object.freeze({
    schemaVersion: REVIEW_GATE_RESULT_SCHEMA,
    status: 'PASS',
    head,
    classification: String(decision.classification || ''),
    reviewAuthority: String(decision.reviewAuthority || ''),
  });
  return reviewGateResultMode(contract, head) ? contract : null;
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
  const sha = canonicalSha40(commit?.sha);
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
    headSha: canonicalSha40(value?.headRefOid),
    checks: Array.isArray(value?.statusCheckRollup) ? value.statusCheckRollup : [],
  };
}

function fetchLivePrHead(repo, prNumber) {
  const pr = ghJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  return canonicalSha40(pr?.head?.sha);
}

function fetchLiveMainSha(repo) {
  const branch = ghJson(['api', `repos/${repo}/branches/main`]);
  return canonicalSha40(branch?.commit?.sha);
}

function trustedCheckoutSha() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return canonicalSha40(sha);
  } catch {
    return '';
  }
}

function providerMaintenanceBootstrapDecision(repo, pr, headSha, reviews) {
  const liveMainSha = fetchLiveMainSha(repo);
  if (!liveMainSha) return { eligible: false, reason: 'live-main-unavailable' };
  if (trustedCheckoutSha() !== liveMainSha) {
    return { eligible: false, reason: 'trusted-main-moved' };
  }

  const bootstrap = loadProviderMaintenanceBootstrapAuthority();
  if (!bootstrap) return { eligible: false, reason: 'authority-invalid' };
  if (String(pr?.head?.ref || '') !== bootstrap.implementationBranch) {
    return { eligible: false, reason: 'branch-mismatch' };
  }
  if (String(pr?.head?.repo?.full_name || '') !== repo) {
    return { eligible: false, reason: 'head-repository-mismatch' };
  }
  if (String(pr?.base?.ref || '') !== 'main') {
    return { eligible: false, reason: 'base-ref-mismatch' };
  }
  if (exactHeadProviderBlockingEvidence(reviews, headSha).length > 0) {
    return { eligible: false, reason: 'explicit-provider-block' };
  }

  let comparison;
  try {
    comparison = ghJson(['api', `repos/${repo}/compare/${liveMainSha}...${headSha}`]);
  } catch {
    return { eligible: false, reason: 'compare-unavailable' };
  }
  if (!comparison || comparison.status !== 'ahead') {
    return { eligible: false, reason: 'not-forward-only-ahead' };
  }
  if (Number(comparison.behind_by) !== 0 || Number(comparison.ahead_by) < 1) {
    return { eligible: false, reason: 'main-synchronization-mismatch' };
  }
  if (canonicalSha40(comparison?.merge_base_commit?.sha) !== liveMainSha) {
    return { eligible: false, reason: 'authority-not-live-main-ancestor' };
  }
  const files = Array.isArray(comparison.files) ? comparison.files : [];
  if (files.length < 1 || files.length > bootstrap.allowedImplementationPaths.length) {
    return { eligible: false, reason: 'changed-file-count-invalid' };
  }
  const allowed = new Set(bootstrap.allowedImplementationPaths);
  const seen = new Set();
  for (const file of files) {
    const filename = String(file?.filename || '').trim();
    if (!allowed.has(filename) || seen.has(filename)) {
      return { eligible: false, reason: `scope-violation:${filename || 'missing'}` };
    }
    if (String(file?.status || '') !== 'modified') {
      return { eligible: false, reason: `file-status-invalid:${filename}` };
    }
    seen.add(filename);
  }
  if (seen.has(PROVIDER_MAINTENANCE_BOOTSTRAP_MANIFEST_PATH)) {
    return { eligible: false, reason: 'authority-self-modification' };
  }

  const snapshot = fetchCheckSnapshot(repo, Number(pr?.number || 0));
  if (!ciSnapshotMatchesHead(snapshot.headSha, headSha)) {
    return { eligible: false, reason: 'ci-head-mismatch' };
  }
  const observed = providerMaintenanceBootstrapSubstantiveChecks(snapshot.checks);
  if (observed.length === 0) {
    return { eligible: false, reason: 'ci-evidence-missing' };
  }
  const blockers = providerMaintenanceBootstrapCheckRollupBlockers(snapshot.checks);
  if (blockers.length > 0) {
    return { eligible: false, reason: `ci-not-green:${blockers.slice(0, 10).join(',')}` };
  }

  return {
    eligible: true,
    reason: 'eligible',
    classification: bootstrap.resultClassification,
    ciChecks: observed.length,
    liveMainSha,
  };
}

function fail(code, message) {
  console.error(`${code}: ${message}`);
  process.exit(1);
}

function main() {
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
  const prNumber = Number(process.env.PR_NUMBER || 0);
  const expectedHeadInput = String(process.env.HEAD_SHA || '').trim();
  const expectedHead = expectedHeadInput;
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

  const headShaInput = String(pr?.head?.sha || '').trim();
  if (!/^[0-9a-f]{40}$/u.test(headShaInput)) {
    fail('REVIEW_GATE_HEAD_INVALID', `Invalid PR head SHA for #${prNumber}.`);
  }
  const headSha = headShaInput;
  if (expectedHeadInput && !/^[0-9a-f]{40}$/u.test(expectedHeadInput)) {
    fail('REVIEW_GATE_EXPECTED_HEAD_INVALID', 'HEAD_SHA must be canonical lowercase SHA-40.');
  }
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
      return false;
    }
  });
  const localQwenAuthority = workflowBoundLocalQwenAttestations.length > 0;
  const authorities = {
    codex: codexAuthority,
    copilot: copilotAuthority,
    octopus: octopusAuthority,
    localQwen: localQwenAuthority,
  };

  let authorityDecision = selectReviewGateDecision(authorities, false);
  let bootstrap = { eligible: false, reason: 'independent-authority-present', ciChecks: 0 };
  if (!authorityDecision) {
    bootstrap = providerMaintenanceBootstrapDecision(repo, pr, headSha, reviews);
    if (!bootstrap.eligible) {
      fail(
        'REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING',
        'No genuine independent review authority is bound to exact head '
          + headSha
          + '; accepted providers are Codex clean/approved review, GitHub Copilot exact-head code review, Octopus exact-head clean attestation plus matching provider status, or Local Qwen exact-head clean attestation plus matching provider status and trusted Actions run. '
          + 'The source-controlled provider-maintenance bootstrap is not eligible: '
          + bootstrap.reason
          + '.',
      );
    }
    authorityDecision = selectReviewGateDecision(authorities, true);
  }
  if (!authorityDecision) {
    fail('REVIEW_GATE_AUTHORITY_DECISION_INVALID', 'Unable to produce a fail-closed review authority decision.');
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

  const isBootstrapDecision = authorityDecision.classification === PROVIDER_MAINTENANCE_BOOTSTRAP_CLASSIFICATION;
  if (isBootstrapDecision !== (bootstrap.eligible === true)) {
    fail(
      'REVIEW_GATE_BOOTSTRAP_DECISION_MISMATCH',
      'Review authority classification and validated bootstrap eligibility disagree.',
    );
  }

  let checkedCi = isBootstrapDecision ? bootstrap.ciChecks : 0;
  if (isBootstrapDecision && (!Number.isInteger(checkedCi) || checkedCi < 1)) {
    fail(
      'REVIEW_GATE_BOOTSTRAP_CI_EVIDENCE_INVALID',
      'Bootstrap review classification requires validated exact-head non-provider CI evidence.',
    );
  }
  if (!isBootstrapDecision && requireGreenCi) {
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

  const resultContract = reviewGateResultContract(headSha, authorityDecision);
  if (!resultContract) {
    fail('REVIEW_GATE_RESULT_INVALID', 'Review authority/classification pair is inconsistent.');
  }
  console.log(`PR_REVIEW_GATE_RESULT=${JSON.stringify(resultContract)}`);
  console.log(
    'PR_REVIEW_GATE=PASS pr=' + prNumber
      + ' head=' + headSha
      + ' reviewClassification=' + resultContract.classification
      + ' reviewAuthority=' + resultContract.reviewAuthority
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
