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
      && String(latestProviderStatus?.target_url || latestProviderStatus?.targetT®RÇÂrr’çG&–Ò‚’ÓÓÒW‡V7FVEF&vWC°¢Ò“°§Ð ¦W‡÷'BgVæ7F–öâÆö6ÅvVäGFW7FF–öäÖF6†W5v÷&¶fÆ÷u'Vâ†GFW7FF–öâÂ'VâÂ&WòÂ$çVÖ&W"Â†VE6†’°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢6öç7B&t†VBÒ7G&–ær††VE6†ÇÂrr’çG&–Ò‚“°¢–b‚õå³Ó–Öe×³CÒB÷RçFW7B‡&t†VB’’&WGW&âfÇ6S°¢6öç7BW‡V7FVD†VBÒ7G&–7Ev÷&¶fÆ÷u'Vå6†C‡&t†VB“°¢6öç7BW‡V7FVE"ÒçVÖ&W"‡$çVÖ&W"ÇÂ“°¢–b‚GFW7FF–öâÇÂ'Vâ’&WGW&âfÇ6S°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’’&WGW&âfÇ6S°¢–b‚W‡V7FVD†VB’&WGW&âfÇ6S°¢–b‚çVÖ&W"æ—4–çFVvW"†W‡V7FVE"—ÇÂW‡V7FVE"ÃÒ’&WGW&âfÇ6S°¢6öç7BGFW7FVE'Vä–BÒ7G&–ær†GFW7FF–öãòç'Vä–BÇÂrr’çG&–Ò‚“°¢–b‚õå³Ó•Õ³Ó•×³Ã—ÒB÷RçFW7B†GFW7FVE'Vä–B’’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòæ–Bóòrr’çG&–Ò‚’ÓÒGFW7FVE'Vä–B’&WGW&âfÇ6S°¢–b…7G&–ær‡'VãòææÖRÇÂrr’çG&–Ò‚’ÓÒÄô4ÅõtTåõtõ$´dÄõuôäÔR’&WGW&âfÇ6S°¢–b…7G&–ær‡'VãòçF‚ÇÂrr’çG&–Ò‚’ÓÒÄô4ÅõtTåõtõ$´dÄõuõD‚’&WGW&âfÇ6S°¢–b…7G&–ær‡'VãòæWfVçBÇÂrr’çG&–Ò‚’ÓÒwVÆÅ÷&WVW7E÷F&vWBr’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòç7FGW2ÇÂrr’çG&–Ò‚’ÓÒv6ö×ÆWFVBr’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòæ6öæ6ÇW6–öâÇÂrr’çG&–Ò‚’ÓÒw7V66W72r’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòç&W÷6—F÷'“òægVÆÅöæÖRÇÂrr’çG&–Ò‚’ÓÒ&W÷6—F÷'’’&WGW&âfÇ6S°¢6öç7B'Vä†VBÒ7G&–7Ev÷&¶fÆ÷u'Vå6†C‡'Vãòæ†VE÷6†“°¢–b‚'Vä†VBÇÂ'Vä†VBÓÒW‡V7FVD†VB’&WGW&âfÇ6S° ¢6öç7B'Vå'2Ò'&’æ—4'&’‡'VãòçVÆÅ÷&WVW7G2’ò'VâçVÆÅ÷&WVW7G2¢µÓ°¢&WGW&â'Vå'2ç6öÖR‚‡'Vå"’Óâ°¢6öç7B'Vå$†VBÒ7G&–7Ev÷&¶fÆ÷u'Vå6†C‡'Vå#òæ†VCòç6†“°¢&WGW&âçVÖ&W"‡'Vå#òæçVÖ&W"’ÓÓÒW‡V7FVE ¢bb'Vå$†VBÓÓÒW‡V7FVD†V@¢bbçVÖ&W"‡'Vå#òæ†VCòç&Wóòæ–BÇÂ’ÓÓÒçVÖ&W"‡'Vãòç&W÷6—F÷'“òæ–BÇÂ“°¢Ò“°§Ð ¦W‡÷'BgVæ7F–öâ÷6—F—fTW†7D†VDö7F÷W4GFW7FF–öç2‡&Wf–Ww2Â7FGW6W2Â†VE6†Â&Wò’°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’’&WGW&âµÓ° ¢6öç7BÆFW7E&÷f–FW%7FGW2ÒÆFW7E&÷f–FW%7FGW4f÷$6öçFW‡B‡7FGW6W2Âô5DõU5õ5DEU5ô4ôåDU…B“°¢–b‚ÆFW7E&÷f–FW%7FGW2’&WGW&âµÓ°¢–b…7G&–ær†ÆFW7E&÷f–FW%7FGW3òç7FFRÇÂrr’çFôÆ÷vW$66R‚’ÓÒw7V66W72r’&WGW&âµÓ°¢–b…7G&–ær†ÆFW7E&÷f–FW%7FGW3òæ7&VF÷#òæÆöv–âÇÂrr’çG&–Ò‚’ÓÒô5DõU5õ$Ud”UuôÄôt”â’&WGW&âµÓ° ¢6öç7B6æF–FFW2Ò‡&Wf–Ww2ÇÂµÒ¢æÖ‚‡&Wf–Wr’Óâ'6Tö7F÷W4GFW7FF–öâ‡&Wf–WrÂ†VE6†’¢æf–ÇFW"„&ööÆVâ“° ¢&WGW&â6æF–FFW2æf–ÇFW"‚†6æF–FFR’Óâ°¢6öç7BW‡V7FVDFW67&—F–öâÒö7F÷W26ÆVâG´ô5DõU5ô5D”ôåõ4„ç6Æ–6RƒÂ‚—Ò7VÖÖ'“ÒG¶6æF–FFRç7VÖÖ'•6†#Sbç6Æ–6RƒÂb—Ö°¢6öç7BW‡V7FVEF&vWBÒ‡GG3¢òöv—F‡V"æ6öÒòG·&W÷6—F÷'—Òö7F–öç2÷'Vç2òG¶6æF–FFRç'Vä–GÖ°¢&WGW&â7G&–ær†ÆFW7E&÷f–FW%7FGW3òæFW67&—F–öâÇÂrr’çG&–Ò‚’ÓÓÒW‡V7FVDFW67&—F–öà¢bb7G&–ær†ÆFW7E&÷f–FW%7FGW3òçF&vWE÷W&ÂÇÂÆFW7E&÷f–FW%7FGW3òçF&vWEW&ÂÇÂrr’çG&–Ò‚’ÓÓÒW‡V7FVEF&vWC°¢Ò“°§Ð ¦W‡÷'BgVæ7F–öâö7F÷W4GFW7FF–öäÖF6†W5v÷&¶fÆ÷u'Vâ†GFW7FF–öâÂ'VâÂ&WòÂ$çVÖ&W"Â†VE6†’°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢6öç7B&t†VBÒ7G&–æræ†VE6†ÇÂrr’çG&–Ò‚“°¢–b‚õå³Ó–Öe×³CÒB÷RçFW7B‡&t†VB’’&WGW&âfÇ6S°¢6öç7BW‡V7FVD†VBÒ7G&–7Ev÷&¶fÆ÷u'Vå6†C‡&t†VB“°¢6öç7BW‡V7FVE"ÒçVÖ&W"‡$çVÖ&W"ÇÂ“°¢–b‚GFW7FF–öâÇÂ'Vâ’&WGW&âfÇ6S°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’’&WGW&âfÇ6S°¢–b‚W‡V7FVD†VB’&WGW&âfÇ6S°¢–b‚çVÖ&W"æ—4–çFVvW"†W‡V7FVE"’ÇÂW‡V7FVE"ÃÒ’&WGW&âfÇ6S°¢6öç7BGFW7FVE'Vä–BÒ7G&–ær†GFW7FF–öãòç'Vä–BÇÂrr’çG&–Ò‚“°¢–b‚õå³Ó•Õ³Ó•×³Ã—ÒB÷RçFW7B†GFW7FVE'Vä–B’’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòæ–Bóòrr’çG&–Ò‚’ÓÒGFW7FVE'Vä–B’&WGW&âfÇ6S°¢–b…7G&–ær‡'VãòææÖRÇÂrr’çG&–Ò‚’ÓÒt–æFWVæFVçBö7F÷W2&Wf–Wrr’&WGW&âfÇ6S°¢–b…7G&–ær‡'VãòçF‚ÇÂrr’çG&–Ò‚’ÓÒô5DõU5õtõ$´dÄõuõD‚’&WGW&âfÇ6S°¢–b…7G&–ær‡'VãòæWfVçBÇÂrr’çG&–Ò‚’ÓÒwVÆÅ÷&WVW7E÷F&vWBr’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòç7FGW2ÇÂrr’çG&–Ò‚’ÓÒv6ö×ÆWFVBr’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòæ6öæ6ÇW6–öâÇÂrr’çG&–Ò‚’ÓÒw7V66W72r’&WGW&âfÇ6S°¢–b…7G&–ær‡'Vãòç&W÷6—F÷'“òægVÆÅöæÖRÇÂrr’çG&–Ò‚’ÓÒ&W÷6—F÷'’’&WGW&âfÇ6S°¢6öç7B'Vä†VBÒ7G&–7Ev÷&¶fÆ÷u'Vå6†C‡'Vãòæ†VE÷6†“°¢–b‚'Vä†VBÇÂ'Vä†VBÓÒW‡V7FVD†VB’&WGW&âfÇ6S° ¢6öç7B'Vå'2Ò'&’æ—4'&’‡'VãòçVÆÅ÷&WVW7G2’ò'VâçVÆÅ÷&WVW7G2¢µÓ°¢&WGW&â'Vå'2ç6öÖR‚‡'Vå"’Óâ°¢6öç7B'Vå$†VBÒ7G&–7Ev÷&¶fÆ÷u'Vå6†C‡'Vå#òæ†VCòç6†“°¢&WGW&âçVÖ&W"‡'Vå#òæçVÖ&W"’ÓÓÒW‡V7FVE ¢bb'Vå$†VBÓÓÒW‡V7FVD†V@¢bbçVÖ&W"‡'Vå#òæ†VCòç&Wóòæ–BÇÂ’ÓÓÒçVÖ&W"‡'Vãòç&W÷6—F÷'“òæ–BÇÂ“°¢Ò“°§Ð ¦W‡÷'BgVæ7F–öâ6ÆVä6öFW…&Wf–Wu&Vf—†W2†6öÖÖVçG2’°¢6öç7B&Vf—†W2ÒµÓ°¢f÷"†6öç7B6öÖÖVçBöb6öÖÖVçG2ÇÂµÒ’°¢6öç7BÆöv–âÒæ÷&ÖÆ—¦TÆöv–â†6öÖÖVçB“°¢–b‚4ôDU…õ$Ud”UuôÄôt”å2æ†2†Æöv–â’’6öçF–çVS°¢6öç7B&öG’Ò7G&–ær†6öÖÖVçCòæ&öG’ÇÂrr“°¢–b‚ô6öFW‚&Wf–Ws¥Ç2¤F–FâwBf–æBç’Ö¦÷"—77VW5Ââ÷RçFW7B†&öG’’’6öçF–çVS°¢6öç7BÖF6‚Ò&öG’æÖF6‚‚õÂ¥Â¥&Wf–WvVB6öÖÖ—C¥Â¥Â¥Ç2¦…³Ó–Öe×³ÃCÒ–÷R“°¢–b†ÖF6‚’&Vf—†W2çW6‚†ÖF6…³Ò“°¢Ð¢&WGW&â&Vf—†W3°§Ð ¦W‡÷'BgVæ7F–öâW†7D†VD÷væW%6VÆdVF—G2†6öÖÖVçG2Â÷væW$Æöv–âÂ†VE6†’°¢6öç7B÷væW"Ò7G&–ær†÷væW$Æöv–âÇÂrr’çG&–Ò‚“°¢6öç7BW‡V7FVBÒ6æöæ–6Å6†C††VE6†“°¢–b‚÷væW"ÇÂW‡V7FVB’&WGW&âµÓ° ¢&WGW&â†6öÖÖVçG2ÇÂµÒ’æf–ÇFW"‚†6öÖÖVçB’Óâ°¢–b†æ÷&ÖÆ—¦TÆöv–â†6öÖÖVçB’ÓÒ÷væW"’&WGW&âfÇ6S°¢6öç7B&öG’Ò7G&–ær†6öÖÖVçCòæ&öG’ÇÂrr“°¢6öç7BÖF6†W2Ò²ââæ&öG’æÖF6„ÆÂ‚ôõtäU"4TÄbÔTD•C¥Ç2¥52W†7B†VEÇ2¦…³Ó–Öe×³CÒ–öwR•Ó°¢&WGW&âÖF6†W2ç6öÖR‚†ÖF6‚’ÓâÖF6…³ÒÓÓÒW‡V7FVB“°¢Ò“°§Ð ¦W‡÷'BgVæ7F–öâ7F—fUVç&W6öÇfVEF‡&VG2‡F‡&VG2’°¢&WGW&â‡F‡&VG2ÇÂµÒ’æf–ÇFW"‚‡F‡&VB’ÓâF‡&VCòæ—5&W6öÇfVBÓÒG'VRbbF‡&VCòæ—4÷WFFFVBÓÒG'VR“°§Ð ¦W‡÷'BgVæ7F–öâÆFW7D&Æö6¶–æt6†ævU&WVW7G2‡&Wf–Ww2’°¢6öç7B&Æö6¶VD'•&Wf–WvW"ÒæWrÖ‚“°¢6öç7B÷&FW&VBÒ²âââ‡&Wf–Ww2ÇÂµÒ•Òç6÷'B‚†ÆVgBÂ&–v‡B’Óâ°¢6öç7BÆVgEF–ÖRÒFFRç'6R†ÆVgCòç7V&Ö—GFVEöBÇÂÆVgCòç7V&Ö—GFVDBÇÂ’ÇÂ°¢6öç7B&–v‡EF–ÖRÒFFRç'6R‡&–v‡Còç7V&Ö—GFVEöBÇÂ&–v‡Còç7V&Ö—GFVDBÇÂ’ÇÂ°¢&WGW&âÆVgEF–ÖRÒ&–v‡EF–ÖS°¢Ò“° ¢f÷"†6öç7B&Wf–Wröb÷&FW&VB’°¢6öç7BÆöv–âÒæ÷&ÖÆ—¦TÆöv–â‡&Wf–Wr“°¢–b‚Æöv–â’6öçF–çVS°¢6öç7B7FFRÒ7G&–ær‡&Wf–Wsòç7FFRÇÂrr’çFõWW$66R‚“° ¢–b‡7FFRÓÓÒt4„ätU5õ$UTU5DTBr’°¢&Æö6¶VD'•&Wf–WvW"ç6WB†Æöv–âÂ&Wf–Wr“°¢6öçF–çVS°¢Ð ¢–b‡7FFRÓÓÒt$õdTBrÇÂ7FFRÓÓÒtD•4Ô•54TBr’°¢&Æö6¶VD'•&Wf–WvW"æFVÆWFR†Æöv–â“°¢Ð¢Ð ¢&WGW&â²ââæ&Æö6¶VD'•&Wf–WvW"æVçG&–W2‚•Ð¢æÖ‚…¶Æöv–âÂ&Wf–WuÒ’Óâ‡²Æöv–âÂ&Wf–WrÒ’“°§Ð ¦W‡÷'BgVæ7F–öâW†7D†VE&÷f–FW$&Æö6¶–ætWf–FVæ6R‡&Wf–Ww2Â†VE6†’°¢6öç7BW‡V7FVBÒ6æöæ–6Å6†C††VE6†“°¢–b‚W‡V7FVB’&WGW&âµÓ°¢&WGW&â‡&Wf–Ww2ÇÂµÒ’æf–ÇFW"‚‡&Wf–Wr’Óâ°¢6öç7B6öÖÖ—D–BÒ6æöæ–6Å6†C‡&Wf–Wsòæ6öÖÖ—Eö–BÇÂ&Wf–Wsòæ6öÖÖ—D–B“°¢–b†6öÖÖ—D–BÓÒW‡V7FVB’&WGW&âfÇ6S°¢6öç7BÆöv–âÒæ÷&ÖÆ—¦TÆöv–â‡&Wf–Wr“°¢6öç7B&öG’Ò7G&–ær‡&Wf–Wsòæ&öG’ÇÂrr’çG&–Ò‚“°¢–b‚õäÄô4ÂtTâ”äDUTäDTåB$Ud”Us¢$Äô4²ƒó¥ÆçÂB’÷RçFW7B†&öG’’’°¢&WGW&âÆöv–âÓÓÒÄô4ÅõtTåõ$Ud”UuôÄôt”ã°¢Ð¢–b‚õäô5DõU2”äDUTäDTåB$Ud”Us¢$Äô4²ƒó¥ÆçÂB’÷RçFW7B†&öG’’’°¢&WGW&âÆöv–âÓÓÒô5DõU5õ$Ud”UuôÄôt”ã°¢Ð¢&WGW&âfÇ6S°¢Ò“°§Ð ¦gVæ7F–öâ6†V6´æÖR†6†V6²’°¢&WGW&â7G&–ær†6†V6³òæ6öçFW‡BÇÂ6†V6³òææÖRÇÂ6†V6³òçF—FÆRÇÂrr’çG&–Ò‚“°§Ð ¦gVæ7F–öâ6†V6µv÷&¶fÆ÷r†6†V6²’°¢&WGW&â7G&–ær†6†V6³òçv÷&¶fÆ÷tæÖRÇÂ6†V6³òçv÷&¶fÆ÷rÇÂrr’çG&–Ò‚“°§Ð ¦gVæ7F–öâ÷6—F—fT–çFVvW%7G&–ær‡fÇVR’°¢6öç7Bæ÷&ÖÆ—¦VBÒ7G&–ær‡fÇVRóòrr’çG&–Ò‚“°¢&WGW&âõå³Ó•Õ³Ó•×³Ã—ÒB÷RçFW7B†æ÷&ÖÆ—¦VB’òæ÷&ÖÆ—¦VB¢rs°§Ð ¦gVæ7F–öâ7G&–7DæöäV×G•7G&–ær‡fÇVR’°¢&WGW&âG—VöbfÇVRÓÓÒw7G&–ærrbbfÇVRÓÓÒfÇVRçG&–Ò‚’bbfÇVRòfÇVR¢rs°§Ð ¦gVæ7F–öâ7G&–7E7F'FVDB‡fÇVR’°¢–b‡G—VöbfÇVRÓÒw7G&–ærrÇÂfÇVRçG&–Ò‚’’&WGW&âçVÆÃ°¢6öç7BF–ÖW7F×ÒFFRç'6R‡fÇVR“°¢&WGW&âçVÖ&W"æ—4f–æ—FR‡F–ÖW7F×’òF–ÖW7F×¢çVÆÃ°§Ð ¦W‡÷'BgVæ7F–öâ7F–öç5'Vä–Dg&öÔ6†V6²†6†V6²Â&Wò’°¢–b‚6†V6µv÷&¶fÆ÷r†6†V6²’’&WGW&ârs°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’’&WGW&ârs°¢6öç7BFWF–Ç5W&ÂÒ7G&–ær†6†V6³òæFWF–Ç5W&ÂÇÂ6†V6³òæFWF–Ç5÷W&ÂÇÂrr’çG&–Ò‚“°¢–b‚FWF–Ç5W&Â’&WGW&ârs° ¢ÆWB'6VC°¢G'’°¢'6VBÒæWrU$Â†FWF–Ç5W&Â“°¢Ò6F6‚°¢&WGW&ârs°¢Ð¢–b‡'6VBç&÷Fö6öÂÓÒv‡GG3¢rÇÂ'6VBæ†÷7FæÖRÓÒvv—F‡V"æ6öÒr’&WGW&ârs° ¢6öç7B¶÷væW"ÂæÖUÒÒ&W÷6—F÷'’ç7Æ—B‚ròr“°¢6öç7B'G2Ò'6VBçF†æÖRç7Æ—B‚ròr’æf–ÇFW"„&ööÆVâ“°¢–b‡'G2æÆVæwF‚ÂR’&WGW&ârs°¢–b‡'G5³ÒçFôÆ÷vW$66R‚’ÓÒ÷væW"çFôÆ÷vW$66R‚’ÇÂ'G5³ÒçFôÆ÷vW$66R‚’ÓÒæÖRçFôÆ÷vW$66R‚’’&WGW&ârs°¢–b‡'G5³%ÒÓÒv7F–öç2rÇÂ'G5³5ÒÓÒw'Vç2r’&WGW&ârs°¢&WGW&â÷6—F—fT–çFVvW%7G&–ær‡'G5³EÒ“°§Ð ¦W‡÷'BgVæ7F–öâ7F–öç5'Vä•F‚‡&WòÂ'Vä–B’°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢6öç7B–BÒ÷6—F—fT–çFVvW%7G&–ær‡'Vä–B“°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’ÇÂ–B’&WGW&ârs°¢&WGW&â&W÷2òG·&W÷6—F÷'—Òö7F–öç2÷'Vç2òG¶–GÖ°§Ð ¦W‡÷'BgVæ7F–öâ6æöæ–6Æ—¦TW†7E$†VD7F–öç46†V6·2€¢6†V6·2À¢7F–öç5'Vç2À¢W‡V7FVD†VE6†À¢W‡V7FVD†VE&VbÀ¢&WòÀ¢’°¢6öç7BW‡V7FVE6†Ò6æöæ–6Å6†C†W‡V7FVD†VE6†“°¢6öç7BW‡V7FVE&VbÒ7G&–7DæöäV×G•7G&–ær†W‡V7FVD†VE&Vb“°¢6öç7B6÷W&6T6†V6·2Ò'&’æ—4'&’†6†V6·2’ò6†V6·2¢µÓ°¢6öç7B6÷W&6U'Vç2Ò'&’æ—4'&’†7F–öç5'Vç2’ò7F–öç5'Vç2¢µÓ°¢6öç7BW'&÷'2ÒµÓ° ¢–b‚W‡V7FVE6†’&WGW&â²6†V6·3¢µÒÂW'&÷'3¢²vW†7BÖ†VB×6†Ö–çfÆ–BuÒÓ°¢–b‚W‡V7FVE&Vb’&WGW&â²6†V6·3¢µÒÂW'&÷'3¢²vW†7BÖ†VB×&VbÖ–çfÆ–BuÒÓ°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&Wò’’&WGW&â²6†V6·3¢µÒÂW'&÷'3¢²w&W÷6—F÷'’Ö–çfÆ–BuÒÓ° ¢6öç7B'Vç4'”–BÒæWrÖ‚“°¢f÷"†6öç7B'Vâöb6÷W&6U'Vç2’°¢6öç7B–BÒ÷6—F—fT–çFVvW%7G&–ær‡'Vãòæ–B“°¢–b‚–B’°¢W'&÷'2çW6‚‚v7F–öç2×'VâÖ–BÖ–çfÆ–Br“°¢6öçF–çVS°¢Ð¢–b‡'Vç4'”–Bæ†2†–B’’°¢W'&÷'2çW6‚†7F–öç2×'VâÖGWÆ–6FS¢G¶–GÖ“°¢6öçF–çVS°¢Ð¢'Vç4'”–Bç6WB†–BÂ'Vâ“°¢Ð ¢6öç7B77F‡&÷Vv‚ÒµÓ°¢6öç7B7W'&VçE$7F–öç2ÒµÓ°¢f÷"†ÆWB–æFW‚Ò²–æFW‚Â6÷W&6T6†V6·2æÆVæwFƒ²–æFW‚³Ò’°¢6öç7B6†V6²Ò6÷W&6T6†V6·5¶–æFW…Ó°¢6öç7Bv÷&¶fÆ÷rÒ6†V6µv÷&¶fÆ÷r†6†V6²“°¢–b‚v÷&¶fÆ÷r’°¢77F‡&÷Vv‚çW6‚‡²–æFW‚Â6†V6²Ò“°¢6öçF–çVS°¢Ð ¢6öç7B'Vä–BÒ7F–öç5'Vä–Dg&öÔ6†V6²†6†V6²Â&Wò“°¢–b‚'Vä–B’°¢W'&÷'2çW6‚†7F–öç2Ö6†V6²×'Vâ×W&ÂÖ–çfÆ–C¢G·v÷&¶fÆ÷wÓ¢G¶6†V6´æÖR†6†V6²’ÇÂwVææÖVBÖ6†V6²wÖ“°¢6öçF–çVS°¢Ð¢6öç7B'VâÒ'Vç4'”–BævWB‡'Vä–B“°¢–b‚'Vâ’°¢W'&÷'2çW6‚†7F–öç2×'VâÖÖWFFFÖÖ—76–æs¢G·'Vä–GÖ“°¢6öçF–çVS°¢Ð ¢6öç7BÖWFFF–BÒ÷6—F—fT–çFVvW%7G&–ær‡'Vãòæ–B“°¢6öç7Bv÷&¶fÆ÷t–BÒ÷6—F—fT–çFVvW%7G&–ær‡'Vãòçv÷&¶fÆ÷uö–B“°¢6öç7B'VäçVÖ&W"Ò÷6—F—fT–çFVvW%7G&–ær‡'Vãòç'VåöçVÖ&W"“°¢6öç7B'VäGFV×BÒ÷6—F—fT–çFVvW%7G&–ær‡'Vãòç'VåöGFV×B“°¢6öç7B'Vä†VE6†Ò6æöæ–6Å6†C‡'Vãòæ†VE÷6†“°¢6öç7B'Vä†VE&VbÒ7G&–7DæöäV×G•7G&–ær‡'Vãòæ†VEö'&æ6‚“°¢6öç7BWfVçBÒ7G&–7DæöäV×G•7G&–ær‡'VãòæWfVçB“°¢–b‚ÖWFFF–BÇÂv÷&¶fÆ÷t–BÇÂ'VäçVÖ&W"ÇÂ'VäGFV×BÇÂ'Vä†VE6†ÇÂ'Vä†VE&VbÇÂWfVçB’°¢W'&÷'2çW6‚†7F–öç2×'VâÖWF†÷&—G’ÖÖWFFFÖ–çfÆ–C¢G·'Vä–GÖ“°¢6öçF–çVS°¢Ð¢–b†ÖWFFF–BÓÒ'Vä–B’°¢W'&÷'2çW6‚†7F–öç2×'VâÖ–BÖÖ—6ÖF6ƒ¢G·'Vä–GÖ“°¢6öçF–çVS°¢Ð¢–b‡'Vä†VE6†ÓÒW‡V7FVE6†’°¢W'&÷'2çW6‚†7F–öç2×'VâÖ†VB×6†ÖÖ—6ÖF6ƒ¢G·'Vä–GÖ“°¢6öçF–çVS°¢Ð ¢òòv—D‡V"w26öÖÖ—BÖÆWfVÂ&öÆÇW6â6öçF–â6†V6·2g&öÒF–ffW&VçB'&æ6‚F†Bö–çG2@¢òòF†R6ÖR4„âfÆ–B'VâÖWFFF&÷f–ærf÷&V–vâ†VB&VbÖ¶W2F†B6†V6²æöâÕ"WF†÷&—G’à¢–b‡'Vä†VE&VbÓÒW‡V7FVE&Vb’6öçF–çVS° ¢7W'&VçE$7F–öç2çW6‚‡°¢6†V6²À¢WfVçBÀ¢–æFW‚À¢'Vä–BÀ¢'VäçVÖ&W#¢&–t–çB‡'VäçVÖ&W"’À¢v÷&¶fÆ÷t–BÀ¢Ò“°¢Ð ¢–b†W'&÷'2æÆVæwF‚â’&WGW&â²6†V6·3¢µÒÂW'&÷'3¢²ââææWr6WB†W'&÷'2•ÒÓ° ¢6öç7BWF†÷&—FF—fU'Vä'”fÖ–Ç’ÒæWrÖ‚“°¢f÷"†6öç7BVçG'’öb7W'&VçE$7F–öç2’°¢6öç7BfÖ–Ç’ÒG¶VçG'’çv÷&¶fÆ÷t–GÕÇSG¶VçG'’æWfVçGÖ°¢6öç7B&Wf–÷W2ÒWF†÷&—FF—fU'Vä'”fÖ–Ç’ævWB†fÖ–Ç’“°¢–b‚&Wf–÷W2ÇÂVçG'’ç'VäçVÖ&W"â&Wf–÷W2ç'VäçVÖ&W"’°¢WF†÷&—FF—fU'Vä'”fÖ–Ç’ç6WB†fÖ–Ç’Â²'Vä–C¢VçG'’ç'Vä–BÂ'VäçVÖ&W#¢VçG'’ç'VäçVÖ&W"Ò“°¢6öçF–çVS°¢Ð¢–b†VçG'’ç'VäçVÖ&W"ÓÓÒ&Wf–÷W2ç'VäçVÖ&W"bbVçG'’ç'Vä–BÓÒ&Wf–÷W2ç'Vä–B’°¢W'&÷'2çW6‚†7F–öç2×'VâÖçVÖ&W"ÖÖ&–wV÷W3¢G¶VçG'’çv÷&¶fÆ÷t–GÓ¢G¶VçG'’æWfVçGÓ¢G¶VçG'’ç'VäçVÖ&W'Ö“°¢Ð¢Ð¢–b†W'&÷'2æÆVæwF‚â’&WGW&â²6†V6·3¢µÒÂW'&÷'3¢²ââææWr6WB†W'&÷'2•ÒÓ° ¢6öç7B6VÆV7FVBÒ7W'&VçE$7F–öç2æf–ÇFW"‚†VçG'’’Óâ°¢6öç7BfÖ–Ç’ÒG¶VçG'’çv÷&¶fÆ÷t–GÕÇSG¶VçG'’æWfVçGÖ°¢&WGW&âWF†÷&—FF—fU'Vä'”fÖ–Ç’ævWB†fÖ–Ç’“òç'Vä–BÓÓÒVçG'’ç'Vä–C°¢Ò“° ¢6öç7B6VÆV7FVD'”Æöv–6Ä6†V6²ÒæWrÖ‚“°¢f÷"†6öç7BVçG'’öb6VÆV7FVB’°¢6öç7BæÖRÒ6†V6´æÖR†VçG'’æ6†V6²“°¢–b‚æÖR’°¢W'&÷'2çW6‚†7F–öç2×6VÆV7FVBÖ6†V6²ÖæÖRÖÖ—76–æs¢G¶VçG'’ç'Vä–GÖ“°¢6öçF–çVS°¢Ð¢6öç7B¶W’ÒG¶VçG'’ç'Vä–GÕÇSG¶æÖWÖ°¢6öç7Bw&÷WÒ6VÆV7FVD'”Æöv–6Ä6†V6²ævWB†¶W’’ÇÂµÓ°¢w&÷WçW6‚†VçG'’“°¢6VÆV7FVD'”Æöv–6Ä6†V6²ç6WB†¶W’Âw&÷W“°¢Ð ¢6öç7BFVGWVBÒµÓ°¢f÷"†6öç7Bw&÷Wöb6VÆV7FVD'”Æöv–6Ä6†V6²çfÇVW2‚’’°¢–b†w&÷WæÆVæwF‚ÓÓÒ’°¢FVGWVBçW6‚†w&÷W³Ò“°¢6öçF–çVS°¢Ð¢6öç7B&æ¶VBÒw&÷WæÖ‚†VçG'’’Óâ‡²VçG'’Â7F'FVDC¢7G&–7E7F'FVDB†VçG'’æ6†V6³òç7F'FVDB’Ò’“°¢–b‡&æ¶VBç6öÖR‚†—FVÒ’Óâ—FVÒç7F'FVDBÓÓÒçVÆÂ’’°¢W'&÷'2çW6‚†7F–öç2×6VÆV7FVBÖ6†V6²×7F'FVBÖBÖ–çfÆ–C¢G¶w&÷W³Òç'Vä–GÓ¢G¶6†V6´æÖR†w&÷W³Òæ6†V6²—Ö“°¢6öçF–çVS°¢Ð¢&æ¶VBç6÷'B‚†Â"’Óâ"ç7F'FVDBÒç7F'FVDB“°¢–b‡&æ¶VBæÆVæwF‚âbb&æ¶VE³Òç7F'FVDBÓÓÒ&æ¶VE³Òç7F'FVDB’°¢W'&÷'2çW6‚†7F–öç2×6VÆV7FVBÖ6†V6²×7F'FVBÖBÖÖ&–wV÷W3¢G¶w&÷W³Òç'Vä–GÓ¢G¶6†V6´æÖR†w&÷W³Òæ6†V6²—Ö“°¢6öçF–çVS°¢Ð¢FVGWVBçW6‚‡&æ¶VE³ÒæVçG'’“°¢Ð ¢–b†W'&÷'2æÆVæwF‚â’&WGW&â²6†V6·3¢µÒÂW'&÷'3¢²ââææWr6WB†W'&÷'2•ÒÓ°¢&WGW&â°¢6†V6·3¢²ââç77F‡&÷Vv‚ÂââæFVGWVEÒç6÷'B‚†Â"’Óâæ–æFW‚Ò"æ–æFW‚’æÖ‚†VçG'’’ÓâVçG'’æ6†V6²’À¢W'&÷'3¢µÒÀ¢Ó°§Ð ¦W‡÷'BgVæ7F–öâ—4–væ÷&VDÖW&vTvFT6†V6²†6†V6²’°¢6öç7BæÖRÒ6†V6´æÖR†6†V6²“°¢6öç7Bv÷&¶fÆ÷rÒ6†V6µv÷&¶fÆ÷r†6†V6²“°¢&WGW&â”täõ$TEô4„T4µôäÔU2æ†2†æÖR’ÇÂ”täõ$TEô4„T4µõtõ$´dÄõu2æ†2‡v÷&¶fÆ÷r“°§Ð ¦W‡÷'BgVæ7F–öâ—5&÷f–FW%&Wf–Wt6†V6²†6†V6²’°¢6öç7BæÖRÒ6†V6´æÖR†6†V6²“°¢6öç7Bv÷&¶fÆ÷rÒ6†V6µv÷&¶fÆ÷r†6†V6²“°¢&WGW&â$õd”DU%õ$Ud”Uuô4„T4µôäÔU2æ†2†æÖR’ÇÂ$õd”DU%õ$Ud”Uuõtõ$´dÄõu2æ†2‡v÷&¶fÆ÷r“°§Ð ¦W‡÷'BgVæ7F–öâ7V'7FçF—fT6†V6·2†6†V6·2’°¢&WGW&â†6†V6·2ÇÂµÒ’æf–ÇFW"‚†6†V6²’Óâ—4–væ÷&VDÖW&vTvFT6†V6²†6†V6²’“°§Ð ¢òò&ö÷G7G&4’Wf–FVæ6R—2–çFVçF–öæÆÇ’æ'&÷vW"F†â÷&F–æ'’ÖW&vR4“ ¢òò&VÖ÷fR6VÆbÖFVFÆö6¶–ærWFöÖF–öâ6†V6·2f—'7BÂF†Vâ&VÖ÷fR&÷f–FW"×&Wf–Wrf–Æ&–Æ—G’6†V6·2öæÇ’†W&Rà¦W‡÷'BgVæ7F–öâ&÷f–FW$Ö–çFVææ6T&ö÷G7G&7V'7FçF—fT6†V6·2†6†V6·2’°¢6öç7Bö'6W'fVBÒ7V'7FçF—fT6†V6·2†6†V6·2“°¢&WGW&âö'6W'fVBæf–ÇFW"‚†6†V6²’Óâ—5&÷f–FW%&Wf–Wt6†V6²†6†V6²’“°§Ð ¦W‡÷'BgVæ7F–öâ6†V6µ&öÆÇW&Æö6¶W'2†6†V6·2’°¢6öç7B&Æö6¶W'2ÒµÓ° ¢f÷"†6öç7B6†V6²öb7V'7FçF—fT6†V6·2†6†V6·2’’°¢6öç7BæÖRÒ6†V6´æÖR†6†V6²’ÇÂwVææÖVBÖ6†V6²s°¢6öç7Bv÷&¶fÆ÷rÒ6†V6µv÷&¶fÆ÷r†6†V6²“°¢6öç7B7FGW2Ò7G&–ær†6†V6³òç7FGW2ÇÂrr’çFõWW$66R‚“°¢6öç7BFW&Ö–æÅ7FFRÒ7G&–ær†6†V6³òæ6öæ6ÇW6–öâÇÂ6†V6³òç7FFRÇÂrr’çFõWW$66R‚“° ¢–b‡7FGW2bb7FGW2ÓÒt4ôÕÄUDTBr’°¢&Æö6¶W'2çW6‚†G·v÷&¶fÆ÷ròG·v÷&¶fÆ÷wÒò¢rwÒG¶æÖWÓ¢G·7FGW7Ö“°¢6öçF–çVS°¢Ð ¢–b‚FW&Ö–æÅ7FFRÇÂu$TTåô4„T4µõ5DDU2æ†2‡FW&Ö–æÅ7FFR’’°¢&Æö6¶W'2çW6‚†G·v÷&¶fÆ÷ròG·v÷&¶fÆ÷wÒò¢rwÒG¶æÖWÓ¢G·FW&Ö–æÅ7FFRÇÂuTä´äõtâwÖ“°¢Ð¢Ð ¢&WGW&â&Æö6¶W'3°§Ð ¦W‡÷'BgVæ7F–öâ&÷f–FW$Ö–çFVææ6T&ö÷G7G&6†V6µ&öÆÇW&Æö6¶W'2†6†V6·2’°¢6öç7B&Æö6¶W'2ÒµÓ° ¢f÷"†6öç7B6†V6²öb&÷f–FW$Ö–çFVææ6T&ö÷G7G&7V'7FçF—fT6†V6·2†6†V6·2’’°¢6öç7BæÖRÒ6†V6´æÖR†6†V6²’ÇÂwVææÖVBÖ6†V6²s°¢6öç7Bv÷&¶fÆ÷rÒ6†V6µv÷&¶fÆ÷r†6†V6²“°¢6öç7B7FGW2Ò7G&–ær†6†V6³òç7FGW2ÇÂrr’çFõWW$66R‚“°¢6öç7BFW&Ö–æÅ7FFRÒ7G&–ær†6†V6³òæ6öæ6ÇW6–öâÇÂ6†V6³òç7FFRÇÂrr’çFõWW$66R‚“° ¢–b‡7FGW2bb7FGW2ÓÒt4ôÕÄUDTBr’°¢&Æö6¶W'2çW6‚†G·v÷&¶fÆ÷ròG·v÷&¶fÆ÷wÒò¢rwÒG¶æÖWÓ¢G·7FGW7Ö“°¢6öçF–çVS°¢Ð ¢–b‚FW&Ö–æÅ7FFRÇÂu$TTåô4„T4µõ5DDU2æ†2‡FW&Ö–æÅ7FFR’’°¢&Æö6¶W'2çW6‚†G·v÷&¶fÆ÷ròG·v÷&¶fÆ÷wÒò¢rwÒG¶æÖWÓ¢G·FW&Ö–æÅ7FFRÇÂuTä´äõtâwÖ“°¢Ð¢Ð ¢&WGW&â&Æö6¶W'3°§Ð ¦W‡÷'BgVæ7F–öâ6•6æ6†÷DÖF6†W4†VB‡6æ6†÷D†VE6†ÂW‡V7FVD†VE6†’°¢6öç7B6æ6†÷BÒ6æöæ–6Å6†C‡6æ6†÷D†VE6†“°¢6öç7BW‡V7FVBÒ6æöæ–6Å6†C†W‡V7FVD†VE6†“°¢&WGW&â&ööÆVâ‡6æ6†÷BbbW‡V7FVBbb6æ6†÷BÓÓÒW‡V7FVB“°§Ð ¦W‡÷'BgVæ7F–öâ&Wf–WtvFU%7FFR‡"’°¢6öç7B7FFRÒ7G&–ær‡#òç7FFRÇÂrr’çFôÆ÷vW$66R‚“°¢–b‡7FFRÓÓÒv6Æ÷6VBr’&WGW&ât4Äõ4TBs°¢–b‡7FFRÓÒv÷VârÇÂG—Vöb#òæG&gBÓÒv&ööÆVâr’&WGW&ât”ådÄ”Bs°¢&WGW&â"æG&gBòtE$eBr¢u$Ud”Ut$ÄRs°§Ð ¦gVæ7F–öâ6ÖU7G&–æu6WB†7GVÂÂW‡V7FVB’°¢–b‚'&’æ—4'&’†7GVÂ’ÇÂ7GVÂæÆVæwF‚ÓÒW‡V7FVBæÆVæwF‚’&WGW&âfÇ6S°¢–b†7GVÂç6öÖR‚‡fÇVR’ÓâG—VöbfÇVRÓÒw7G&–ærrÇÂfÇVRÓÒfÇVRçG&–Ò‚’ÇÂfÇVR’’&WGW&âfÇ6S°¢&WGW&â¥4ôâç7G&–æv–g’…²ââæ7GVÅÒç6÷'B‚’’ÓÓÒ¥4ôâç7G&–æv–g’…²ââæW‡V7FVEÒç6÷'B‚’“°§Ð ¦W‡÷'BgVæ7F–öâfÆ–FFU&÷f–FW$Ö–çFVææ6T&ö÷G7G&WF†÷&—G’†Öæ–fW7B’°¢–b‚Öæ–fW7BÇÂG—VöbÖæ–fW7BÓÒvö&¦V7BrÇÂ'&’æ—4'&’†Öæ–fW7B’’&WGW&âçVÆÃ°¢6öç7B&ö÷G7G&ÒÖæ–fW7Bç&÷f–FW$Ö–çFVææ6T&ö÷G7G&°¢–b‚&ö÷G7G&ÇÂG—Vöb&ö÷G7G&ÓÒvö&¦V7BrÇÂ'&’æ—4'&’†&ö÷G7G&’’&WGW&âçVÆÃ°¢–b‚6ÖU7G&–æu6WB„ö&¦V7Bæ¶W—2†&ö÷G7G&’Â$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ô´U•2’’&WGW&âçVÆÃ°¢–b†Öæ–fW7Bç66†VÖfW'6–öâÓÒwÆFf÷&Ò×cræ6öæ7W'&VçB×66÷Rçcr’&WGW&âçVÆÃ°¢–b†Öæ–fW7Bç7FGW2ÓÒv7F—fRr’&WGW&âçVÆÃ°¢–b†Öæ–fW7Bæ'&æ6‚ÓÒvf—‚öÆö6Â×vVâÖWf–FVæ6RÖ&–æF–ærÓ##c“2r’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æVæ&ÆVBÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æWF†÷&—G”Öæ–fW7EF‚ÓÒ$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ôÔä”dU5EõD‚’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æ–×ÆVÖVçFF–öä'&æ6‚ÓÒÖæ–fW7Bæ'&æ6‚’&WGW&âçVÆÃ°¢–b†&ö÷G7G&ç&÷f–FW%v÷&¶fÆ÷uF‚ÓÒÄô4ÅõtTåõtõ$´dÄõuõD‚’&WGW&âçVÆÃ°¢–b†&ö÷G7G&ç&÷f–FW%7FGW46öçFW‡BÓÒÄô4ÅõtTåõ5DEU5ô4ôåDU…B’&WGW&âçVÆÃ°¢–b†&ö÷G7G&çfW&–f–W%F‚ÓÒ$õd”DU%ôÔ”åDTää4UõdU$”d”U%õD‚’&WGW&âçVÆÃ°¢–b†&ö÷G7G&çfW&–f–W%FW7EF‚ÓÒ$õd”DU%ôÔ”åDTää4UõdU$”d”U%õDU5EõD‚’&WGW&âçVÆÃ°¢–b‚6ÖU7G&–æu6WB†&ö÷G7G&æÆÆ÷vVD–×ÆVÖVçFF–öåF‡2Â$õd”DU%ôÔ”åDTää4UôÄÄõtTEõD…2’’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æWF†÷&—G•6÷W&6RÓÒtÔU$tTEôÄ•dUôÔ”åôôäÅ’r’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æWF†÷&—G”×W7D&Tæ6W7F÷$öd–×ÆVÖVçFF–öä†VBÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æ–×ÆVÖVçFF–öä×W7D&Tf÷'v&E7–æ6‡&öæ—¦VEFôÆ—fTÖ–âÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æ÷væW$W†7D†VE6VÆdVF—E&WV—&VBÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æÆÄ÷F†W%&WV—&VD6†V6·5FW&Ö–æÄw&VVâÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&çVç&W6öÇfVE&Wf–WuF‡&VG5&WV—&VBÓÒ’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æ7F—fT6†ævW5&WVW7FVE&WV—&VBÓÒ’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æÆ—fTÖ–ä×W7DWVÄ–×ÆVÖVçFF–öä&6T&Vf÷&TÖW&vRÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&ævVæW&FVD–æFWVæFVçE&÷f–FW%74f÷&&–FFVâÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&ævVæW&FVE&÷f–FW%7V66W757FGW4f÷&&–FFVâÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&ç&öGV7EVÆÅ&WVW7G4VÆ–v–&ÆRÓÒfÇ6R’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æWF†÷&—G”Öæ–fW7E6VÆdÖöF–f–6F–öä'”–×ÆVÖVçFF–öäf÷&&–FFVâÓÒG'VR’&WGW&âçVÆÃ°¢–b†&ö÷G7G&æöäç”Ö—6ÖF6‚ÓÒtd”Åô4Äõ4TBr’&WGW&âçVÆÃ°¢–b†&ö÷G7G&ç&W7VÇD6Æ76–f–6F–öâÓÒ$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ô4Ä54”d”4D”ôâ’&WGW&âçVÆÃ° ¢òòF†RÖW&vVBÖæ–fW7B—2F†RfÆ–FF–öâVçfVÆ÷Râ'VçF–ÖR&ö÷G7G&×WFF–öâ—2–çFVçF–öæÆÇ’æ'&÷vW# ¢òòöæÇ’F†R&÷f–FW"v÷&¶fÆ÷rÖ’W6RäôäRWF†÷&—G’âfW&–f–W"÷FW7B&VÖ–â–æFWVæFVçB×&Wf–WrG'W7B&÷VæF&–W2à¢&WGW&âö&¦V7Bæg&VW¦R‡°¢–×ÆVÖVçFF–öä'&æ6ƒ¢&ö÷G7G&æ–×ÆVÖVçFF–öä'&æ6‚À¢ÆÆ÷vVD–×ÆVÖVçFF–öåF‡3¢ö&¦V7Bæg&VW¦R…¶&ö÷G7G&ç&÷f–FW%v÷&¶fÆ÷uF…Ò’À¢&W7VÇD6Æ76–f–6F–öã¢&ö÷G7G&ç&W7VÇD6Æ76–f–6F–öâÀ¢Ò“°§Ð ¦W‡÷'BgVæ7F–öâ'6U&÷f–FW$Ö–çFVææ6T&ö÷G7G&WF†÷&—G’‡&r’°¢–b‡G—Vöb&rÓÒw7G&–ærr’&WGW&âçVÆÃ°¢–b‡&ræ–æ6ÇVFW2‚uÇSr’’&WGW&âçVÆÃ°¢–b„'VffW"æ'—FTÆVæwF‚‡&rÂwWFc‚r’â$õd”DU%ôÔ”åDTää4UôUD„õ$•E•ôÔ…ô%•DU2’&WGW&âçVÆÃ°¢G'’°¢&WGW&âfÆ–FFU&÷f–FW$Ö–çFVææ6T&ö÷G7G&WF†÷&—G’„¥4ôâç'6R‡&r’“°¢Ò6F6‚°¢&WGW&âçVÆÃ°¢Ð§Ð ¦gVæ7F–öâÆöE&÷f–FW$Ö–çFVææ6T&ö÷G7G&WF†÷&—G’‚’°¢G'’°¢6öç7B&rÒ&VDf–ÆU7–æ2‡&W6öÇfR…$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ôÔä”dU5EõD‚’ÂwWFc‚r“°¢&WGW&â'6U&÷f–FW$Ö–çFVææ6T&ö÷G7G&WF†÷&—G’‡&r“°¢Ò6F6‚°¢&WGW&âçVÆÃ°¢Ð§Ð ¦W‡÷'BgVæ7F–öâ6VÆV7E&Wf–WtvFTFV6—6–öâ†WF†÷&—F–W2Â&ö÷G7G&VÆ–v–&ÆRÒfÇ6R’°¢6öç7B÷&FW&VBÒ°¢²t4ôDU‚rÂ&ööÆVâ†WF†÷&—F–W3òæ6öFW‚•ÒÀ¢²tt•D…T%ô4õ”ÄõBrÂ&ööÆVâ†WF†÷&—F–W3òæ6÷–Æ÷B•ÒÀ¢²tô5DõU2rÂ&ööÆVâ†WF†÷&—F–W3òæö7F÷W2•ÒÀ¢²tÄô4ÅõtTârÂ&ööÆVâ†WF†÷&—F–W3òæÆö6ÅvVâ•ÒÀ¢Ó°¢6öç7B&÷f–FW"Ò÷&FW&VBæf–æB‚…²Â&W6VçEÒ’Óâ&W6VçB“òå³ÒÇÂrs°¢–b‡&÷f–FW"’°¢&WGW&âö&¦V7Bæg&VW¦R‡°¢6Æ76–f–6F–öã¢”äDUTäDTåEõ$Ud”Uuô4Ä54”d”4D”ôâÀ¢&Wf–WtWF†÷&—G“¢&÷f–FW"À¢Ò“°¢Ð¢–b†&ö÷G7G&VÆ–v–&ÆRÓÓÒG'VR’°¢&WGW&âö&¦V7Bæg&VW¦R‡°¢6Æ76–f–6F–öã¢$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ô4Ä54”d”4D”ôâÀ¢&Wf–WtWF†÷&—G“¢täôäRrÀ¢Ò“°¢Ð¢&WGW&âçVÆÃ°§Ð ¦W‡÷'BgVæ7F–öâ&Wf–WtvFU&W7VÇDÖöFR‡fÇVRÂW‡V7FVD†VE6†Â–æFWVæFVçDöæÇ’ÒfÇ6R’°¢–b‚fÇVRÇÂG—VöbfÇVRÓÒvö&¦V7BrÇÂ'&’æ—4'&’‡fÇVR’’&WGW&ârs°¢–b‚6ÖU7G&–æu6WB„ö&¦V7Bæ¶W—2‡fÇVR’Â$Ud”UuôtDUõ$U5TÅEô´U•2’’&WGW&ârs°¢6öç7BW‡V7FVD†VBÒ6æöæ–6Å6†C†W‡V7FVD†VE6†“°¢–b‚W‡V7FVD†VBÇÂfÇVRæ†VBÓÒW‡V7FVD†VB’&WGW&ârs°¢–b‡fÇVRç66†VÖfW'6–öâÓÒ$Ud”UuôtDUõ$U5TÅEõ44„TÔÇÂfÇVRç7FGW2ÓÒu52r’&WGW&ârs°¢6öç7B&ö÷G7G&—"ÒfÇVRæ6Æ76–f–6F–öâÓÓÒ$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ô4Ä54”d”4D”ôà¢bbfÇVRç&Wf–WtWF†÷&—G’ÓÓÒtäôäRs°¢6öç7B–æFWVæFVçE—"ÒfÇVRæ6Æ76–f–6F–öâÓÓÒ”äDUTäDTåEõ$Ud”Uuô4Ä54”d”4D”ôà¢bb”äDUTäDTåEõ$Ud”UuôUD„õ$•D”U2æ†2‡fÇVRç&Wf–WtWF†÷&—G’“°¢–b†–æFWVæFVçE—"’&WGW&ât”äDUTäDTåBs°¢–b‚–æFWVæFVçDöæÇ’bb&ö÷G7G&—"’&WGW&ât$ôõE5E$s°¢&WGW&ârs°§Ð ¦W‡÷'BgVæ7F–öâ&Wf–WtvFU&W7VÇD6öçG&7B††VE6†ÂFV6—6–öâ’°¢6öç7B†VBÒ6æöæ–6Å6†C††VE6†“°¢–b‚†VBÇÂFV6—6–öâÇÂG—VöbFV6—6–öâÓÒvö&¦V7BrÇÂ'&’æ—4'&’†FV6—6–öâ’’&WGW&âçVÆÃ°¢6öç7B6öçG&7BÒö&¦V7Bæg&VW¦R‡°¢66†VÖfW'6–öã¢$Ud”UuôtDUõ$U5TÅEõ44„TÔÀ¢7FGW3¢u52rÀ¢†VBÀ¢6Æ76–f–6F–öã¢7G&–ær†FV6—6–öâæ6Æ76–f–6F–öâÇÂrr’À¢&Wf–WtWF†÷&—G“¢7G&–ær†FV6—6–öâç&Wf–WtWF†÷&—G’ÇÂrr’À¢Ò“°¢&WGW&â&Wf–WtvFU&W7VÇDÖöFR†6öçG&7BÂ†VB’ò6öçG&7B¢çVÆÃ°§Ð ¦gVæ7F–öâ'Väv‚†&w2’°¢&WGW&âW†V4f–ÆU7–æ2‚vv‚rÂ&w2Â°¢Væ6öF–æs¢wWFc‚rÀ¢Vçc¢&ö6W72æVçbÀ¢7FF–ó¢²v–væ÷&RrÂw—RrÂw—RuÒÀ¢Ò’çG&–Ò‚“°§Ð ¦gVæ7F–öâv„§6öâ†&w2’°¢6öç7B&rÒ'Väv‚†&w2“°¢&WGW&â&rò¥4ôâç'6R‡&r’¢çVÆÃ°§Ð ¦W‡÷'BgVæ7F–öâö7F÷W47F–öç5'VåW&Â‡&WòÂ'Vä–B’°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢6öç7B–BÒ7G&–ær‡'Vä–BÇÂrr’çG&–Ò‚“°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’’&WGW&ârs°¢–b‚õå³Ó•Õ³Ó•×³Ã—ÒB÷RçFW7B†–B’’&WGW&ârs°¢&WGW&â‡GG3¢òö’æv—F‡V"æ6öÒ÷&W÷2òG·&W÷6—F÷'—Òö7F–öç2÷'Vç2òG¶–GÖ°§Ð ¦gVæ7F–öâfWF6…V&Æ–47F–öç5'Vâ‡&WòÂ'Vä–B’°¢6öç7BW&ÂÒö7F÷W47F–öç5'VåW&Â‡&WòÂ'Vä–B“°¢–b‚W&Â’F‡&÷ræWrW'&÷"‚t–çfÆ–Bö7F÷W27F–öç2'Vâ–FVçF—G’âr“° ¢6öç7BVçbÒ²ââç&ö6W72æVçbÓ°¢FVÆWFRVçbät…õDô´Tã°¢FVÆWFRVçbät•D…T%õDô´Tã°¢FVÆWFRVçbät•D…T%ôUD…õDô´Tã°¢6öç7B&rÒW†V4f–ÆU7–æ2‚v7W&ÂrÂ°¢rÒÖF—6&ÆRrÀ¢rÒÖf–ÂrÀ¢rÒ×6–ÆVçBrÀ¢rÒ×6†÷rÖW'&÷"rÀ¢rÒ×&÷FòrÂsÖ‡GG2rÀ¢rÒÖ6öææV7B×F–ÖV÷WBrÂsrÀ¢rÒÖÖ‚×F–ÖRrÂs#rÀ¢rÒ×&WG'’rÂs"rÀ¢rÒ×&WG'’ÖFVÆ’rÂsrÀ¢rÒ×&WG'’ÖÖ‚×F–ÖRrÂs#RrÀ¢rÒ×&WG'’ÖÆÂÖW'&÷'2rÀ¢rÔ‚rÂt66WC¢Æ–6F–öâ÷fæBæv—F‡V"¶§6öârÀ¢rÔ‚rÂu‚Ôv—D‡V"Ô’ÕfW'6–öã¢##"ÓÓ#‚rÀ¢rÔ‚rÂuW6W"ÔvVçC¢ÆFf÷&Ò×crÖW†7BÖ†VB×&Wf–WrÖvFRrÀ¢W&ÂÀ¢ÒÂ°¢Væ6öF–æs¢wWFc‚rÀ¢VçbÀ¢7FF–ó¢²v–væ÷&RrÂw—RrÂw—RuÒÀ¢Ò’çG&–Ò‚“°¢&WGW&â&rò¥4ôâç'6R‡&r’¢çVÆÃ°§Ð ¦gVæ7F–öâfWF6…V&Æ–4ö7F÷W47F–öç5'Vâ‡&WòÂ'Vä–B’°¢&WGW&âfWF6…V&Æ–47F–öç5'Vâ‡&WòÂ'Vä–B“°§Ð ¦gVæ7F–öâfWF6…V&Æ–4Æö6ÅvVä7F–öç5'Vâ‡&WòÂ'Vä–B’°¢&WGW&âfWF6…V&Æ–47F–öç5'Vâ‡&WòÂ'Vä–B“°§Ð ¦gVæ7F–öâfWF6„ÆÅ&Wf–Ww2‡&WòÂ$çVÖ&W"’°¢6öç7BvW2Òv„§6öâ…°¢v’rÀ¢rÒ×v–æFRrÀ¢rÒ×6ÇW'rÀ¢&W÷2òG·&W÷Ò÷VÆÇ2òG·$çVÖ&W'Ò÷&Wf–Ww3÷W%÷vSÓÀ¢Ò’ÇÂµÓ°¢&WGW&âvW2æfÆDÖ‚‡vR’Óâ'&’æ—4'&’‡vR’òvR¢µÒ“°§Ð ¦gVæ7F–öâfWF6„ÆÄ—77VT6öÖÖVçG2‡&WòÂ$çVÖ&W"’°¢6öç7BvW2Òv„§6öâ…°¢v’rÀ¢rÒ×v–æFRrÀ¢rÒ×6ÇW'rÀ¢&W÷2òG·&W÷Òö—77VW2òG·$çVÖ&W'Òö6öÖÖVçG3÷W%÷vSÓÀ¢Ò’ÇÂµÓ°¢&WGW&âvW2æfÆDÖ‚‡vR’Óâ'&’æ—4'&’‡vR’òvR¢µÒ“°§Ð ¦gVæ7F–öâfWF6„ÆÄ6öÖÖ—E7FGW6W2‡&WòÂ†VE6†’°¢6öç7BvW2Òv„§6öâ…°¢v’rÀ¢rÒ×v–æFRrÀ¢rÒ×6ÇW'rÀ¢&W÷2òG·&W÷Òö6öÖÖ—G2òG¶†VE6†Ò÷7FGW6W3÷W%÷vSÓÀ¢Ò’ÇÂµÓ°¢&WGW&âvW2æfÆDÖ‚‡vR’Óâ'&’æ—4'&’‡vR’òvR¢µÒ“°§Ð ¦gVæ7F–öâ&W6öÇfT6öÖÖ—E6†‡&WòÂ&Vb’°¢6öç7B&Vf—‚Ò7G&–ær‡&VbÇÂrr’çG&–Ò‚“°¢–b‚õå³Ó–Öe×³ÃCÒB÷RçFW7B‡&Vf—‚’’&WGW&ârs°¢6öç7B6öÖÖ—BÒv„§6öâ…²v’rÂ&W÷2òG·&W÷Òö6öÖÖ—G2òG·&Vf—‡ÖÒ“°¢6öç7B6†Ò6æöæ–6Å6†C†6öÖÖ—Còç6†“°¢&WGW&âõå³Ó–Öe×³CÒB÷RçFW7B‡6†’bb6†ç7F'G5v—F‚‡&Vf—‚’ò6†¢rs°§Ð ¦gVæ7F–öâfWF6„ÆÅ&Wf–WuF‡&VG2‡&WòÂ$çVÖ&W"’°¢6öç7B¶÷væW"ÂæÖUÒÒ7G&–ær‡&Wò’ç7Æ—B‚ròr“°¢–b‚÷væW"ÇÂæÖR’F‡&÷ræWrW'&÷"†–çfÆ–B&W÷6—F÷'’æÖS¢G·&W÷Ö“° ¢6öç7BVW'’Ò ¢VW'’‚F÷væW#¢7G&–ærÂFæÖS¢7G&–ærÂFçVÖ&W#¢–çBÂFVæD7W'6÷#¢7G&–ær’°¢&W÷6—F÷'’†÷væW#¢F÷væW"ÂæÖS¢FæÖR’°¢VÆÅ&WVW7B†çVÖ&W#¢FçVÖ&W"’°¢&Wf–WuF‡&VG2†f—'7C¢ÂgFW#¢FVæD7W'6÷"’°¢æöFW2°¢—5&W6öÇfV@¢—4÷WFFFV@¢F€¢Æ–æP¢6öÖÖVçG2†f—'7C¢’°¢æöFW2°¢WF†÷"²Æöv–âÐ¢&öG¢Ð¢Ð¢Ð¢vT–æfò°¢†4æW‡EvP¢VæD7W'6÷ ¢Ð¢Ð¢Ð¢Ð¢Ð¢° ¢6öç7BvW2Òv„§6öâ…°¢v’rÀ¢vw&‡ÂrÀ¢rÒ×v–æFRrÀ¢rÒ×6ÇW'rÀ¢rÖbrÂVW'“ÒG·VW'—ÖÀ¢rÖbrÂ÷væW#ÒG¶÷væW'ÖÀ¢rÖbrÂæÖSÒG¶æÖWÖÀ¢rÔbrÂçVÖ&W#ÒG·$çVÖ&W'ÖÀ¢Ò’ÇÂµÓ° ¢&WGW&âvW2æfÆDÖ‚‡vR’ÓâvSòæFFòç&W÷6—F÷'“òçVÆÅ&WVW7Còç&Wf–WuF‡&VG3òææöFW2ÇÂµÒ“°§Ð ¦gVæ7F–öâfWF6„6†V6µ6æ6†÷B‡&WòÂ$çVÖ&W"’°¢6öç7B&W÷6—F÷'’Ò7G&–ær‡&WòÇÂrr’çG&–Ò‚“°¢–b‚—4v—D‡V%&W÷6—F÷'•6ÇVr‡&W÷6—F÷'’’’°¢&WGW&â°¢†VE6†¢rrÀ¢†VE&Vc¢rrÀ¢6†V6·3¢µÒÀ¢6æöæ–6Æ—¦F–öäW'&÷'3¢²w&W÷6—F÷'’Ö–çfÆ–BuÒÀ¢Ó°¢Ð ¢6öç7BfÇVRÒv„§6öâ…°¢w"rÀ¢wf–WrrÀ¢7G&–ær‡$çVÖ&W"’À¢rÒ×&WòrÀ¢&W÷6—F÷'’À¢rÒÖ§6öârÀ¢v†VE&VdæÖRÆ†VE&Vdö–BÇ7FGW46†V6µ&öÆÇWrÀ¢Ò“°¢6öç7B†VE6†Ò6æöæ–6Å6†C‡fÇVSòæ†VE&Vdö–B“°¢6öç7B†VE&VbÒ7G&–7DæöäV×G•7G&–ær‡fÇVSòæ†VE&VdæÖR“°¢6öç7B&t6†V6·2Ò'&’æ—4'&’‡fÇVSòç7FGW46†V6µ&öÆÇW’òfÇVRç7FGW46†V6µ&öÆÇW¢µÓ°¢6öç7B'Vä–G2ÒæWr6WB‚“°¢f÷"†6öç7B6†V6²öb&t6†V6·2’°¢–b‚6†V6µv÷&¶fÆ÷r†6†V6²’’6öçF–çVS°¢6öç7B'Vä–BÒ7F–öç5'Vä–Dg&öÔ6†V6²†6†V6²Â&W÷6—F÷'’“°¢–b‡'Vä–B’'Vä–G2æFB‡'Vä–B“°¢Ð ¢6öç7B7F–öç5'Vç2ÒµÓ°¢f÷"†6öç7B'Vä–Böb'Vä–G2’°¢6öç7B'Vä•F‚Ò7F–öç5'Vä•F‚‡&W÷6—F÷'’Â'Vä–B“°¢–b‚'Vä•F‚’6öçF–çVS°¢G'’°¢6öç7B'VâÒv„§6öâ…²v’rÂ'Vä•F…Ò“°¢–b‡'Vâ’7F–öç5'Vç2çW6‚‡'Vâ“°¢Ò6F6‚°¢òòÖ—76–ær'VâÖWFFF—2æ÷B–væ÷&VBâ6æöæ–6Æ—¦F–öâ&VÆ÷r6öçfW'G2—BFò&Æö6¶–ærW'&÷"à¢Ð¢Ð¢6öç7B6æöæ–6ÂÒ6æöæ–6Æ—¦TW†7E$†VD7F–öç46†V6·2‡&t6†V6·2Â7F–öç5'Vç2Â†VE6†Â†VE&VbÂ&W÷6—F÷'’“° ¢&WGW&â°¢†VE6†À¢†VE&VbÀ¢6†V6·3¢6æöæ–6Âæ6†V6·2À¢6æöæ–6Æ—¦F–öäW'&÷'3¢6æöæ–6ÂæW'&÷'2À¢Ó°§Ð ¦gVæ7F–öâfWF6„Æ—fU$†VB‡&WòÂ$çVÖ&W"’°¢6öç7B"Òv„§6öâ…²v’rÂ&W÷2òG·&W÷Ò÷VÆÇ2òG·$çVÖ&W'ÖÒ“°¢&WGW&â6æöæ–6Å6†C‡#òæ†VCòç6†“°§Ð ¦gVæ7F–öâfWF6„Æ—fTÖ–å6†‡&Wò’°¢6öç7B'&æ6‚Òv„§6öâ…²v’rÂ&W÷2òG·&W÷Òö'&æ6†W2öÖ–æÒ“°¢&WGW&â6æöæ–6Å6†C†'&æ6ƒòæ6öÖÖ—Còç6†“°§Ð ¦gVæ7F–öâG'W7FVD6†V6¶÷WE6†‚’°¢G'’°¢6öç7B6†ÒW†V4f–ÆU7–æ2‚vv—BrÂ²w&Wb×'6RrÂt„TBuÒÂ°¢Væ6öF–æs¢wWFc‚rÀ¢7FF–ó¢²v–væ÷&RrÂw—RrÂw—RuÒÀ¢Ò’çG&–Ò‚“°¢&WGW&â6æöæ–6Å6†C‡6†“°¢Ò6F6‚°¢&WGW&ârs°¢Ð§Ð ¦gVæ7F–öâ&÷f–FW$Ö–çFVææ6T&ö÷G7G&FV6—6–öâ‡&WòÂ"Â†VE6†Â&Wf–Ww2’°¢6öç7BÆ—fTÖ–å6†ÒfWF6„Æ—fTÖ–å6†‡&Wò“°¢–b‚Æ—fTÖ–å6†’&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢vÆ—fRÖÖ–â×Væf–Æ&ÆRrÓ°¢–b‡G'W7FVD6†V6¶÷WE6†‚’ÓÒÆ—fTÖ–å6†’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢wG'W7FVBÖÖ–âÖÖ÷fVBrÓ°¢Ð ¢6öç7B&ö÷G7G&ÒÆöE&÷f–FW$Ö–çFVææ6T&ö÷G7G&WF†÷&—G’‚“°¢–b‚&ö÷G7G&’&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢vWF†÷&—G’Ö–çfÆ–BrÓ°¢–b…7G&–ær‡#òæ†VCòç&VbÇÂrr’ÓÒ&ö÷G7G&æ–×ÆVÖVçFF–öä'&æ6‚’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v'&æ6‚ÖÖ—6ÖF6‚rÓ°¢Ð¢–b…7G&–ær‡#òæ†VCòç&WóòægVÆÅöæÖRÇÂrr’ÓÒ&Wò’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v†VB×&W÷6—F÷'’ÖÖ—6ÖF6‚rÓ°¢Ð¢–b…7G&–ær‡#òæ&6Sòç&VbÇÂrr’ÓÒvÖ–âr’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v&6R×&VbÖÖ—6ÖF6‚rÓ°¢Ð¢–b†W†7D†VE&÷f–FW$&Æö6¶–ætWf–FVæ6R‡&Wf–Ww2Â†VE6†’æÆVæwF‚â’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢vW‡Æ–6—B×&÷f–FW"Ö&Æö6²rÓ°¢Ð ¢ÆWB6ö×&—6öã°¢G'’°¢6ö×&—6öâÒv„§6öâ…²v’rÂ&W÷2òG·&W÷Òö6ö×&RòG¶Æ—fTÖ–å6†ÒâââG¶†VE6†ÖÒ“°¢Ò6F6‚°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v6ö×&R×Væf–Æ&ÆRrÓ°¢Ð¢–b‚6ö×&—6öâÇÂ6ö×&—6öâç7FGW2ÓÒv†VBr’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢væ÷BÖf÷'v&BÖöæÇ’Ö†VBrÓ°¢Ð¢–b„çVÖ&W"†6ö×&—6öâæ&V†–æEö'’’ÓÒÇÂçVÖ&W"†6ö×&—6öâæ†VEö'’’Â’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢vÖ–â×7–æ6‡&öæ—¦F–öâÖÖ—6ÖF6‚rÓ°¢Ð¢–b†6æöæ–6Å6†C†6ö×&—6öãòæÖW&vUö&6Uö6öÖÖ—Còç6†’ÓÒÆ—fTÖ–å6†’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢vWF†÷&—G’Öæ÷BÖÆ—fRÖÖ–âÖæ6W7F÷"rÓ°¢Ð¢6öç7Bf–ÆW2Ò'&’æ—4'&’†6ö×&—6öâæf–ÆW2’ò6ö×&—6öâæf–ÆW2¢µÓ°¢–b†f–ÆW2æÆVæwF‚ÂÇÂf–ÆW2æÆVæwF‚â&ö÷G7G&æÆÆ÷vVD–×ÆVÖVçFF–öåF‡2æÆVæwF‚’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v6†ævVBÖf–ÆRÖ6÷VçBÖ–çfÆ–BrÓ°¢Ð¢6öç7BÆÆ÷vVBÒæWr6WB†&ö÷G7G&æÆÆ÷vVD–×ÆVÖVçFF–öåF‡2“°¢6öç7B6VVâÒæWr6WB‚“°¢f÷"†6öç7Bf–ÆRöbf–ÆW2’°¢6öç7Bf–ÆVæÖRÒ7G&–ær†f–ÆSòæf–ÆVæÖRÇÂrr’çG&–Ò‚“°¢–b‚ÆÆ÷vVBæ†2†f–ÆVæÖR’ÇÂ6VVâæ†2†f–ÆVæÖR’’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢66÷R×f–öÆF–öã¢G¶f–ÆVæÖRÇÂvÖ—76–ærwÖÓ°¢Ð¢–b…7G&–ær†f–ÆSòç7FGW2ÇÂrr’ÓÒvÖöF–f–VBr’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢f–ÆR×7FGW2Ö–çfÆ–C¢G¶f–ÆVæÖWÖÓ°¢Ð¢6VVâæFB†f–ÆVæÖR“°¢Ð¢–b‡6VVâæ†2…$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ôÔä”dU5EõD‚’’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢vWF†÷&—G’×6VÆbÖÖöF–f–6F–öârÓ°¢Ð ¢6öç7B6æ6†÷BÒfWF6„6†V6µ6æ6†÷B‡&WòÂçVÖ&W"‡#òæçVÖ&W"ÇÂ’“°¢–b‚6•6æ6†÷DÖF6†W4†VB‡6æ6†÷Bæ†VE6†Â†VE6†’’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v6’Ö†VBÖÖ—6ÖF6‚rÓ°¢Ð¢–b‡6æ6†÷Bæ†VE&VbÓÒ7G&–ær‡#òæ†VCòç&VbÇÂrr’’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v6’Ö†VB×&VbÖÖ—6ÖF6‚rÓ°¢Ð¢–b‡6æ6†÷Bæ6æöæ–6Æ—¦F–öäW'&÷'2æÆVæwF‚â’°¢&WGW&â°¢VÆ–v–&ÆS¢fÇ6RÀ¢&V6öã¢6’×6æ6†÷BÖ–çfÆ–C¢G·6æ6†÷Bæ6æöæ–6Æ—¦F–öäW'&÷'2ç6Æ–6RƒÂ’æ¦ö–â‚rÂr—ÖÀ¢Ó°¢Ð¢6öç7Bö'6W'fVBÒ&÷f–FW$Ö–çFVææ6T&ö÷G7G&7V'7FçF—fT6†V6·2‡6æ6†÷Bæ6†V6·2“°¢–b†ö'6W'fVBæÆVæwF‚ÓÓÒ’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v6’ÖWf–FVæ6RÖÖ—76–ærrÓ°¢Ð¢6öç7B&Æö6¶W'2Ò&÷f–FW$Ö–çFVææ6T&ö÷G7G&6†V6µ&öÆÇW&Æö6¶W'2‡6æ6†÷Bæ6†V6·2“°¢–b†&Æö6¶W'2æÆVæwF‚â’°¢&WGW&â²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢6’Öæ÷BÖw&VVã¢G¶&Æö6¶W'2ç6Æ–6RƒÂ’æ¦ö–â‚rÂr—ÖÓ°¢Ð ¢&WGW&â°¢VÆ–v–&ÆS¢G'VRÀ¢&V6öã¢vVÆ–v–&ÆRrÀ¢6Æ76–f–6F–öã¢&ö÷G7G&ç&W7VÇD6Æ76–f–6F–öâÀ¢6”6†V6·3¢ö'6W'fVBæÆVæwF‚À¢Æ—fTÖ–å6†À¢Ó°§Ð ¦gVæ7F–öâf–Â†6öFRÂÖW76vR’°¢6öç6öÆRæW'&÷"†G¶6öFWÓ¢G¶ÖW76vWÖ“°¢&ö6W72æW†—Bƒ“°§Ð ¦gVæ7F–öâÖ–â‚’°¢6öç7B&WòÒ&ö6W72æVçbå$UòÇÂ&ö6W72æVçbät•D…T%õ$Uõ4•Dõ%’ÇÂrs°¢6öç7B$çVÖ&W"ÒçVÖ&W"‡&ö6W72æVçbå%ôåTÔ$U"ÇÂ“°¢6öç7BW‡V7FVD†VD–çWBÒ7G&–ær‡&ö6W72æVçbä„TEõ4„ÇÂrr’çG&–Ò‚“°¢6öç7BW‡V7FVD†VBÒW‡V7FVD†VD–çWC°¢6öç7B&WV—&Tw&VVä6’Ò&ö6W72æVçbå$UT•$Uôu$TTåô4’ÓÓÒss° ¢–b‚&Wò’f–Â‚u$Ud”UuôtDUõ$UõôÔ•54”ärrÂu$Uòôt•D…T%õ$Uõ4•Dõ%’—2&WV—&VBâr“°¢–b‚çVÖ&W"æ—4–çFVvW"‡$çVÖ&W"’ÇÂ$çVÖ&W"ÃÒ’f–Â‚u$Ud”UuôtDUõ%ôÔ•54”ärrÂu%ôåTÔ$U"×W7B&R÷6—F—fR–çFVvW"âr“° ¢6öç7B¶÷væW$Æöv–åÒÒ7G&–ær‡&Wò’ç7Æ—B‚ròr“°¢–b‚÷væW$Æöv–â’f–Â‚u$Ud”UuôtDUôõtäU%ôÔ•54”ärrÂVæ&ÆRFò&W6öÇfR&W÷6—F÷'’÷væW"g&öÒG·&W÷Òæ“° ¢6öç7B"Òv„§6öâ…²v’rÂ&W÷2òG·&W÷Ò÷VÆÇ2òG·$çVÖ&W'ÖÒ“°¢–b‚"’f–Â‚u$Ud”UuôtDUõ%õTäd”Ä$ÄRrÂVæ&ÆRFò&VB"2G·$çVÖ&W'Òæ“° ¢6öç7B%7FFRÒ&Wf–WtvFU%7FFR‡"“°¢–b‡%7FFRÓÓÒt”ådÄ”Br’°¢f–Â‚u$Ud”UuôtDUõ%õ5DDUô”ådÄ”BrÂ"2G·$çVÖ&W'Ò†2â–æ6ö×ÆWFR÷"Vç7W÷'FVBÆ—fR7FFRæ“°¢Ð¢–b‡%7FFRÓÓÒt4Äõ4TBr’°¢6öç6öÆRæÆör†%õ$Ud”UuôtDSÕ4´•ô4Äõ4TB#ÒG·$çVÖ&W'Ö“°¢&WGW&ã°¢Ð¢–b‡%7FFRÓÓÒtE$eBr’°¢f–Â‚u$Ud”UuôtDUôE$eBrÂG&gB"2G·$çVÖ&W'Ò6ææ÷B6F—6g’W†7BÖ†VB&Wf–WrWF†÷&—G’æ“°¢Ð ¢6öç7B†VE6†–çWBÒ7G&–ær‡#òæ†VCòç6†ÇÂrr’çG&–Ò‚“°¢–b‚õå³Ó–Öe×³CÒB÷RçFW7B††VE6†–çWB’’°¢f–Â‚u$Ud”UuôtDUô„TEô”ådÄ”BrÂ–çfÆ–B"†VB4„f÷"2G·$çVÖ&W'Òæ“°¢Ð¢6öç7B†VE6†Ò†VE6†–çWC°¢–b†W‡V7FVD†VD–çWBbbõå³Ó–Öe×³CÒB÷RçFW7B†W‡V7FVD†VD–çWB’’°¢f–Â‚u$Ud”UuôtDUôU…T5DTEô„TEô”ådÄ”BrÂt„TEõ4„×W7B&R6æöæ–6ÂÆ÷vW&66R4„ÓCâr“°¢Ð¢–b†W‡V7FVD†VBbbW‡V7FVD†VBÓÒ†VE6†’°¢f–Â‚u$Ud”UuôtDUô„TEôÔõdTBrÂW‡V7FVBG¶W‡V7FVD†VGÒÂ7W'&VçB†VB—2G¶†VE6†Òæ“°¢Ð ¢6öç7B&Wf–Ww2ÒfWF6„ÆÅ&Wf–Ww2‡&WòÂ$çVÖ&W"“°¢6öç7B6öÖÖVçG2ÒfWF6„ÆÄ—77VT6öÖÖVçG2‡&WòÂ$çVÖ&W"“°¢6öç7B6öÖÖ—E7FGW6W2ÒfWF6„ÆÄ6öÖÖ—E7FGW6W2‡&WòÂ†VE6†“° ¢6öç7B÷6—F—fT6öFW…&Wf–Ww2Ò÷6—F—fTW†7D†VD6öFW…&Wf–Ww2‡&Wf–Ww2Â†VE6†“°¢6öç7B6ÆVå&Vf—†W2Ò6ÆVä6öFW…&Wf–Wu&Vf—†W2†6öÖÖVçG2“°¢ÆWBW†7D6ÆVä6öFW„6öÖÖVçG2Ò°¢f÷"†6öç7B&Vf—‚öb6ÆVå&Vf—†W2’°¢G'’°¢–b‡&W6öÇfT6öÖÖ—E6†‡&WòÂ&Vf—‚’ÓÓÒ†VE6†’W†7D6ÆVä6öFW„6öÖÖVçG2³Ò°¢Ò6F6‚°¢òò–væ÷&R7FÆR÷"æòÖÆöævW"×&W6öÇf&ÆR&Wf–WvVBÖ6öÖÖ—B&Vf—†W2à¢Ð¢Ð¢6öç7B6öFW„WF†÷&—G’Ò÷6—F—fT6öFW…&Wf–Ww2æÆVæwF‚âÇÂW†7D6ÆVä6öFW„6öÖÖVçG2â° ¢6öç7B÷6—F—fT6÷–Æ÷E&Wf–Ww2Ò÷6—F—fTW†7D†VD6÷–Æ÷E&Wf–Ww2‡&Wf–Ww2Â†VE6†“°¢6öç7B6÷–Æ÷DWF†÷&—G’Ò÷6—F—fT6÷–Æ÷E&Wf–Ww2æÆVæwF‚â° ¢6öç7B÷6—F—fTö7F÷W4GFW7FF–öç2Ò÷6—F—fTW†7D†VDö7F÷W4GFW7FF–öç2€¢&Wf–Ww2À¢6öÖÖ—E7FGW6W2À¢†VE6†À¢&WòÀ¢“°¢6öç7Bv÷&¶fÆ÷t&÷VæDö7F÷W4GFW7FF–öç2Ò÷6—F—fTö7F÷W4GFW7FF–öç2æf–ÇFW"‚†GFW7FF–öâ’Óâ°¢G'’°¢6öç7B'VâÒfWF6…V&Æ–4ö7F÷W47F–öç5'Vâ‡&WòÂGFW7FF–öâç'Vä–B“°¢&WGW&âö7F÷W4GFW7FF–öäÖF6†W5v÷&¶fÆ÷u'Vâ†GFW7FF–öâÂ'VâÂ&WòÂ$çVÖ&W"Â†VE6†“°¢Ò6F6‚°¢&WGW&âfÇ6S°¢Ð¢Ò“°¢6öç7Bö7F÷W4WF†÷&—G’Òv÷&¶fÆ÷t&÷VæDö7F÷W4GFW7FF–öç2æÆVæwF‚â° ¢6öç7B÷6—F—fTÆö6ÅvVäGFW7FF–öç2Ò÷6—F—fTW†7D†VDÆö6ÅvVäGFW7FF–öç2€¢&Wf–Ww2À¢6öÖÖ—E7FGW6W2À¢†VE6†À¢&WòÀ¢“°¢6öç7Bv÷&¶fÆ÷t&÷VæDÆö6ÅvVäGFW7FF–öç2Ò÷6—F—fTÆö6ÅvVäGFW7FF–öç2æf–ÇFW"‚†GFW7FF–öâÂ’Óâ°¢G'’°¢6öç7B'VâÒfWF6…V&Æ–4Æö6ÅvVä7F–öç5'Vâ‡&WòÂGFW7FF–öâç'Vä–B“°¢&WGW&âÆö6ÅvVäGFW7FF–öäÖF6†W5v÷&¶fÆ÷u'Vâ†GFW7FF–öâÂ'VâÂ&WòÂ$çVÖ&W"Â†VE6†“°¢Ò6F6‚°¢&WGW&âfÇ6S°¢Ð¢Ò“°¢6öç7BÆö6ÅvVäWF†÷&—G’Òv÷&¶fÆ÷t&÷VæDÆö6ÅvVäGFW7FF–öç2æÆVæwF‚â°¢6öç7BWF†÷&—F–W2Ò°¢6öFWƒ¢6öFW„WF†÷&—G’À¢6÷–Æ÷C¢6÷–Æ÷DWF†÷&—G’À¢ö7F÷W3¢ö7F÷W4WF†÷&—G’À¢Æö6ÅvVã¢Æö6ÅvVäWF†÷&—G’À¢Ó° ¢ÆWBWF†÷&—G”FV6—6–öâÒ6VÆV7E&Wf–WtvFTFV6—6–öâ†WF†÷&—F–W2ÂfÇ6R“°¢ÆWB&ö÷G7G&Ò²VÆ–v–&ÆS¢fÇ6RÂ&V6öã¢v–æFWVæFVçBÖWF†÷&—G’×&W6VçBrÂ6”6†V6·3¢Ó°¢–b‚WF†÷&—G”FV6—6–öâ’°¢&ö÷G7G&Ò&÷f–FW$Ö–çFVææ6T&ö÷G7G&FV6—6–öâ‡&WòÂ"Â†VE6†Â&Wf–Ww2“°¢–b‚&ö÷G7G&æVÆ–v–&ÆR’°¢f–Â€¢u$Ud”UuôtDUô”äDUTäDTåEôU„5Eô„TEôÔ•54”ärrÀ¢tæòvVçV–æR–æFWVæFVçB&Wf–WrWF†÷&—G’—2&÷VæBFòW†7B†VBp¢²†VE6†¢²s²66WFVB&÷f–FW'2&R6öFW‚6ÆVâö&÷fVB&Wf–WrÂv—D‡V"6÷–Æ÷BW†7BÖ†VB6öFR&Wf–WrÂö7F÷W2W†7BÖ†VB6ÆVâGFW7FF–öâÇW2ÖF6†–ær&÷f–FW"7FGW2Â÷"Æö6ÂvVâW†7BÖ†VB6ÆVâGFW7FF–öâÇW2ÖF6†–ær&÷f–FW"7FGW2æBG'W7FVB7F–öç2'Vââp¢²uF†R6÷W&6RÖ6öçG&öÆÆVB&÷f–FW"ÖÖ–çFVææ6R&ö÷G7G&—2æ÷BVÆ–v–&ÆS¢p¢²&ö÷G7G&ç&V6öà¢²rârÀ¢“°¢Ð¢WF†÷&—G”FV6—6–öâÒ6VÆV7E&Wf–WtvFTFV6—6–öâ†WF†÷&—F–W2ÂG'VR“°¢Ð¢–b‚WF†÷&—G”FV6—6–öâ’°¢f–Â‚u$Ud”UuôtDUôUD„õ$•E•ôDT4•4”ôåô”ådÄ”BrÂuVæ&ÆRFò&öGV6Rf–ÂÖ6Æ÷6VB&Wf–WrWF†÷&—G’FV6—6–öââr“°¢Ð ¢6öç7B÷væW%6VÆdVF—G2ÒW†7D†VD÷væW%6VÆdVF—G2†6öÖÖVçG2Â÷væW$Æöv–âÂ†VE6†“°¢–b†÷væW%6VÆdVF—G2æÆVæwF‚ÓÓÒ’°¢f–Â€¢u$Ud”UuôtDUôõtäU%õ4TÄeôTD•EôÔ•54”ärrÀ¢æò&W÷6—F÷'’Ö÷væW"6VÆbÖVF—B52GFW7FF–öâ—2&÷VæBFòW†7B†VBG¶†VE6†ÒæÀ¢“°¢Ð ¢6öç7B&Æö6¶–æu&Wf–Ww2ÒÆFW7D&Æö6¶–æt6†ævU&WVW7G2‡&Wf–Ww2“°¢–b†&Æö6¶–æu&Wf–Ww2æÆVæwF‚â’°¢f–Â€¢u$Ud”UuôtDUô4„ätU5õ$UTU5DTBrÀ¢7F—fR4„ätU5õ$UTU5DTB&Wf–Wr‡2r“¢G¶&Æö6¶–æu&Wf–Ww2æÖ‚‡²Æöv–âÒ’ÓâÆöv–â’æ¦ö–â‚rÂr—ÒæÀ¢“°¢Ð ¢6öç7BF‡&VG2ÒfWF6„ÆÅ&Wf–WuF‡&VG2‡&WòÂ$çVÖ&W"“°¢6öç7BVç&W6öÇfVBÒ7F—fUVç&W6öÇfVEF‡&VG2‡F‡&VG2“°¢–b‡Vç&W6öÇfVBæÆVæwF‚â’°¢6öç7BÆö6F–öç2ÒVç&W6öÇfV@¢ç6Æ–6RƒÂ#¢æÖ‚‡F‡&VB’ÓâG·F‡&VBçF‚ÇÂwVæ¶æ÷vâwÓ¢G·F‡&VBæÆ–æRÇÂvâöwÖ¢æ¦ö–â‚rÂr“°¢f–Â€¢u$Ud”UuôtDUõTå$U4ôÅdTEõD…$TE2p¢G·Vç&W6öÇfVBæÆVæwF‡Ò7W'&VçB&Wf–WrF‡&VB‡2’Vç&W6öÇfVC¢G¶Æö6F–öç7ÖÀ¢“°¢Ð ¢6öç7B—4&ö÷G7G&FV6—6–öâÒWF†÷&—G”FV6—6–öâæ6Æ76–f–6F–öâÓÓÒ$õd”DU%ôÔ”åDTää4Uô$ôõE5E$ô4Ä54”d”4D”ôã°¢–b†—4&ö÷G7G&FV6—6–öâÓÒ†&ö÷G7G&æVÆ–v–&ÆRÓÓÒG'VR’’°¢f–Â€¢u$Ud”UuôtDUô$ôõE5E$ôDT4•4”ôåôÔ•4ÔD4‚rÀ¢u&Wf–WrWF†÷&—G’6Æ76–f–6F–öâæBfÆ–FFVB&ö÷G7G&VÆ–v–&–Æ—G’F—6w&VRârÀ¢“°¢Ð ¢ÆWB6†V6¶VD6’Ò—4&ö÷G7G&FV6—6–öâò&ö÷G7G&æ6”6†V6·2¢°¢–b†—4&ö÷G7G&FV6—6–öâbb‚çVÖ&W"æ—4–çFVvW"†6†V6¶VD6’’ÇÂ6†V6¶VD6’Â’’°¢f–Â€¢u$Ud”UuôtDUô$ôõE5E$ô4•ôUd”DTä4Uô”ådÄ”BrÀ¢t&ö÷G7G&&Wf–Wr6Æ76–f–6F–öâ&WV—&W2fÆ–FFVBW†7BÖ†VBæöâ×&÷f–FW"4’Wf–FVæ6RârÀ¢“°¢Ð¢–b‚—4&ö÷G7G&FV6—6–öâbb&WV—&Tw&VVä6’’°¢6öç7B6æ6†÷BÒfWF6„6†V6µ6æ6†÷B‡&WòÂ$çVÖ&W"“°¢–b‚6•6æ6†÷DÖF6†W4†VB‡6æ6†÷Bæ†VE6†Â†VE6†’’°¢f–Â€¢u$Ud”UuôtDUô4•ô„TEôÔ•4ÔD4‚rÀ¢4’6æ6†÷B†VBG·6æ6†÷Bæ†VE6†ÇÂvÖ—76–ærwÒFöW2æ÷BÖF6‚fW&–f–VB†VBG¶†VE6†ÒæÀ¢“°¢Ð¢–b‡6æ6†÷Bæ†VE&VbÓÒ7G&–ær‡#òæ†VCòç&VbÇÂrr’’°¢f–Â€¢u$Ud”UuôtDUô4•ô„TEõ$TeôÔ•4ÔD4‚rÀ¢4’6æ6†÷B†VB&VbG·6æ6†÷Bæ†VE&VbÇÂvÖ—76–ærwÒFöW2æ÷BÖF6‚fW&–f–VB"†VB&VbGµ7G&–ær‡#òæ†VCòç&VbÇÂrr’ÇÂvÖ—76–ærwÒæÀ¢“°¢Ð¢–b‡6æ6†÷Bæ6æöæ–6Æ—¦F–öäW'&÷'2æÆVæwF‚â’°¢f–Â€¢u$Ud”UuôtDUô4•õ4ä4„õEô”ådÄ”BrÀ¢W†7BÕ"Ö†VB4’WF†÷&—G’ÖWFFF—2ÖÆf÷&ÖVB÷"Ö&–wV÷W3¢G·6æ6†÷Bæ6æöæ–6Æ—¦F–öäW'&÷'2ç6Æ–6RƒÂ#’æ¦ö–â‚rÂr—ÖÀ¢“°¢Ð ¢6öç7Bö'6W'fVBÒ7V'7FçF—fT6†V6·2‡6æ6†÷Bæ6†V6·2“°¢6†V6¶VD6’Òö'6W'fVBæÆVæwFƒ°¢–b†ö'6W'fVBæÆVæwF‚ÓÓÒ’°¢f–Â‚u$Ud”UuôtDUô4•ôUd”DTä4UôÔ•54”ärrÂæò7V'7FçF—fR4’÷7FGW2Wf–FVæ6RW†—7G2f÷"W†7B†VBG¶†VE6†Òæ“°¢Ð ¢6öç7B6”&Æö6¶W'2Ò6†V6µ&öÆÇW&Æö6¶W'2‡6æ6†÷Bæ6†V6·2“°¢–b†6”&Æö6¶W'2æÆVæwF‚â’°¢f–Â€¢u$Ud”UuôtDUô4•ôäõEôu$TTârÀ¢G¶6”&Æö6¶W'2æÆVæwF‡ÒW†7BÖ†VB6†V6²‡2’&RVæF–ær÷"æöâÖw&VVã¢G¶6”&Æö6¶W'2ç6Æ–6RƒÂ3’æ¦ö–â‚rÂr—ÖÀ¢“°¢Ð¢Ð ¢6öç7Bf–æÄ†VBÒfWF6„Æ—fU$†VB‡&WòÂ$çVÖ&W"“°¢–b†f–æÄ†VBÓÒ†VE6†’°¢f–Â€¢u$Ud”UuôtDUô„TEôÔõdTEôEU$”äuõdU$”d”4D”ôârÀ¢fW&–f–VB†VBG¶†VE6†ÒÂ7W'&VçB†VB—2æ÷rG¶f–æÄ†VBÇÂvÖ—76–ærwÒæÀ¢“°¢Ð ¢6öç7B&W7VÇD6öçG&7BÒ&Wf–WtvFU&W7VÇD6öçG&7B††VE6†ÂWF†÷&—G”FV6—6–öâ“°¢–b‚&W7VÇD6öçG&7B’°¢f–Â‚u$Ud”UuôtDUõ$U5TÅEô”ådÄ”BrÂu&Wf–WrWF†÷&—G’ö6Æ76–f–6F–öâ—"—2–æ6öç6—7FVçBâr“°¢Ð¢6öç6öÆRæÆör†%õ$Ud”UuôtDUõ$U5TÅCÒG´¥4ôâç7G&–æv–g’‡&W7VÇD6öçG&7B—Ö“°¢6öç6öÆRæÆör€¢u%õ$Ud”UuôtDSÕ52#Òr²$çVÖ&W ¢²r†VCÒr²†VE6†¢²r&Wf–Wt6Æ76–f–6F–öãÒr²&W7VÇD6öçG&7Bæ6Æ76–f–6F–öà¢²r&Wf–WtWF†÷&—G“Òr²&W7VÇD6öçG&7Bç&Wf–WtWF†÷&—G¢²r6öFW„&÷fÇ3Òr²÷6—F—fT6öFW…&Wf–Ww2æÆVæwF€¢²r6öFW„W†7D†VD6ÆVä6öÖÖVçG3Òr²W†7D6ÆVä6öFW„6öÖÖVçG0¢²r6÷–Æ÷DW†7D†VE&Wf–Ww3Òr²÷6—F—fT6÷–Æ÷E&Wf–Ww2æÆVæwF€¢²rö7F÷W4W†7D†VDGFW7FF–öç3Òr²v÷&¶fÆ÷t&÷VæDö7F÷W4GFW7FF–öç2æÆVæwF€¢²rÆö6ÅvVäW†7D†VDGFW7FF–öç3Òr²v÷&¶fÆ÷t&÷VæDÆö6ÅvVäGFW7FF–öç2æÆVæwF€¢²r÷væW%6VÆdVF—DGFW7FF–öç3Òr²÷væW%6VÆdVF—G2æÆVæwF€¢²rVç&W6öÇfVD7W'&VçEF‡&VG3Óp¢²r6”6†V6·3Òr²6†V6¶VD6’À¢“°§Ð ¦6öç7B–çfö¶VEF‚Ò&ö6W72æ&we³ÒÇÂrs°¦–b†–çfö¶VEF‚bb–×÷'BæÖWFçW&ÂÓÓÒF…Fôf–ÆUU$Â‡&W6öÇfR†–çfö¶VEF‚’’æ‡&Vb’°¢Ö–â‚“°§Ð