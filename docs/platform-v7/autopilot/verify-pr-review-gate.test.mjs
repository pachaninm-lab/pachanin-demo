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
  LOCAL_QWEN_MODEL_REVISION,
  LOCAL_QWEN_MODEL_SHA256,
  LOCAL_QWEN_POLICY_SHA256,
  LOCAL_QWEN_RUNTIME_ARCHIVE_SHA256,
  LOCAL_QWEN_RUNTIME_BUILD,
  LOCAL_QWEN_RUNTIME_SOURCE_COMMIT,
  LOCAL_QWEN_STATUS_CONTEXT,
  LOCAL_QWEN_WORKFLOW_NAME,
  LOCAL_QWEN_WORKFLOW_PATH,
  localQwenRunMatches,
  OCTOPUS_ACTION_SHA,
  OCTOPUS_STATUS_CONTEXT,
  OCTOPUS_WORKFLOW_PATH,
  octopusRunMatches,
  positiveExactHeadCodexReviews,
  positiveExactHeadCopilotReviews,
  positiveExactHeadLocalQwenPairs,
  positiveExactHeadOctopusAttestations,
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

test('only explicit Codex approval is positive review authority', () => {
  const reviews = [
    { user: { login: 'chatgpt-codex-connector[bot]' }, commit_id: head, state: 'COMMENTED' },
    { user: { login: 'chatgpt-codex-connector' }, commit_id: head, state: 'CHANGES_REQUESTED' },
    { user: { login: 'chatgpt-codex-connector' }, commit_id: head, state: 'APPROVED' },
  ];
  assert.equal(exactHeadCodexReviews(reviews, head).length, 3);
  assert.deepEqual(positiveExactHeadCodexReviews(reviews, head), [reviews[2]]);
});

