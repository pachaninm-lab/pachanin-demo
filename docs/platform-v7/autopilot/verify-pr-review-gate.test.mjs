import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  activeUnresolvedThreads,
  checkRollupBlockers,
  ciSnapshotMatchesHead,
  cleanCodexReviewPrefixes,
  COPILOT_REVIEW_LOGINS,
  exactHeadCodexReviews,
  exactHeadCopilotReviews,
  exactHeadOwnerSelfAudits,
  isIgnoredMergeGateCheck,
  latestBlockingChangeRequests,
  LOCAL_QWEN_LLAMA_ARCHIVE_SHA256,
  LOCAL_QWEN_LLAMA_BUILD,
  LOCAL_QWEN_LLAMA_SOURCE_COMMIT,
  LOCAL_QWEN_MAX_CHUNKS,
  LOCAL_QWEN_MAX_DIFF_BYTES,
  LOCAL_QWEN_MODEL_REVISION,
  LOCAL_QWEN_MODEL_SHA256,
  LOCAL_QWEN_POLICY_SHA256,
  LOCAL_QWEN_STATUS_CONTEXT,
  LOCAL_QWEN_WORKFLOW_NAME,
  LOCAL_QWEN_WORKFLOW_PATH,
  OCTOPUS_ACTION_SHA,
  OCTOPUS_STATUS_CONTEXT,
  octopusAttestationMatchesWorkflowRun,
  positiveExactHeadCodexReviews,
  positiveExactHeadCopilotReviews,
  positiveExactHeadLocalQwenAttestations,
  positiveExactHeadOctopusAttestations,
  localQwenAttestationMatchesWorkflowRun,
  reviewGatePrState,
  substantiveChecks,
} from './verify-pr-review-gate.mjs';

const head = 'a'.repeat(40);
const oldHead = 'b'.repeat(40);

test('accepts only a completed Codex review on the exact head', () => {
  const reviews = [
    { user: { login: 'chatgpt-codex-connector[bot]' }, commit_id: oldHead, state: 'COMMENTED' },
    { user: { login: 'chatgpt-codex-connector[bot]' }, commit_id: head, state: 'DISMISSED' },
    { user: { login: 'chatgpt-codex-connector[bot]' }, commit_id: head, state: 'PENDING' },
    { user: { login: 'chatgpt-codex-connector[bot]' }, commit_id: head, state: 'COMMENTED' },
  ];
  assert.equal(exactHeadCodexReviews(reviews, head).length, 1);
});

test('only explicit Codex approval is positive review authority; COMMENTED and CHANGES_REQUESTED are not', () => {
  const reviews = [
    { user: { login: 'chatgpt-codex-connector[bot]' }, commit_id: head, state: 'COMMENTED' },
    { user: { login: 'chatgpt-codex-connector' }, commit_id: head, state: 'CHANGES_REQUESTED' },
    { user: { login: 'chatgpt-codex-connector' }, commit_id: head, state: 'APPROVED' },
  ];
  assert.equal(exactHeadCodexReviews(reviews, head).length, 3);
  assert.deepEqual(positiveExactHeadCodexReviews(reviews, head), [reviews[2]]);
  assert.equal(positiveExactHeadCodexReviews(reviews.slice(0, 2), head).length, 0);
});

