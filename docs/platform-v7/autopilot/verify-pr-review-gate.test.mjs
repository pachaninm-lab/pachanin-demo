import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('only explicit Codex approval is positive review authority; COMMENTED and CHANGES_REQUESTED are not', () => {
  const reviews = [
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      commit_id: head,
      state: 'COMMENTED',
    },
    {
      user: { login: 'chatgpt-codex-connector' },
      commit_id: head,
      state: 'CHANGES_REQUESTED',
    },
    {
      user: { login: 'chatgpt-codex-connector' },
      commit_id: head,
      state: 'APPROVED',
    },
  ];

  assert.equal(exactHeadCodexReviews(reviews, head).length, 3);
  assert.deepEqual(positiveExactHeadCodexReviews(reviews, head), [reviews[2]]);
  assert.equal(positiveExactHeadCodexReviews(reviews.slice(0, 2), head).length, 0);
});

test('GitHub Copilot is an explicit independent reviewer provider, not an arbitrary bot', () => {
  assert.deepEqual([...COPILOT_REVIEW_LOGINS], ['copilot-pull-request-reviewer[bot]']);

  const reviews = [
    {
      user: { login: 'copilot-pull-request-reviewer[bot]' },
      commit_id: oldHead,
      state: 'COMMENTED',
    },
    {
      user: { login: 'copilot-pull-request-reviewer[bot]' },
      commit_id: head,
      state: 'PENDING',
    },
    {
      user: { login: 'some-other-review-bot[bot]' },
      commit_id: head,
      state: 'APPROVED',
    },
    {
      user: { login: 'copilot-pull-request-reviewer[bot]' },
      commit_id: head,
      state: 'COMMENTED',
    },
    {
      user: { login: 'copilot-pull-request-reviewer[bot]' },
      commit_id: head,
      state: 'APPROVED',
    },
    {
      user: { login: 'copilot-pull-request-reviewer[bot]' },
      commit_id: head,
      state: 'CHANGES_REQUESTED',
    },
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
  const goodReview = {
    user: { login: 'github-actions[bot]' },
    commit_id: head,
    state: 'COMMENTED',
    body,
  };
  const goodStatus = {
    context: OCTOPUS_STATUS_CONTEXT,
    state: 'success',
    creator: { login: 'github-actions[bot]' },
    description: `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${summaryHash.slice(0, 16)}`,
    target_url: `https://github.com/${repo}/actions/runs/${runId}`,
  };

  assert.equal(
    positiveExactHeadOctopusAttestations([goodReview], [goodStatus], head, repo).length,
    1,
  );
  assert.equal(
    positiveExactHeadOctopusAttestations(
      [{ ...goodReview, commit_id: oldHead }],
      [goodStatus],
      head,
      repo,
    ).length,
    0,
  );
  assert.equal(
    positiveExactHeadOctopusAttestations(
      [{ ...goodReview, user: { login: 'pachaninm-lab' } }],
      [goodStatus],
      head,
      repo,
    ).length,
    0,
  );
  assert.equal(
    positiveExactHeadOctopusAttestations(
      [goodReview],
      [{ ...goodStatus, description: 'Octopus clean mismatched evidence' }],
      head,
      repo,
    ).length,
    0,
  );
  assert.equal(
    positiveExactHeadOctopusAttestations(
      [goodReview],
      [{ ...goodStatus, state: 'failure' }, goodStatus],
      head,
      repo,
    ).length,
    0,
  );
});

test('Octopus authority is additionally bound to one successful trusted workflow run on the exact PR head', () => {
  const repo = 'pachaninm-lab/pachanin-demo';
  const repositoryId = 1203022077;
  const prNumber = 5167;
  const runId = '34180354026';
  const attestation = { runId };
  const run = {
    id: Number(runId),
    name: 'Independent Octopus Review',
    path: '.github/workflows/octopus-independent-review.yml',
    event: 'pull_request_target',
    status: 'completed',
    conclusion: 'success',
    head_sha: head,
    repository: { id: repositoryId, full_name: repo },
    pull_requests: [{
      number: prNumber,
      head: { sha: head, repo: { id: repositoryId } },
    }],
  };

  assert.equal(octopusAttestationMatchesWorkflowRun(attestation, run, repo, prNumber, head), true);
  for (const mutation of [
    { id: 1 },
    { name: 'Some Other Workflow' },
    { path: '.github/workflows/not-octopus.yml' },
    { event: 'pull_request' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { head_sha: oldHead },
    { repository: { id: repositoryId, full_name: 'evil/repo' } },
    { pull_requests: [{ number: 9999, head: { sha: head, repo: { id: repositoryId } } }] },
    { pull_requests: [{ number: prNumber, head: { sha: oldHead, repo: { id: repositoryId } } }] },
    { pull_requests: [{ number: prNumber, head: { sha: head, repo: { id: 999 } } }] },
  ]) {
    assert.equal(
      octopusAttestationMatchesWorkflowRun(attestation, { ...run, ...mutation }, repo, prNumber, head),
      false,
      JSON.stringify(mutation),
    );
  }
});

test('observed successful Octopus pull_request_target run shape is accepted without weakening exact-head binding', () => {
  const observed = {
    id: 34180354026,
    name: 'Independent Octopus Review',
    head_sha: '0f6fdeccbcb97a70161198ac0321d0918388a084',
    path: '.github/workflows/octopus-independent-review.yml',
    event: 'pull_request_target',
    status: 'completed',
    conclusion: 'success',
    pull_requests: [{
      number: 5167,
      head: { sha: '0f6fdeccbcb97a70161198ac0321d0918388a084', repo: { id: 1203022077 } },
    }],
    repository: { id: 1203022077, full_name: 'pachaninm-lab/pachanin-demo' },
  };
  assert.equal(
    octopusAttestationMatchesWorkflowRun(
      { runId: '34180354026' },
      observed,
      'pachaninm-lab/pachanin-demo',
      5167,
      '0f6fdeccbcb97a70161198ac0321d0918388a084',
    ),
    true,
  );
});

test('actual #5167 Octopus review, latest status and successful run form one exact-head authority tuple', () => {
  const actualHead = '0f6fdeccbcb97a70161198ac0321d0918388a084';
  const repo = 'pachaninm-lab/pachanin-demo';
  const runId = '34180354026';
  const summary = '2e552f1f5a628d16efbd4daaea671580a52e853c281dfb42b59a3ef92d5c2af8';
  const review = {
    user: { login: 'github-actions[bot]' },
    commit_id: actualHead,
    state: 'COMMENTED',
    body: [
      'OCTOPUS INDEPENDENT REVIEW: PASS',
      `Exact head: \`${actualHead}\``,
      'Provider workflow: `.github/workflows/octopus-independent-review.yml`',
      `Provider action: \`${OCTOPUS_ACTION_SHA}\``,
      'Findings: `0`',
      `Summary SHA-256: \`${summary}\``,
      `Workflow run: \`${runId}\``,
    ].join('\n'),
  };
  const statuses = [{
    context: OCTOPUS_STATUS_CONTEXT,
    state: 'success',
    creator: { login: 'github-actions[bot]' },
    description: `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${summary.slice(0, 16)}`,
    target_url: `https://github.com/${repo}/actions/runs/${runId}`,
  }];
  const [attestation] = positiveExactHeadOctopusAttestations([review], statuses, actualHead, repo);
  assert.ok(attestation);
  assert.equal(octopusAttestationMatchesWorkflowRun(attestation, {
    id: Number(runId),
    name: 'Independent Octopus Review',
    path: '.github/workflows/octopus-independent-review.yml',
    event: 'pull_request_target',
    status: 'completed',
    conclusion: 'success',
    head_sha: actualHead,
    repository: { id: 1203022077, full_name: repo },
    pull_requests: [{ number: 5167, head: { sha: actualHead, repo: { id: 1203022077 } } }],
  }, repo, 5167, actualHead), true);
});


test('Local Qwen authority requires paired exact-head review, latest provider status and trusted Actions run', () => {
  const repo = 'pachaninm-lab/pachanin-demo';
  const runId = '987654321';
  const tick = String.fromCharCode(96);
  const diffSha = 'd'.repeat(64);
  const manifestSha = 'e'.repeat(64);
  const promptSha = 'f'.repeat(64);
  const responseSha = '1'.repeat(64);
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
  const review = {
    user: { login: 'github-actions[bot]' },
    commit_id: head,
    state: 'COMMENTED',
    body,
  };
  const status = {
    context: LOCAL_QWEN_STATUS_CONTEXT,
    state: 'success',
    creator: { login: 'github-actions[bot]' },
    description: 'Qwen clean model='
      + LOCAL_QWEN_MODEL_SHA256.slice(0, 8)
      + ' response=' + responseSha.slice(0, 16)
      + ' chunks=4 manifest=' + manifestSha.slice(0, 16),
    target_url: 'https://github.com/' + repo + '/actions/runs/' + runId,
  };
  const attestations = positiveExactHeadLocalQwenAttestations([review], [status], head, repo);
  assert.equal(attestations.length, 1);
  assert.equal(localQwenAttestationMatchesWorkflowRun(attestations[0], {
    id: Number(runId),
    name: LOCAL_QWEN_WORKFLOW_NAME,
    path: LOCAL_QWEN_WORKFLOW_PATH,
    event: 'pull_request_target',
    status: 'completed',
    conclusion: 'success',
    head_sha: head,
    repository: { id: 1203022077, full_name: repo },
    pull_requests: [{ number: 5127, head: { sha: head, repo: { id: 1203022077 } } }],
  }, repo, 5127, head), true);
  assert.equal(
    positiveExactHeadLocalQwenAttestations([review], [
      { ...status, state: 'failure' },
      status,
    ], head, repo).length,
    0,
  );
  assert.equal(
    localQwenAttestationMatchesWorkflowRun(attestations[0], {
      id: Number(runId),
      name: LOCAL_QWEN_WORKFLOW_NAME,
      path: LOCAL_QWEN_WORKFLOW_PATH,
      event: 'pull_request_target',
      status: 'completed',
      conclusion: 'success',
      head_sha: oldHead,
      repository: { id: 1203022077, full_name: repo },
      pull_requests: [{ number: 5127, head: { sha: oldHead, repo: { id: 1203022077 } } }],
    }, repo, 5127, head), false);
  assert.equal(LOCAL_QWEN_MAX_DIFF_BYTES >= 227121, true);
  assert.equal(LOCAL_QWEN_MAX_CHUNKS >= 4, true);
});

test('recognizes clean Codex review evidence only from the Codex bot and a reviewed commit prefix', () => {
  const comments = [
    {
      user: { login: 'someone-else' },
      body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `1234567890`",
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: 'Codex Review summary without clean-review sentence. **Reviewed commit:** `abcdef1234`',
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: "Codex Review: Didn't find any major issues. Keep it up!\n\n**Reviewed commit:** `deadbeef42`",
    },
  ];

  assert.deepEqual(cleanCodexReviewPrefixes(comments), ['deadbeef42']);
});

test('rejects short or malformed clean-review commit prefixes', () => {
  const comments = [
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `abc1234`",
    },
    {
      user: { login: 'chatgpt-codex-connector[bot]' },
      body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `not-a-sha!`",
    },
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
    {
      user: { login: owner },
      body: `OWNER SELF-AUDIT: PASS exact head \`${head}\``,
    },
    {
      user: { login: owner },
      body: `OWNER SELF-AUDIT: PASS exact head \`${oldHead}\``,
    },
    {
      user: { login: 'someone-else' },
      body: `OWNER SELF-AUDIT: PASS exact head \`${head}\``,
    },
    {
      user: { login: owner },
      body: `OWNER SELF-AUDIT: PASS exact head \`${head.slice(0, 12)}\``,
    },
  ];

  assert.deepEqual(exactHeadOwnerSelfAudits(comments, owner, head), [comments[0]]);
  assert.equal(exactHeadOwnerSelfAudits(comments, owner, oldHead).length, 1);
  assert.equal(exactHeadOwnerSelfAudits(comments, 'other-owner', head).length, 0);
  assert.equal(exactHeadOwnerSelfAudits(comments, owner, 'not-a-sha').length, 0);
});

test('rejects a Codex review from another actor even when commit matches', () => {
  const reviews = [
    {
      user: { login: 'someone-else' },
      commit_id: head,
      state: 'APPROVED',
    },
  ];

  assert.equal(exactHeadCodexReviews(reviews, head).length, 0);
  assert.equal(positiveExactHeadCodexReviews(reviews, head).length, 0);
});

test('rejects a Copilot-looking review from another actor even when commit matches', () => {
  const reviews = [
    {
      user: { login: 'copilot-reviewer[bot]' },
      commit_id: head,
      state: 'COMMENTED',
    },
  ];

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
  assert.match(mainBody, /positiveExactHeadLocalQwenAttestations\(reviews, headSha\)/u);
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
  assert.ok(
    mainBody.indexOf('REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING') < mainBody.indexOf('PR_REVIEW_GATE=PASS'),
  );
});

test('Octopus workflow is immutable, opt-in, no-head-checkout and fails closed on pending review output', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/octopus-independent-review.yml', import.meta.url),
    'utf8',
  );

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


test('Local Qwen workflow is bounded, chunk-complete, pinned and fail-closed', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/local-qwen-independent-review.yml', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /MAX_DIFF_BYTES=400000/u);
  assert.match(workflow, /MAX_CHUNK_DIFF_BYTES=8000/u);
  assert.match(workflow, /MAX_CHUNKS=64/u);
  assert.match(workflow, /local-qwen-review-manifest\.v1/u);
  assert.match(workflow, /full_diff_sha256/u);
  assert.match(workflow, /source_sha256/u);
  assert.match(workflow, /prompt_bundle_sha256/u);
  assert.match(workflow, /--ctx-size 8192/u);
  assert.match(workflow, /--n-predict 32/u);
  assert.match(workflow, /INFERENCE_WORKERS=2/u);
  assert.match(workflow, /timeout --kill-after=10 120/u);
  assert.match(workflow, /--seed 424242/u);
  assert.match(workflow, /--temperature 0/u);
  assert.match(workflow, /review-provider\/local-qwen/u);
  assert.match(workflow, /LOCAL QWEN INDEPENDENT REVIEW: PASS/u);
  assert.match(workflow, /Review manifest SHA-256/u);
  assert.match(workflow, /Prompt bundle SHA-256/u);
  assert.doesNotMatch(workflow, /limit=90000/u);
});