test('GitHub Copilot remains an explicit independent provider', () => {
  assert.deepEqual([...COPILOT_REVIEW_LOGINS], ['copilot-pull-request-reviewer[bot]']);
  const reviews = [
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: oldHead, state: 'COMMENTED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'PENDING' },
    { user: { login: 'some-other-review-bot[bot]' }, commit_id: head, state: 'APPROVED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'COMMENTED' },
    { user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: head, state: 'APPROVED' },
  ];
  assert.deepEqual(exactHeadCopilotReviews(reviews, head), [reviews[3], reviews[4]]);
  assert.deepEqual(positiveExactHeadCopilotReviews(reviews, head), [reviews[3], reviews[4]]);
});

function qwenFixture(repo = 'pachaninm-lab/pachanin-demo') {
  const responseHash = 'c'.repeat(64);
  const diffHash = 'd'.repeat(64);
  const runId = '123456789';
  const review = {
    user: { login: 'github-actions[bot]' },
    commit_id: head,
    state: 'COMMENTED',
    submitted_at: '2026-09-07T12:01:00Z',
    body: [
      'LOCAL QWEN INDEPENDENT REVIEW: PASS',
      `Exact head: \`${head}\``,
      `Provider workflow: \`${LOCAL_QWEN_WORKFLOW_PATH}\``,
      `Model revision: \`${LOCAL_QWEN_MODEL_REVISION}\``,
      `Model SHA-256: \`${LOCAL_QWEN_MODEL_SHA256}\``,
      `Runtime build: \`${LOCAL_QWEN_RUNTIME_BUILD}\``,
      `Runtime source commit: \`${LOCAL_QWEN_RUNTIME_SOURCE_COMMIT}\``,
      `Runtime archive SHA-256: \`${LOCAL_QWEN_RUNTIME_ARCHIVE_SHA256}\``,
      `Policy SHA-256: \`${LOCAL_QWEN_POLICY_SHA256}\``,
      `Diff SHA-256: \`${diffHash}\``,
      `Response SHA-256: \`${responseHash}\``,
      `Workflow run: \`${runId}\``,
      'Verdict: `PASS`',
      'Findings: `0`',
    ].join('\n'),
  };
  const status = {
    context: LOCAL_QWEN_STATUS_CONTEXT,
    state: 'success',
    creator: { login: 'github-actions[bot]' },
    created_at: '2026-09-07T12:01:10Z',
    description: `Qwen clean model=${LOCAL_QWEN_MODEL_SHA256.slice(0, 8)} response=${responseHash.slice(0, 16)}`,
    target_url: `https://github.com/${repo}/actions/runs/${runId}`,
  };
  const run = {
    id: Number(runId),
    name: LOCAL_QWEN_WORKFLOW_NAME,
    path: LOCAL_QWEN_WORKFLOW_PATH,
    event: 'pull_request_target',
    status: 'completed',
    conclusion: 'success',
    head_sha: head,
    head_commit: { id: head },
    repository: { full_name: repo },
    head_repository: { full_name: repo },
    pull_requests: [{ number: 5151 }],
    run_started_at: '2026-09-07T12:00:00Z',
    updated_at: '2026-09-07T12:02:00Z',
  };
  return { review, status, run, runId, responseHash, diffHash, repo };
}

test('local Qwen authority first requires paired exact-head review and matching latest success status', () => {
  const fixture = qwenFixture();
  const pairs = positiveExactHeadLocalQwenPairs([fixture.review], [fixture.status], head, fixture.repo);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].runId, fixture.runId);
  assert.equal(pairs[0].responseSha256, fixture.responseHash);

  assert.equal(positiveExactHeadLocalQwenPairs([{ ...fixture.review, commit_id: oldHead }], [fixture.status], head, fixture.repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenPairs([{ ...fixture.review, user: { login: 'pachaninm-lab' } }], [fixture.status], head, fixture.repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenPairs([fixture.review], [{ ...fixture.status, state: 'failure' }], head, fixture.repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenPairs([fixture.review], [{ ...fixture.status, description: 'forged' }], head, fixture.repo).length, 0);
  assert.equal(positiveExactHeadLocalQwenPairs([fixture.review], [{ ...fixture.status, target_url: 'https://example.invalid/' }], head, fixture.repo).length, 0);
  assert.equal(
    positiveExactHeadLocalQwenPairs([fixture.review], [{ ...fixture.status, state: 'failure' }, fixture.status], head, fixture.repo).length,
    0,
  );
});

test('local Qwen authority additionally requires the exact successful trusted workflow run', () => {
  const fixture = qwenFixture();
  const [candidate] = positiveExactHeadLocalQwenPairs([fixture.review], [fixture.status], head, fixture.repo);
  assert.equal(localQwenRunMatches(fixture.run, candidate, head, fixture.repo, 5151), true);
  assert.equal(localQwenRunMatches({ ...fixture.run, path: '.github/workflows/other.yml' }, candidate, head, fixture.repo, 5151), false);
  assert.equal(localQwenRunMatches({ ...fixture.run, event: 'workflow_dispatch' }, candidate, head, fixture.repo, 5151), false);
  assert.equal(localQwenRunMatches({ ...fixture.run, conclusion: 'failure' }, candidate, head, fixture.repo, 5151), false);
  assert.equal(localQwenRunMatches({ ...fixture.run, head_sha: oldHead }, candidate, head, fixture.repo, 5151), false);
  assert.equal(localQwenRunMatches({ ...fixture.run, pull_requests: [{ number: 999 }] }, candidate, head, fixture.repo, 5151), false);
  assert.equal(localQwenRunMatches({ ...fixture.run, run_started_at: '2026-09-07T13:00:00Z' }, candidate, head, fixture.repo, 5151), false);
});

test('Octopus remains paired and fail-closed if used', () => {
  const repo = 'pachaninm-lab/pachanin-demo';
  const summaryHash = 'e'.repeat(64);
  const runId = '987654321';
  const review = {
    user: { login: 'github-actions[bot]' },
    commit_id: head,
    state: 'COMMENTED',
    body: [
      'OCTOPUS INDEPENDENT REVIEW: PASS',
      `Exact head: \`${head}\``,
      'Provider workflow: `.github/workflows/octopus-independent-review.yml`',
      `Provider action: \`${OCTOPUS_ACTION_SHA}\``,
      'Findings: `0`',
      `Summary SHA-256: \`${summaryHash}\``,
      `Workflow run: \`${runId}\``,
    ].join('\n'),
  };
  const status = {
    context: OCTOPUS_STATUS_CONTEXT,
    state: 'success',
    creator: { login: 'github-actions[bot]' },
    description: `Octopus clean ${OCTOPUS_ACTION_SHA.slice(0, 8)} summary=${summaryHash.slice(0, 16)}`,
    target_url: `https://github.com/${repo}/actions/runs/${runId}`,
  };
  assert.equal(positiveExactHeadOctopusAttestations([review], [status], head, repo).length, 1);
  assert.equal(positiveExactHeadOctopusAttestations([review], [{ ...status, state: 'failure' }], head, repo).length, 0);
});

test('recognizes clean Codex comment evidence only from Codex bot and reviewed commit prefix', () => {
  const comments = [
    { user: { login: 'someone-else' }, body: "Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** `1234567890`" },
    { user: { login: 'chatgpt-codex-connector[bot]' }, body: 'Codex Review summary without clean-review sentence. **Reviewed commit:** `abcdef1234`' },
    { user: { login: 'chatgpt-codex-connector[bot]' }, body: "Codex Review: Didn't find any major issues. Keep it up!\n\n**Reviewed commit:** `deadbeef42`" },
  ];
  assert.deepEqual(cleanCodexReviewPrefixes(comments), ['deadbeef42']);
});

test('owner self-audit authority is exact-head and exact-owner only', () => {
  const owner = 'pachaninm-lab';
  const comments = [
    { user: { login: owner }, body: `OWNER SELF-AUDIT: PASS exact head \`${head}\`` },
    { user: { login: owner }, body: `OWNER SELF-AUDIT: PASS exact head \`${oldHead}\`` },
    { user: { login: 'someone-else' }, body: `OWNER SELF-AUDIT: PASS exact head \`${head}\`` },
  ];
  assert.deepEqual(exactHeadOwnerSelfAudits(comments, owner, head), [comments[0]]);
  assert.equal(exactHeadOwnerSelfAudits(comments, owner, oldHead).length, 1);
});

test('blocks only unresolved non-outdated review threads', () => {
  const threads = [
    { isResolved: false, isOutdated: false, path: 'a.ts', line: 1 },
    { isResolved: true, isOutdated: false, path: 'b.ts', line: 2 },
    { isResolved: false, isOutdated: true, path: 'c.ts', line: 3 },
  ];
  assert.deepEqual(activeUnresolvedThreads(threads), [threads[0]]);
});

test('approval clears earlier CHANGES_REQUESTED but COMMENTED does not', () => {
  const reviews = [
    { user: { login: 'reviewer-a' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-09-05T01:00:00Z' },
    { user: { login: 'reviewer-a' }, state: 'COMMENTED', submitted_at: '2026-09-05T02:00:00Z' },
  ];
  assert.deepEqual(latestBlockingChangeRequests(reviews).map(({ login }) => login), ['reviewer-a']);
  reviews.push({ user: { login: 'reviewer-a' }, state: 'APPROVED', submitted_at: '2026-09-05T03:00:00Z' });
  assert.deepEqual(latestBlockingChangeRequests(reviews), []);
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

test('green skipped neutral checks pass; pending/red block', () => {
  assert.deepEqual(checkRollupBlockers([
    { workflowName: 'CI', name: 'unit', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { workflowName: 'CI', name: 'optional', status: 'COMPLETED', conclusion: 'SKIPPED' },
    { workflowName: 'Security', name: 'advisory', status: 'COMPLETED', conclusion: 'NEUTRAL' },
  ]), []);
  assert.deepEqual(checkRollupBlockers([
    { workflowName: 'CI', name: 'pending', status: 'IN_PROGRESS', conclusion: null },
    { workflowName: 'Security', name: 'failed', status: 'COMPLETED', conclusion: 'FAILURE' },
  ]), ['CI / pending:IN_PROGRESS', 'Security / failed:FAILURE']);
});

test('CI snapshot must be bound to exact verified head', () => {
  assert.equal(ciSnapshotMatchesHead(head, head), true);
  assert.equal(ciSnapshotMatchesHead(oldHead, head), false);
  assert.equal(ciSnapshotMatchesHead('not-a-sha', head), false);
});

test('PR state classification fails closed', () => {
  assert.equal(reviewGatePrState({ state: 'open', draft: false }), 'REVIEWABLE');
  assert.equal(reviewGatePrState({ state: 'open', draft: true }), 'DRAFT');
  assert.equal(reviewGatePrState({ state: 'closed', draft: false }), 'CLOSED');
  assert.equal(reviewGatePrState({ state: 'open' }), 'INVALID');
});

test('local Qwen workflow is immutable, local-only inference, opt-in and never executes PR code', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/local-qwen-independent-review.yml', import.meta.url), 'utf8');
  assert.match(workflow, /^\s*pull_request_target:\s*$/mu);
  assert.match(workflow, /contains\(github\.event\.pull_request\.body, '<!-- independent-review:local-qwen -->'\)/u);
  assert.doesNotMatch(workflow, /actions\/checkout/u);
  assert.match(workflow, new RegExp(LOCAL_QWEN_MODEL_REVISION, 'u'));
  assert.match(workflow, new RegExp(LOCAL_QWEN_MODEL_SHA256, 'u'));
  assert.match(workflow, new RegExp(LOCAL_QWEN_RUNTIME_ARCHIVE_SHA256, 'u'));
  assert.match(workflow, new RegExp(LOCAL_QWEN_POLICY_SHA256, 'u'));
  assert.match(workflow, /--temperature 0/u);
  assert.match(workflow, /--seed 424242/u);
  // The invariant is that decoding is constrained to a machine-checkable shape, so
  // the model cannot emit prose the validator would then have to guess at. The
  // mechanism moved from a JSON schema file to a GBNF grammar; assert the constraint
  // and the file it is loaded from, not a spelling of the flag that carried it.
  assert.match(workflow, /--grammar-file "\$RUNNER_TEMP\/review\.gbnf"/u);
  assert.match(workflow, /review\.gbnf/u);
  assert.match(workflow, /--offline/u);
  // The invariant is that a PASS verdict may not carry findings, and a BLOCK
  // verdict may not be empty. The workflow enforces both in its validator; assert
  // the enforcement, not a literal spelling of it that the workflow never used.
  assert.match(workflow, /if verdict == 'PASS' and findings:\s*\n\s*raise SystemExit/u);
  assert.match(workflow, /if verdict == 'BLOCK' and not findings:\s*\n\s*raise SystemExit/u);
  assert.match(workflow, /review-provider\/local-qwen/u);
  assert.match(workflow, /^\s*contents:\s*read\s*$/mu);
  assert.match(workflow, /^\s*pull-requests:\s*write\s*$/mu);
  assert.match(workflow, /^\s*statuses:\s*write\s*$/mu);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|HF_TOKEN/u);
});

test('verifier main requires genuine exact-head authority and has no machine fallback', () => {
  const verifier = readFileSync(new URL('./verify-pr-review-gate.mjs', import.meta.url), 'utf8');
  const mainStart = verifier.indexOf('function main()');
  assert.ok(mainStart >= 0);
  const mainBody = verifier.slice(mainStart);
  assert.match(mainBody, /positiveExactHeadCodexReviews\(reviews, headSha\)/u);
  assert.match(mainBody, /positiveExactHeadCopilotReviews\(reviews, headSha\)/u);
  assert.match(mainBody, /positiveExactHeadOctopusAttestations/u);
  assert.match(mainBody, /positiveExactHeadLocalQwenPairs/u);
  assert.match(mainBody, /fetchWorkflowRun\(repo, candidate\.runId\)/u);
  assert.match(mainBody, /localQwenRunMatches/u);
  assert.match(mainBody, /REVIEW_GATE_INDEPENDENT_EXACT_HEAD_MISSING/u);
  assert.match(mainBody, /REVIEW_GATE_OWNER_SELF_AUDIT_MISSING/u);
  assert.match(mainBody, /LOCAL_QWEN_CODER/u);
  assert.doesNotMatch(mainBody, /MACHINE_FALLBACK/u);
  assert.doesNotMatch(mainBody, /machineReviewAuthorities/u);
});

test('review reconciliation workflow uses supported dispatch wiring and complete pagination', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/automerge.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /^\s*pull_request_review_thread:/mu);
  assert.match(workflow, /^\s*repository_dispatch:\s*$/mu);
  assert.match(workflow, /^\s*types:\s*\[review-gate-reconcile\]\s*$/mu);
  assert.match(workflow, /^\s*cancel-in-progress:\s*false\s*$/mu);
  assert.match(workflow, /gh api --paginate --slurp/u);
  assert.match(workflow, /event_type=review-gate-reconcile/u);
});

function octopusRunFixture(repo = 'pachaninm-lab/pachanin-demo', runId = '34139689333') {
  return {
    run: {
      id: Number(runId),
      path: OCTOPUS_WORKFLOW_PATH,
      event: 'pull_request_target',
      status: 'completed',
      conclusion: 'success',
      head_sha: head,
      repository: { full_name: repo },
      pull_requests: [{ number: 5151 }],
    },
    candidate: { runId },
    repo,
    prNumber: 5151,
  };
}

test('Octopus authority is bound to the pinned provider run, not to a shared bot identity', () => {
  // Without this binding the Octopus path is satisfied by a review body plus a
  // commit status alone — both writable by github-actions[bot], the shared identity
  // of every workflow here holding pull-requests:write and statuses:write.
  const { run, candidate, repo, prNumber } = octopusRunFixture();
  assert.equal(octopusRunMatches(run, candidate, head, repo, prNumber), true);

  const rejected = {
    'another workflow running as the same actor': { ...run, path: '.github/workflows/attacker.yml' },
    'a run for a different commit': { ...run, head_sha: oldHead },
    'a push-triggered run, where PR content would be the code that ran': { ...run, event: 'push' },
    'a workflow_dispatch run': { ...run, event: 'workflow_dispatch' },
    // The provider workflow produces a run with identical path, event, head and PR
    // when its clean-review validation fails. Only the conclusion separates them.
    'a real provider run that FAILED its clean-review check': { ...run, conclusion: 'failure' },
    'a cancelled provider run': { ...run, conclusion: 'cancelled' },
    'a run still in progress': { ...run, status: 'in_progress', conclusion: null },
    'an incoherent in-progress run carrying a success conclusion': { ...run, status: 'in_progress' },
    'a run belonging to another repository': { ...run, repository: { full_name: 'someone/else' } },
    'a run for another pull request': { ...run, pull_requests: [{ number: 4242 }] },
    'a run attached to no pull request': { ...run, pull_requests: [] },
    'a run whose id is not the one the body cited': { ...run, id: 999 },
    'no run at all': null,
  };

  for (const [reason, mutated] of Object.entries(rejected)) {
    assert.equal(
      octopusRunMatches(mutated, candidate, head, repo, prNumber),
      false,
      `must not trust ${reason}`,
    );
  }
});

test('the Octopus run binding refuses a malformed context instead of trusting it', () => {
  const { run, candidate, repo, prNumber } = octopusRunFixture();
  assert.equal(octopusRunMatches(run, candidate, 'not-a-sha', repo, prNumber), false);
  assert.equal(octopusRunMatches(run, candidate, head, '', prNumber), false);
  assert.equal(octopusRunMatches(run, candidate, head, repo, 0), false);
  assert.equal(octopusRunMatches(run, null, head, repo, prNumber), false);
});

test('a pull_request_target run reports the pull request head, not the base branch', () => {
  // Load-bearing and previously disputed: were a pull_request_target run's head_sha
  // the BASE branch SHA — as github.sha is for that event — the head_sha check would
  // never match and the whole provider path would be dead code that silently can
  // never satisfy the gate. Two real runs of the provider workflow, against their
  // pull requests' heads:
  //   run 34139689333 head_sha 2912b4de70579036f8b759ac6cdfdfc8325ba827
  //     PR #5151 head 2912b4de70579036f8b759ac6cdfdfc8325ba827, base 968b65e67
  //   run 34139481341 head_sha 8488aab562a17c44f7739d55a5e65191ea0ee1a5
  //     PR #5124 head 8488aab562a17c44f7739d55a5e65191ea0ee1a5, base 1eb81f4de
  // In both, head_sha is the pull request head. The run object's head_sha and the
  // github.sha context value are different things for this event.
  const prHead = '2912b4de70579036f8b759ac6cdfdfc8325ba827';
  const baseSha = '968b65e67c8a6755aecfd81ea870c0e0fa4c7160';
  const { run, candidate, repo, prNumber } = octopusRunFixture();

  assert.equal(octopusRunMatches({ ...run, head_sha: prHead }, candidate, prHead, repo, prNumber), true);
  // Were a run to report the base SHA instead, refuse it rather than widen: a gate
  // that fails closed beats one bound to the wrong commit.
  assert.equal(octopusRunMatches({ ...run, head_sha: baseSha }, candidate, prHead, repo, prNumber), false);
});

test('main() binds every machine provider to a workflow run, with none left on identity alone', () => {
  const verifier = readFileSync(new URL('./verify-pr-review-gate.mjs', import.meta.url), 'utf8');
  const mainBody = verifier.slice(verifier.indexOf('function main()'));

  // Both machine providers must resolve a live run; neither may be satisfied by a
  // review body and a commit status alone.
  assert.match(mainBody, /octopusRunMatches\(run, candidate, headSha, repo, prNumber\)/u);
  assert.match(mainBody, /localQwenRunMatches\(run, candidate, headSha, repo, prNumber\)/u);
  assert.doesNotMatch(
    mainBody,
    /const octopusAuthority = positiveExactHeadOctopusAttestations\(/u,
    'Octopus authority must not be taken straight from the review/status pair',
  );
  assert.doesNotMatch(mainBody, /MACHINE_FALLBACK/u);
});

test('the accepted evidence is rendered from the provider workflow, not hand-written', () => {
  // Every other provider test builds its fixtures by hand. That leaves open the
  // failure mode that created this contour: the workflow's published body or status
  // text drifts, the suite stays green, and the gate silently becomes unsatisfiable
  // because no real attestation can ever be parsed again.
  const repo = 'pachaninm-lab/pachanin-demo';
  const attestationHead = 'e'.repeat(40);
  const summarySha256 = 'f'.repeat(64);
  const runId = '4242424242';

  const lines = readFileSync(
    new URL('../../../.github/workflows/octopus-independent-review.yml', import.meta.url),
    'utf8',
  ).split('\n');

  const render = (text) => text
    .replaceAll('\\`', '`')
    .replaceAll('${SUMMARY_SHA256:0:16}', summarySha256.slice(0, 16))
    .replaceAll('$SUMMARY_SHA256', summarySha256)
    .replaceAll('$GITHUB_RUN_ID', runId)
    .replaceAll('$HEAD_SHA', attestationHead)
    .replaceAll('$REPO', repo);

  const bodyStart = lines.findIndex((line) => line.includes('body="$(cat <<EOF'));
  const bodyEnd = lines.findIndex((line, index) => index > bodyStart && line.trim() === 'EOF');
  assert.ok(bodyStart >= 0 && bodyEnd > bodyStart, 'workflow must publish a heredoc attestation body');
  const template = lines.slice(bodyStart + 1, bodyEnd);
  const indent = Math.min(
    ...template.filter((line) => line.trim()).map((line) => line.match(/^ */u)[0].length),
  );
  const body = render(template.map((line) => line.slice(indent)).join('\n'));

  const successAt = lines.findIndex((line) => line.includes('-f state=success'));
  assert.ok(successAt >= 0, 'workflow must publish a success provider status');
  const successBlock = lines.slice(successAt, successAt + 6).join('\n');
  const description = successBlock.match(/-f description="([^"]*)"/u);
  const targetUrl = successBlock.match(/-f target_url="([^"]*)"/u);
  const context = successBlock.match(/-f context=(\S+)/u);
  assert.ok(description && targetUrl && context, 'success status must set context, description and target_url');
  assert.equal(context[1], OCTOPUS_STATUS_CONTEXT);

  const accepted = positiveExactHeadOctopusAttestations(
    [{ user: { login: 'github-actions[bot]' }, commit_id: attestationHead, state: 'COMMENTED', body }],
    [{
      context: context[1],
      state: 'success',
      creator: { login: 'github-actions[bot]' },
      description: render(description[1]),
      target_url: render(targetUrl[1]),
    }],
    attestationHead,
    repo,
  );

  assert.equal(accepted.length, 1, 'the verifier must accept the evidence the workflow emits');
  assert.equal(accepted[0].runId, runId);
  assert.equal(accepted[0].summarySha256, summarySha256);
});