test('GitHub Copilot is an explicit independent reviewer provider, not an arbitrary bot', () => {
  assert.deepEqual([...COPILOT_REVIEW_LOGINS], ['copilot-pull-request-reviewer[bot]']);
  const reviews = [
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: oldHead, state: 'COMMENTED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'PENDING' },
    { user: { login: 'some-other-review-bot[bot]' }, commit_id: head, state: 'APPROVED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'COMMENTED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'APPROVED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'CHANGES_REQUESTED' },
  ];
  assert.deepEqual(exactHeadCopilotReviews(reviews, head), [reviews[3], reviews[4], reviews[5]]);
  assert.deepEqual(positiveExactHeadCopilotReviews(reviews, head), [reviews[3], reviews[4]]);
});

test('Octopus authority requires paired exact-head structured review and latest matching success status', () => {
  const repo = 'pachaninm-lab/pachanin-demo';
  const summaryHash = 'c'.repeat(64);
  const runId = '123456789';
  const body = [
    'OCTOPUS INDEPENDENT REVIEW: PASS',
    `Exact head: \`${head}\``,
    'Provider workflow: `.github/workflows/octopus-independent-review.yml`',
    `Provider action: \`${OCTOPUS_ACTION_SHA}\``,
    'Findings: `0`',
    `Summary SHA-256: \`${summaryHash}\``,
    `Workflow run: \`${runId}\``,
  ].join('\n');
  const goodReview = { user: { login: 'github-actions[bot]' }, commit_id: head, state: 'COMMENTED', body };
  const goodStatus = {
    context: OCTOPUS_STATUS_CONTEXT,
    state: 'success',
    creator: { login: 'github-actions[bot]' },
    description: `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${summaryHash.slice(0, 16)}`,
    target_url: `https://github.com/${repo}/actions/runs/${runId}`,
  };
  assert.equal(positiveExactHeadOctopusAttestations([goodReview], [goodStatus], head, repo).length, 1);
  assert.equal(positiveExactHeadOctopusAttestations([{ ...goodReview, commit_id: oldHead }], [goodStatus], head, repo).length, 0);
  assert.equal(positiveExactHeadOctopusAttestations([{ ...goodReview, user: { login: 'pachaninm-lab' } }], [goodStatus], head, repo).length, 0);
  assert.equal(positiveExactHeadOctopusAttestations([goodReview], [{ ...goodStatus, description: 'Octopus clean mismatched evidence' }], head, repo).length, 0);
  assert.equal(positiveExactHeadOctopusAttestations([goodReview], [{ ...goodStatus, state: 'failure' }, goodStatus], head, repo).length, 0);
});

test('Octopus authority is additionally bound to one successful trusted workflow run on the exact PR head', () => {
  const repo = 'pachaninm-lab/pachanin-demo';
  const repositoryId = 1203022077;
  const prNumber = 5167;
  const runId = '34180354026';
  const attestation = { runId };
  const run = {
    id: Number(runId), name: 'Independent Octopus Review', path: '.github/workflows/octopus-independent-review.yml',
    event: 'pull_request_target', status: 'completed', conclusion: 'success', head_sha: head,
    repository: { id: repositoryId, full_name: repo },
    pull_requests: [{ number: prNumber, head: { sha: head, repo: { id: repositoryId } } }],
  };
  assert.equal(octopusAttestationMatchesWorkflowRun(attestation, run, repo, prNumber, head), true);
  for (const mutation of [
    { id: 1 }, { name: 'Some Other Workflow' }, { path: '.github/workflows/not-octopus.yml' },
    { event: 'pull_request' }, { status: 'in_progress' }, { conclusion: 'failure' }, { head_sha: oldHead },
    { repository: { id: repositoryId, full_name: 'evil/repo' } },
    { pull_requests: [{ number: 9999, head: { sha: head, repo: { id: repositoryId } } }] },
    { pull_requests: [{ number: prNumber, head: { sha: oldHead, repo: { id: repositoryId } } }] },
    { pull_requests: [{ number: prNumber, head: { sha: head, repo: { id: 999 } } }] },
  ]) {
    assert.equal(octopusAttestationMatchesWorkflowRun(attestation, { ...run, ...mutation }, repo, prNumber, head), false, JSON.stringify(mutation));
  }
});

test('observed successful Octopus pull_request_target run shape is accepted without weakening exact-head binding', () => {
  const observed = {
    id: 34180354026, name: 'Independent Octopus Review', head_sha: '0f6fdeccbcb97a70161198ac0321d0918388a084',
    path: '.github/workflows/octopus-independent-review.yml', event: 'pull_request_target', status: 'completed', conclusion: 'success',
    pull_requests: [{ number: 5167, head: { sha: '0f6fdeccbcb97a70161198ac0321d0918388a084', repo: { id: 1203022077 } } }],
    repository: { id: 1203022077, full_name: 'pachaninm-lab/pachanin-demo' },
  };
  assert.equal(octopusAttestationMatchesWorkflowRun({ runId: '34180354026' }, observed, 'pachaninm-lab/pachanin-demo', 5167, '0f6fdeccbcb97a70161198ac0321d0918388a084'), true);
});

test('actual #5167 Octopus review, latest status and successful run form one exact-head authority tuple', () => {
  const actualHead = '0f6fdeccbcb97a70161198ac0321d0918388a084';
  const repo = 'pachaninm-lab/pachanin-demo';
  const runId = '34180354026';
  const summary = '2e552f1f5a628d16efbd4daaea671580a52e853c281dfb42b59a3ef92d5c2af8';
  const review = {
    user: { login: 'github-actions[bot]' }, commit_id: actualHead, state: 'COMMENTED',
    body: ['OCTOPUS INDEPENDENT REVIEW: PASS', `Exact head: \`${actualHead}\``, 'Provider workflow: `.github/workflows/octopus-independent-review.yml`', `Provider action: \`${OCTOPUS_ACTION_SHA}\``, 'Findings: `0`', `Summary SHA-256: \`${summary}\``, `Workflow run: \`${runId}\``].join('\n'),
  };
  const statuses = [{ context: OCTOPUS_STATUS_CONTEXT, state: 'success', creator: { login: 'github-actions[bot]' }, description: `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${summary.slice(0, 16)}`, target_url: `https://github.com/${repo}/actions/runs/${runId}` }];
  const [attestation] = positiveExactHeadOctopusAttestations([review], statuses, actualHead, repo);
  assert.ok(attestation);
  assert.equal(octopusAttestationMatchesWorkflowRun(attestation, {
    id: Number(runId), name: 'Independent Octopus Review', path: '.github/workflows/octopus-independent-review.yml', event: 'pull_request_target', status: 'completed', conclusion: 'success', head_sha: actualHead,
    repository: { id: 1203022077, full_name: repo }, pull_requests: [{ number: 5167, head: { sha: actualHead, repo: { id: 1203022077 } } }],
  }, repo, 5167, actualHead), true);
});

test('Local Qwen authority requires exact canonical Qwen3 identity, policy, status and trusted Actions run', () => {
  const repo = 'pachaninm-lab/pachanin-demo';
  const runId = '987654321';
  const tick = String.fromCharCode(96);
  const diffSha = 'd'.repeat(64), manifestSha = 'e'.repeat(64), promptSha = 'f'.repeat(64), responseSha = '1'.repeat(64);
  const body = [
    'LOCAL QWEN INDEPENDENT REVIEW: PASS',
    'Exact head: ' + tick + head + tick,
    'Provider workflow: ' + tick + LOCAL_QWEN_WORKFLOW_PATH + tick,
    'Model revision: ' + tick + LOCAL_QWEN_MODEL_REVISION + tick,
    'Model SHA-256: ' + tick + LOCAL_QWEN_MODEL_SHA256 + tick,
    'Runtime build: ' + tick + LOCAL_QWEN_LLAMA_BUILD + tick,
    'Runtime source commit: ' + tick + LOCAL_QWEN_LLAMA_SOURCE_COMMIT + tick,
    'Runtime archive SHA-256: ' + tick + LOCAL_QWEN_LLAMA_ARCHIVE_SHA256 + tick,
    'Policy SHA-256: ' + tick + LOCAL_QWEN_POLICY_SHA256 + tick,
    'Full diff SHA-256: ' + tick + diffSha + tick,
    'Diff bytes: ' + tick + '227121' + tick,
    'Chunk count: ' + tick + '4' + tick,
    'Review manifest SHA-256: ' + tick + manifestSha + tick,
    'Prompt bundle SHA-256: ' + tick + promptSha + tick,
    'Response SHA-256: ' + tick + responseSha + tick,
    'Workflow run: ' + tick + runId + tick,
    'Verdict: ' + tick + 'PASS' + tick,
    'Findings: ' + tick + '0' + tick,
  ].join('\n');
  const review = { user: { login: 'github-actions[bot]' }, commit_id: head, state: 'COMMENTED', body };
  const status = {
    context: LOCAL_QWEN_STATUS_CONTEXT, state: 'success', creator: { login: 'github-actions[bot]' },
    description: 'Qwen clean model=' + LOCAL_QWEN_MODEL_SHA256.slice(0, 8) + ' response=' + responseSha.slice(0, 16) + ' chunks=4 manifest=' + manifestSha.slice(0, 16),
    target_url: 'https://github.com/' + repo + '/actions/runs/' + runId,
  };
  const attestations = positiveExactHeadLocalQwenAttestations([review], [status], head, repo);
  assert.equal(attestations.length, 1);
  assert.equal(localQwenAttestationMatchesWorkflowRun(attestations[0], {
    id: Number(runId), name: LOCAL_QWEN_WORKFLOW_NAME, path: LOCAL_QWEN_WORKFLOW_PATH, event: 'pull_request_target', status: 'completed', conclusion: 'success', head_sha: head,
    repository: { id: 1203022077, full_name: repo }, pull_requests: [{ number: 5127, head: { sha: head, repo: { id: 1203022077 } } }],
  }, repo, 5127, head), true);
  assert.equal(positiveExactHeadLocalQwenAttestations([review], [{ ...status, state: 'failure' }, status], head, repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenAttestations([{ ...review, body: body.replace(LOCAL_QWEN_MODEL_SHA256, '0'.repeat(64)) }], [status], head, repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenAttestations([{ ...review, body: body.replace(LOCAL_QWEN_MODEL_REVISION, '9'.repeat(40)) }], [status], head, repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenAttestations([{ ...review, body: body.replace(LOCAL_QWEN_POLICY_SHA256, '2'.repeat(64)) }], [status], head, repo).length, 0);
  assert.equal(localQwenAttestationMatchesWorkflowRun(attestations[0], {
    id: Number(runId), name: LOCAL_QWEN_WORKFLOW_NAME, path: LOCAL_QWEN_WORKFLOW_PATH, event: 'pull_request_target', status: 'completed', conclusion: 'success', head_sha: oldHead,
    repository: { id: 1203022077, full_name: repo }, pull_requests: [{ number: 5127, head: { sha: oldHead, repo: { id: 1203022077 } } }],
  }, repo, 5127, head), false);
  assert.equal(LOCAL_QWEN_MAX_DIFF_BYTES >= 227121, true);
  assert.equal(LOCAL_QWEN_MAX_CHUNKS >= 4, true);
});

test('recognizes clean Codex review evidence only from the Codex bot and a reviewed commit prefix', () => {
  const comments = [
    { user: { login: 'someone-else' }, body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `1234567890`" },
    { user: { login: 'chatgpt-codex-connector[bot]' }, body: 'Codex Review summary without clean-review sentence. **Reviewed commit:** `abcdef1234`' },
    { user: { login: 'chatgpt-codex-connector[bot]' }, body: "Codex Review: Didn't find any major issues. Keep it up!\n\n**Reviewed commit:** `deadbeef42`" },
  ];
  assert.deepEqual(cleanCodexReviewPrefixes(comments), ['deadbeef42']);
});

test('rejects short or malformed clean-review commit prefixes', () => {
  const comments = [
    { user: { login: 'chatgpt-codex-connector[bot]' }, body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `abc1234`" },
    { user: { login: 'chatgpt-codex-connector[bot]' }, body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `not-a-sha!`" },
  ];
  assert.deepEqual(cleanCodexReviewPrefixes(comments), []);
});

test('clean-review SHA resolution cannot rebind an old prefix through a branch or tag alias', () => {
  const verifier = readFileSync(new URL('./verify-pr-review-gate.mjs', import.meta.url), 'utf8');
  assert.ok(verifier.includes("if (!/^[0-9a-f]{10,40}$/u.test(prefix)) return '';"));
  assert.ok(verifier.includes("return /^[0-9a-f]{40}$/u.test(sha) && sha.startsWith(prefix) ? sha : '';"));
});

test('owner self-audit authority is exact-head and exact-owner only', () => {
  const owner = 'pachaninm-lab';
  const comments = [
    { user: { login: owner }, body: `OWNER SELF-AUDIT: PASS exact head \`${head}\`` },
    { user: { login: owner }, body: `OWNER SELF-AUDIT: PASS exact head \`${oldHead}\`` },
    { user: { login: 'someone-else' }, body: `OWNER SELF-AUDIT: PASS exact head \`${head}\`` },
    { user: { login: owner }, body: `OWNER SELF-AUDIT: PASS exact head \`${head.slice(0, 12)}\`` },
  ];
  assert.deepEqual(exactHeadOwnerSelfAudits(comments, owner, head), [comments[0]]);
  assert.equal(exactHeadOwnerSelfAudits(comments, owner, oldHead).length, 1);
  assert.equal(exactHeadOwnerSelfAudits(comments, 'other-owner', head).length, 0);
  assert.equal(exactHeadOwnerSelfAudits(comments, owner, 'not-a-sha').length, 0);
});

test('rejects a Codex review from another actor even when commit matches', () => {
  const reviews = [{ user: { login: 'someone-else' }, commit_id: head, state: 'APPROVED' }];
  assert.equal(exactHeadCodexReviews(reviews, head).length, 0);
  assert.equal(positiveExactHeadCodexReviews(reviews, head).length, 0);
});

test('rejects a Copilot-looking review from another actor even when commit matches', () => {
  const reviews = [{ user: { login: 'copilot-reviewer[bot]' }, commit_id: head, state: 'COMMENTED' }];
  assert.equal(exactHeadCopilotReviews(reviews, head).length, 0);
  assert.equal(positiveExactHeadCopilotReviews(reviews, head).length, 0);
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
    { user: { login: 'reviewer-a' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-09-05T01:00:00Z' },
    { user: { login: 'reviewer-a' }, state: 'APPROVED', submitted_at: '2026-09-05T02:00:00Z' },
    { user: { login: 'reviewer-b' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-09-05T03:00:00Z' },
  ];
  assert.deepEqual(latestBlockingChangeRequests(reviews).map(({ login }) => login), ['reviewer-b']);
});

test('a later COMMENTED review does not clear CHANGES_REQUESTED', () => {
  const reviews = [
    { user: { login: 'reviewer-a' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-09-05T01:00:00Z' },
    { user: { login: 'reviewer-a' }, state: 'COMMENTED', submitted_at: '2026-09-05T02:00:00Z' },
  ];
  assert.deepEqual(latestBlockingChangeRequests(reviews).map(({ login }) => login), ['reviewer-a']);
});

test('dismissal clears a previous change request', () => {
  const reviews = [
    { user: { login: 'reviewer-a' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-09-05T01:00:00Z' },
    { user: { login: 'reviewer-a' }, state: 'DISMISSED', submitted_at: '2026-09-05T02:00:00Z' },
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
  assert.deepEqual(checkRollupBlockers(checks), ['CI / pending:IN_PROGRESS', 'Security / failed:FAILURE']);
});

test('legacy status contexts are evaluated by state', () => {
  const checks = [{ context: 'legacy-green', state: 'SUCCESS' }, { context: 'legacy-pending', state: 'PENDING' }];
  assert.deepEqual(checkRollupBlockers(checks), ['legacy-pending:PENDING']);
});

test('CI snapshot must be bound to the exact verified head', () => {
  assert.equal(ciSnapshotMatchesHead(head, head), true);
  assert.equal(ciSnapshotMatchesHead(oldHead, head), false);
  assert.equal(ciSnapshotMatchesHead('not-a-sha', head), false);
  assert.equal(ciSnapshotMatchesHead('', head), false);
});

test('PR state classification fails closed for Draft and incomplete/unknown state', () => {
  assert.equal(reviewGatePrState({ state: 'open', draft: false }), 'REVIEWABLE');
  assert.equal(reviewGatePrState({ state: 'open', draft: true }), 'DRAFT');
  assert.equal(reviewGatePrState({ state: 'closed', draft: false }), 'CLOSED');
  assert.equal(reviewGatePrState({ state: 'open' }), 'INVALID');
  assert.equal(reviewGatePrState({ state: 'unknown', draft: false }), 'INVALID');
  assert.equal(reviewGatePrState({ draft: false }), 'INVALID');
  assert.equal(reviewGatePrState(null), 'INVALID');
});

test('verifier main requires genuine independent exact-head authority from Codex, GitHub Copilot, Octopus, or Local Qwen', () => {
  const verifier = readFileSync(new URL('./verify-pr-review-gate.mjs', import.meta.url), 'utf8');
  const mainStart = verifier.indexOf('function main()');
  assert.ok(mainStart >= 0);
  const mainBody = verifier.slice(mainStart);
  assert.match(mainBody, /positiveExactHeadCodexReviews\(reviews, headSha\)/u);
  assert.match(mainBody, /cleanCodexReviewPrefixes\(comments\)/u);
  assert.match(mainBody, /resolveCommitSha\(repo, prefix\) === headSha/u);
  assert.match(mainBody, /positiveExactHeadCopilotReviews\(reviews, headSha\)/u);
  assert.match(mainBody, /positiveExactHeadOctopusAttestations/u);
  assert.match(mainBody, /octopusAttestationMatchesWorkflowRun/u);
  assert.match(mainBody, /positiveExactHeadLocalQwenAttestations\(/u);
  assert.match(mainBody, /localQwenAttestationMatchesWorkflowRun/u);
  assert.match(mainBody, /fetchPublicLocalQwenActionsRun\(repo, attestation\.runId\)/u);
  assert.match(mainBody, /fetchPublicOctopusActionsRun\(repo, attestation\.runId\)/u);
  assert.match(mainBody, /fetchAllCommitStatuses\(repo, headSha\)/u);
  assert.match(mainBody, /REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING/u);
  assert.match(mainBody, /REVIEW_GATE_OWNER_SELF_AUDIT_MISSING/u);
  assert.match(mainBody, /reviewAuthority=/u);
  assert.match(mainBody, /GITHUB_COPILOT/u);
  assert.match(mainBody, /OCTOPUS/u);
  assert.doesNotMatch(mainBody, /MACHINE_FALLBACK/u);
  assert.doesNotMatch(mainBody, /machineReviewAuthorities/u);
  assert.ok(mainBody.indexOf('REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING') < mainBody.indexOf('PR_REVIEW_GATE=PASS'));
});

test('Octopus workflow is immutable, opt-in, no-head-checkout and fails closed on pending review output', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/octopus-independent-review.yml', import.meta.url), 'utf8');
  assert.match(workflow, /^\s*pull_request_target:\s*$/mu);
  assert.match(workflow, /contains\(github\.event\.pull_request\.body, '<!-- independent-review:octopus -->'\)/u);
  assert.match(workflow, /octopusreview\/action@c7156c0dc465c20e8b06da84b92b64f9ae8c7c36/u);
  assert.doesNotMatch(workflow, /actions\/checkout/u);
  assert.match(workflow, /^\s*contents:\s*read\s*$/mu);
  assert.match(workflow, /^\s*pull-requests:\s*write\s*$/mu);
  assert.match(workflow, /^\s*statuses:\s*write\s*$/mu);
  assert.match(workflow, /review-provider\/octopus/u);
  assert.match(workflow, /indexing in progress/u);
  assert.match(workflow, /review pending/u);
  assert.match(workflow, /live_head=.*gh api/u);
  assert.match(workflow, /OCTOPUS INDEPENDENT REVIEW: PASS/u);
  assert.match(workflow, /Summary SHA-256/u);
  assert.match(workflow, /Workflow run/u);
});

test('Local Qwen workflow uses canonical Qwen3 model-host, remains bounded and fails closed', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/local-qwen-independent-review.yml', import.meta.url), 'utf8');
  assert.match(workflow, /MAX_DIFF_BYTES=400000/u);
  assert.match(workflow, /MAX_CHUNK_DIFF_BYTES=8000/u);
  assert.match(workflow, /MAX_CHUNKS=96/u);
  assert.match(workflow, /local-qwen-review-manifest\.v1/u);
  assert.match(workflow, /full_diff_sha256/u);
  assert.match(workflow, /source_sha256/u);
  assert.match(workflow, /prompt_bundle_sha256/u);
  assert.match(workflow, /MODEL_REVISION: 895c8d171bc03c30e113cd7a28c02494b5e068b7/u);
  assert.match(workflow, /MODEL_SHA256: 107afd988cdbdcced3b8e76ebc3a8e83b5a18a5c796fca20778410cb9c47a814/u);
  assert.match(workflow, /MODEL_IDENTITY: tai-qwen3-8b-q4km/u);
  assert.match(workflow, /LLAMA_BUILD: b9637/u);
  assert.match(workflow, /TAI_MODEL_HOST/u);
  assert.match(workflow, /TAI_MODEL_SSH_USER/u);
  assert.match(workflow, /TAI_MODEL_SSH_KEY/u);
  assert.match(workflow, /TAI_MODEL_SSH_HOST_KEY/u);
  assert.match(workflow, /StrictHostKeyChecking=yes/u);
  assert.match(workflow, /tai-qwen3-8b\.service/u);
  assert.match(workflow, /MODEL_SHA256_MISMATCH/u);
  assert.match(workflow, /MODEL_IDENTITY_NOT_SERVED/u);
  assert.match(workflow, /enable_thinking/u);
  assert.match(workflow, /response_format/u);
  assert.match(workflow, /temperature':0/u);
  assert.match(workflow, /max_tokens':512/u);
  assert.match(workflow, /review-provider\/local-qwen/u);
  assert.match(workflow, /LOCAL QWEN INDEPENDENT REVIEW: PASS/u);
  assert.match(workflow, /Review manifest SHA-256/u);
  assert.match(workflow, /Prompt bundle SHA-256/u);
  assert.match(workflow, /"required":\["findings"\]/u);
  assert.match(workflow, /set\(value\)!=\{'findings'\}/u);
  assert.match(workflow, /verdict='PASS' if not all_findings else 'BLOCK'/u);
  assert.match(workflow, /Do not author verdict or summary/u);
  assert.match(workflow, /json\.dumps\(value,ensure_ascii=True,sort_keys=True,separators=/u);
  assert.doesNotMatch(workflow, /json\.dumps\(value,ensure_ascii=False,sort_keys=True,separators=/u);
  assert.doesNotMatch(workflow, /"required":\["verdict","findings","summary"\]/u);
  assert.doesNotMatch(workflow, /Inconsistent BLOCK in chunk/u);
  assert.match(workflow, /SPECULATIVE_REASON/u);
  assert.match(workflow, /TRUSTED_POLICY_REPAIR_NOTICE/u);
  assert.match(workflow, /POLICY_REPAIR_INVALID_/u);
  assert.match(workflow, /QWEN3_POLICY_REPAIR_OK=/u);
  assert.match(workflow, /repair_prompt_sha256/u);
  assert.match(workflow, /finding\['path'\] != chunk\['path'\]/u);
  assert.match(workflow, /Policy-inadmissible speculative finding survived repair/u);
  assert.match(workflow, /'repairs':repair_metadata/u);
  assert.match(workflow, /Pinned canonical Qwen3 review failed closed/u);
  assert.doesNotMatch(workflow, /Qwen2\.5-Coder-3B/u);
  assert.doesNotMatch(workflow, /huggingface\.co\/Qwen\/Qwen2\.5/u);
  assert.doesNotMatch(workflow, /actions\/checkout/u);
});

function qwenLiteralSource(value) {
  // Decode only the fixed ten-space prefix of these checked-in run literals.
  return value.split('\n').map(line=>{
    if(!line.length) return line;
    assert.ok(line.startsWith('          '),'unexpected workflow literal indentation');
    return line.slice(10);
  }).join('\n');
}

const rejectedEvidenceHarness=String.raw`
import ast, hashlib, json, os, pathlib, re, subprocess, sys, tempfile
remote, validator, transport, cleanup, scenario = sys.argv[1:]
tree=ast.parse(remote)
constants={'SPECULATIVE_REASON','SECURITY_CLASSIFICATION','ROUTE_TEST_REFERENCE'}
functions={'fail','policy_violation','repair_user','save_rejected'}
definitions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in functions or isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in constants for t in node.targets)]
loop=[node for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='repairs' for t in node.targets) or isinstance(node,ast.With) and any(isinstance(i.context_expr,ast.Call) and isinstance(i.context_expr.func,ast.Attribute) and isinstance(i.context_expr.func.value,ast.Name) and i.context_expr.func.value.id=='output_path' for i in node.items)]
with tempfile.TemporaryDirectory() as directory:
    root=pathlib.Path(directory)
    manifest={'full_diff_sha256':'d'*64,'chunks':[{'index':1,'path':'src/changed.mjs','sha256':'c'*64}]}
    manifest_path=root/'review-manifest.json'
    manifest_path.write_text(json.dumps(manifest))
    manifest_sha=hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    namespace={'json':json,'re':re,'hashlib':hashlib,'review_head':'a'*40,'run_id':'123','run_attempt':'2','diff_sha':'d'*64,'manifest_sha':manifest_sha,'bearer':'PRIVATE_TOKEN_CANARY','host':'PRIVATE_HOST_CANARY'}
    exec(compile(ast.Module(body=definitions,type_ignores=[]),'<actual-qwen-functions>','exec'),namespace)
    original_save=namespace['save_rejected']
    item={'index':1,'path':'src/changed.mjs','chunk_sha256':'c'*64,'system':'trusted fixture policy','user':'public fixture diff'}
    def response(reason):
        return json.dumps({'findings':[{'severity':'P1','path':item['path'],'line':1,'title':'Concrete fixture','reason':reason}]},ensure_ascii=False)
    initial=response('This change could fail for the public fixture.')
    final=response('This change may fail for the public fixture.')
    def review(responses, save=None, request=None):
        folder=root/('review-'+str(len(list(root.glob('review-*')))))
        folder.mkdir()
        output=folder/'review-responses.jsonl'
        calls=[]
        def completion(system,user):
            calls.append((system,user))
            return responses[len(calls)-1]
        namespace.update(output_path=output,requests=[request or item],completion=completion,save_rejected=save or original_save)
        failure=None
        try: exec(compile(ast.Module(body=loop,type_ignores=[]),'<actual-qwen-loop>','exec'),namespace)
        except SystemExit as error: failure=str(error)
        return output,folder/'review-rejected.json',calls,failure
    def validate(raw, expected=True):
        source=root/'untrusted-rejected.json'; destination=root/'validated-rejected.json'
        destination.unlink(missing_ok=True)
        source.write_bytes(raw)
        args=[str(source),str(manifest_path),str(destination),'a'*40,'123','2','d'*64,manifest_sha]
        result=subprocess.run([sys.executable,'-c',validator,*args],capture_output=True,text=True)
        assert (result.returncode==0)==expected,(result.returncode,result.stderr)
        assert result.stdout==''
        assert 'PRIVATE_' not in result.stderr
        assert destination.exists()==expected
        if expected:
            assert destination.read_bytes()==raw
            assert destination.stat().st_mode & 0o777 == 0o600
    if scenario=='failed-repair':
        output,rejected,calls,failure=review([initial,final])
        assert failure=='REMOTE_REVIEW_ERROR=POLICY_REPAIR_INVALID_SPECULATIVE_REASON'
        assert len(calls)==2 and output.read_text()==''
        raw=rejected.read_bytes(); value=json.loads(raw)
        assert len(raw)<=65536 and rejected.stat().st_mode & 0o777 == 0o600
        assert value['initial']['content']==initial and value['final']['content']==final
        assert value['repair_prompt_sha256']==hashlib.sha256(calls[1][1].encode()).hexdigest()
        assert b'PRIVATE_TOKEN_CANARY' not in raw and b'PRIVATE_HOST_CANARY' not in raw
        validate(raw)
    elif scenario=='unchanged-review':
        for responses in [['{"findings":[]}'],[initial,'{"findings":[]}'],[response('The changed branch returns the wrong value for input zero.')]]:
            output,rejected,calls,failure=review(responses)
            assert failure is None and len(calls)==len(responses) and not rejected.exists()
            assert json.loads(output.read_text())['content']==responses[-1]
    elif scenario=='diagnostic-write-failure':
        for error in (OSError('fixture disk error'),KeyError('fixture metadata')):
            def broken(*args): raise error
            output,rejected,calls,failure=review([initial,final],broken)
            assert failure=='REMOTE_REVIEW_ERROR=POLICY_REPAIR_INVALID_SPECULATIVE_REASON'
            assert len(calls)==2 and output.read_text()=='' and not rejected.exists()
    elif scenario=='utf8-and-bounds':
        output,rejected,calls,failure=review([response('could: я中🌾'),response('may: я中🌾')])
        raw=rejected.read_bytes(); value=json.loads(raw)
        for key in ('initial','final'):
            content=value[key]['content'].encode('utf-8')
            assert value[key]['utf8_bytes']==len(content) and value[key]['sha256']==hashlib.sha256(content).hexdigest()
        validate(raw)
        validate(raw+b' '*(65536-len(raw)))
        validate(raw+b' '*(65537-len(raw)),False)
        validate(raw.decode().encode('utf-16'),False)
        output,rejected,calls,failure=review([response('could '+'\x00'*20000),final])
        assert failure=='REMOTE_REVIEW_ERROR=POLICY_REPAIR_INVALID_SPECULATIVE_REASON' and not rejected.exists()
    elif scenario=='binding-and-schema':
        _,rejected,_,_=review([initial,final]); original=json.loads(rejected.read_bytes())
        mutations=[lambda v:v.update(head='b'*40),lambda v:v.update(run_id='124'),lambda v:v.update(run_attempt='3'),
            lambda v:v.update(full_diff_sha256='e'*64),lambda v:v.update(manifest_sha256='f'*64),
            lambda v:v['chunk'].update(index=2),lambda v:v['chunk'].update(path='src/other.mjs'),lambda v:v['chunk'].update(sha256='e'*64),
            lambda v:v['initial'].update(content='changed'),lambda v:v['final'].update(sha256='e'*64),lambda v:v['final'].update(utf8_bytes=True),
            lambda v:v.update(private_host='PRIVATE_HOST_CANARY')]
        for mutate in mutations:
            value=json.loads(json.dumps(original)); mutate(value); validate(json.dumps(value).encode(),False)
    elif scenario=='failed-transport':
        _,rejected,_,_=review([initial,final])
        for mode in ('valid','invalid','unavailable'):
            runner=root/mode; runner.mkdir()
            (runner/'review-manifest.json').write_bytes(manifest_path.read_bytes())
            fixture=root/('fixture-'+mode+'.json')
            fixture.write_bytes(rejected.read_bytes() if mode=='valid' else b'{"private_host":"PRIVATE_HOST_CANARY"}')
            env={'PATH':os.environ['PATH'],'RUNNER_TEMP':str(runner),'FIXTURE_REJECTED':str(fixture),'COPY_MODE':mode,
                'REVIEW_HEAD':'a'*40,'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'2','REVIEW_DIFF_SHA256':'d'*64,'REVIEW_MANIFEST_SHA256':manifest_sha}
            setup='''set -Eeuo pipefail
umask 077
ssh_opts=(); scp_opts=()
MODEL_USER=fixture; MODEL_HOST=fixture; MODEL_IDENTITY=fixture; MODEL_SHA256=fixture; MODEL_SIZE_BYTES=1; LLAMA_SOURCE_COMMIT=fixture; remote_dir=fixture
ssh(){ return 23; }
scp(){ if [[ "$COPY_MODE" == unavailable ]]; then return 27; fi; local destination; for destination; do :; done; cp "$FIXTURE_REJECTED" "$destination"; }
'''
            script=setup+cleanup+'\ntrap cleanup EXIT\n'+transport
            result=subprocess.run(['bash'],input=script,env=env,capture_output=True,text=True)
            assert result.returncode==23,(mode,result.returncode,result.stderr)
            assert 'PRIVATE_' not in result.stdout+result.stderr
            assert not (runner/'review-rejected.raw.json').exists()
            assert not (runner/'review-rejected.tmp').exists()
            assert (runner/'review-rejected.json').exists()==(mode=='valid')
    else: raise AssertionError('unknown scenario')
`;

for(const scenario of ['failed-repair','unchanged-review','diagnostic-write-failure','utf8-and-bounds','binding-and-schema','failed-transport']) {
  test(`Qwen rejected evidence executes the actual workflow: ${scenario}`,()=>{
    const workflow=readFileSync(new URL('../../../.github/workflows/local-qwen-independent-review.yml',import.meta.url),'utf8');
    const block=marker=>{
      const index=workflow.indexOf(marker); assert.ok(index>=0,'expected actual Python block');
      const match=workflow.slice(index).match(/<<'PY'\n([\s\S]*?)\n          PY\n/);
      assert.ok(match,'expected fixed literal heredoc'); return qwenLiteralSource(match[1]);
    };
    const start=workflow.indexOf('          inference_status=0\n');
    const end=workflow.indexOf('          scp "${scp_opts[@]}" "$MODEL_USER@$MODEL_HOST:$remote_dir/review-responses.jsonl"',start);
    assert.ok(start>=0 && end>start,'expected actual failure transport');
    const cleanup=workflow.match(/          (cleanup\(\)\{[^\n]+)\n/); assert.ok(cleanup);
    const result=spawnSync('python3',['-c',rejectedEvidenceHarness,
      block('cat > "$RUNNER_TEMP/remote-review.py"'),block('if python3 - "$RUNNER_TEMP/review-rejected.raw.json"'),
      qwenLiteralSource(workflow.slice(start,end)),cleanup[1],scenario],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,'');
    assert.match(workflow,/if: always\(\) && steps\.inference\.outcome == 'failure'/);
    assert.match(workflow,/path: \$\{\{ runner\.temp \}\}\/review-rejected\.json/);
    const canonicalizer=workflow.slice(workflow.indexOf('- name: Validate and canonicalize independent review'));
    assert.doesNotMatch(canonicalizer,/review-rejected/,'diagnostics cannot become review authority');
  });
}

test('review reconciliation workflow uses supported dispatch wiring and complete pagination', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/automerge.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /^\s*pull_request_review_thread:/mu);
  assert.match(workflow, /^\s*types:\s*\[[^\]]*ready_for_review[^\]]*converted_to_draft[^\]]*\]\s*$/mu);
  assert.match(workflow, /^\s*repository_dispatch:\s*$/mu);
  assert.match(workflow, /^\s*types:\s*\[review-gate-reconcile\]\s*$/mu);
  assert.match(workflow, /group:\s*repo-automerge-\$\{\{[^\n]*github\.event\.client_payload\.pr_number[^\n]*\}\}/u);
  assert.match(workflow, /^\s*cancel-in-progress:\s*false\s*$/mu);
  assert.doesNotMatch(workflow, /^\s*cancel-in-progress:\s*true\s*$/mu);
  assert.match(workflow, /^\s*queue:\s*max\s*$/mu);
  const strictDraftEligibilityChecks = workflow.match(/\[ "\$draft" = false \]/gu) || [];
  assert.ok(strictDraftEligibilityChecks.length >= 2);
  const finalLiveStateChecks = workflow.match(/--json headRefOid,isDraft,state/gu) || [];
  assert.ok(finalLiveStateChecks.length >= 3);
  const draftInvalidations = workflow.match(/\[ "\$current_state" != OPEN \] \|\| \[ "\$current_draft" != false \]/gu) || [];
  assert.ok(draftInvalidations.length >= 3);
  const incompleteStateInvalidations = workflow.match(/Exact-head review authority invalidated by incomplete live PR state/gu) || [];
  assert.ok(incompleteStateInvalidations.length >= 3);
  const publisherAuthorityFailures = workflow.match(/if \[ "\$state" != success \]; then\s+exit 1\s+fi/gu) || [];
  assert.ok(publisherAuthorityFailures.length >= 3);
  assert.match(workflow, /^\s*exact-head-dispatched-gate:\s*$/mu);
  assert.match(workflow, /github\.event_name == 'repository_dispatch' && github\.event\.action == 'review-gate-reconcile'/u);
  assert.match(workflow, /PR_NUMBER:\s*\$\{\{ github\.event\.client_payload\.pr_number \}\}/u);
  assert.match(workflow, /EXPECTED_HEAD:\s*\$\{\{ github\.event\.client_payload\.head_sha \}\}/u);
  assert.match(workflow, /gh api --paginate --slurp/u);
  assert.match(workflow, /repos\/\$REPO\/pulls\?state=open&per_page=100/u);
  assert.match(workflow, /repos\/\$REPO\/dispatches/u);
  assert.match(workflow, /event_type=review-gate-reconcile/u);
  assert.match(workflow, /client_payload\[pr_number\]=\$pr_number/u);
  assert.match(workflow, /client_payload\[head_sha\]=\$head_sha/u);
});