test('review reconciliation workflow uses supported dispatch wiring and complete pagination', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/automerge.yml', import.meta.url),
    'utf8',
  );

  // YAML parseability itself is enforced by Workflow Syntax Guard; this test binds
  // the semantic reconciliation contract so an unsupported trigger or broken payload
  // cannot silently replace the supported repository_dispatch path again.
  assert.doesNotMatch(workflow, /^\s*pull_request_review_thread:/mu);
  assert.match(
    workflow,
    /^\s*types:\s*\[[^\]]*ready_for_review[^\]]*converted_to_draft[^\]]*\]\s*$/mu,
  );
  assert.match(workflow, /^\s*repository_dispatch:\s*$/mu);
  assert.match(workflow, /^\s*types:\s*\[review-gate-reconcile\]\s*$/mu);
  assert.match(
    workflow,
    /group:\s*repo-automerge-\$\{\{[^\n]*github\.event\.client_payload\.pr_number[^\n]*\}\}/u,
  );
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
  assert.match(
    workflow,
    /github\.event_name == 'repository_dispatch' && github\.event\.action == 'review-gate-reconcile'/u,
  );
  assert.match(workflow, /PR_NUMBER:\s*\$\{\{ github\.event\.client_payload\.pr_number \}\}/u);
  assert.match(workflow, /EXPECTED_HEAD:\s*\$\{\{ github\.event\.client_payload\.head_sha \}\}/u);
  assert.match(workflow, /gh api --paginate --slurp/u);
  assert.match(workflow, /repos\/\$REPO\/pulls\?state=open&per_page=100/u);
  assert.match(workflow, /repos\/\$REPO\/dispatches/u);
  assert.match(workflow, /event_type=review-gate-reconcile/u);
  assert.match(workflow, /client_payload\[pr_number\]=\$pr_number/u);
  assert.match(workflow, /client_payload\[head_sha\]=\$head_sha/u);
});
