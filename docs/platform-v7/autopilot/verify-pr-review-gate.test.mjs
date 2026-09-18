import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  activeUnresolvedThreads, actionsRunIdFromCheck, canonicalizeExactPrHeadActionsChecks,
  canonicalSha40, checkRollupBlockers, ciSnapshotMatchesHead, exactHeadOwnerSelfAudits,
  fetchCheckSnapshot, fetchAllList, fetchAllReviewThreads, isIgnoredMergeGateCheck,
  latestBlockingChangeRequests, latestCommitStatuses, mergeReadinessResult,
  reviewGatePrState, strictGitHubHeadRef, substantiveChecks, verifyManualReadiness,
} from './verify-pr-review-gate.mjs';
const head = 'a'.repeat(40), oldHead = 'b'.repeat(40);
const exactHeadRef = 'fix/manual-readiness';
const repo = 'pachaninm-lab/pachanin-demo';

function actionsCheck({
  runId,
  name = 'guard',
  conclusion = 'SUCCESS',
  status = 'COMPLETED',
  startedAt = '2026-09-17T19:30:00Z',
  workflowName = 'platform-v7 autopilot guard',
}) {
  return {
    workflowName,
    name,
    status,
    conclusion,
    startedAt,
    detailsUrl: `https://github.com/${repo}/actions/runs/${runId}/job/${runId}01`,
  };
}

function actionsRun({
  id,
  runNumber,
  workflowId = 282418356,
  event = 'pull_request',
  headSha = head,
  headRef = exactHeadRef,
  runAttempt = 1,
}) {
  return {
    id,
    workflow_id: workflowId,
    run_number: runNumber,
    run_attempt: runAttempt,
    event,
    head_sha: headSha,
    head_branch: headRef,
  };
}

test('Actions check URL parsing is repository-bound and exact', () => {
  const check = actionsCheck({ runId: 35265106561 });
  assert.equal(actionsRunIdFromCheck(check, repo), '35265106561');
  assert.equal(actionsRunIdFromCheck(check, 'other/repo'), '');
  assert.equal(actionsRunIdFromCheck({ ...check, detailsUrl: 'https://example.com/actions/runs/35265106561' }, repo), '');
  assert.equal(actionsRunIdFromCheck(actionsCheck({ runId: '9007199254740992' }), repo), '');
});

test('PR head refs use strict Git ref syntax before becoming CI authority', () => {
  for (const valid of [
    exactHeadRef,
    '@',
    'feature/review.v2',
    'release-2026_09',
    'topic/ümlaut',
  ]) {
    assert.equal(strictGitHubHeadRef(valid), valid);
  }

  for (const invalid of [
    '',
    ' branch',
    'branch ',
    'branch name',
    '/branch',
    'branch/',
    'branch.',
    'a//b',
    'a..b',
    'a@{b',
    '.hidden/topic',
    'a/.hidden',
    'a/b.lock',
    'a?b',
    'a\\b',
    'a\nb',
  ]) {
    assert.equal(strictGitHubHeadRef(invalid), '');
  }
});

test('invalid repository identity fails closed with a generic Actions authority diagnostic', () => {
  const result = canonicalizeExactPrHeadActionsChecks(
    [actionsCheck({ runId: 42 })],
    [actionsRun({ id: 42, runNumber: 10 })],
    head,
    exactHeadRef,
    'owner/repo/extra',
  );
  assert.equal(result, null);
});

test('same-SHA Actions check from a foreign PR head ref is excluded only after valid run metadata proves the mismatch', () => {
  const foreignFailure = actionsCheck({ runId: 35264531109, conclusion: 'FAILURE' });
  const currentSuccess = actionsCheck({ runId: 35265106561, conclusion: 'SUCCESS' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [foreignFailure, currentSuccess],
    [
      actionsRun({ id: 35264531109, runNumber: 11817, headRef: 'transport/local-qwen-evidence-20260917', runAttempt: 2 }),
      actionsRun({ id: 35265106561, runNumber: 11819 }),
    ],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [currentSuccess]);
  assert.deepEqual(checkRollupBlockers(result), []);
});

test('missing or malformed Actions head-ref authority metadata fails closed instead of excluding the check', () => {
  const check = actionsCheck({ runId: 42 });
  for (const headRef of ['', ' branch-with-space ', 'branch with space', 'branch..name', 'branch@{name']) {
    const result = canonicalizeExactPrHeadActionsChecks(
      [check],
      [actionsRun({ id: 42, runNumber: 10, headRef })],
      head,
      exactHeadRef,
      repo,
    );
    assert.equal(result, null);
  }
});

test('Actions event authority is canonical lowercase metadata and fails closed otherwise', () => {
  const check = actionsCheck({ runId: 42 });
  const valid = canonicalizeExactPrHeadActionsChecks(
    [check],
    [actionsRun({ id: 42, runNumber: 10, event: 'workflow_dispatch' })],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(valid));
  assert.deepEqual(valid, [check]);

  const invalid = canonicalizeExactPrHeadActionsChecks(
    [check],
    [actionsRun({ id: 42, runNumber: 10, event: 'Pull_Request' })],
    head,
    exactHeadRef,
    repo,
  );
  assert.equal(invalid, null);
});

test('older failure followed by newer success in the same workflow/event family selects the newer run_number', () => {
  const olderFailure = actionsCheck({ runId: 101, conclusion: 'FAILURE', startedAt: '2026-09-17T19:20:00Z' });
  const newerSuccess = actionsCheck({ runId: 102, conclusion: 'SUCCESS', startedAt: '2026-09-17T19:30:00Z' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [olderFailure, newerSuccess],
    [actionsRun({ id: 101, runNumber: 100 }), actionsRun({ id: 102, runNumber: 101 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [newerSuccess]);
  assert.deepEqual(checkRollupBlockers(result), []);
});

test('newer failure in the same workflow/event family remains blocking', () => {
  const olderSuccess = actionsCheck({ runId: 101, conclusion: 'SUCCESS' });
  const newerFailure = actionsCheck({ runId: 102, conclusion: 'FAILURE' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [olderSuccess, newerFailure],
    [actionsRun({ id: 101, runNumber: 100 }), actionsRun({ id: 102, runNumber: 101 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [newerFailure]);
  assert.deepEqual(checkRollupBlockers(result), ['platform-v7 autopilot guard / guard:FAILURE']);
});

test('later wall-clock rerun of an older run_number cannot supersede a newer run_number', () => {
  const rerunOlderFailure = actionsCheck({ runId: 101, conclusion: 'FAILURE', startedAt: '2026-09-17T19:47:03Z' });
  const newerSuccess = actionsCheck({ runId: 102, conclusion: 'SUCCESS', startedAt: '2026-09-17T19:29:13Z' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [rerunOlderFailure, newerSuccess],
    [actionsRun({ id: 101, runNumber: 100, runAttempt: 2 }), actionsRun({ id: 102, runNumber: 101 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [newerSuccess]);
});

test('distinct Actions event families for the same workflow and exact PR head remain independently evaluated', () => {
  const prSuccess = actionsCheck({ runId: 101, name: 'pull-request-guard', conclusion: 'SUCCESS' });
  const dispatchFailure = actionsCheck({ runId: 202, name: 'dispatch-guard', conclusion: 'FAILURE' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [prSuccess, dispatchFailure],
    [
      actionsRun({ id: 101, runNumber: 100, event: 'pull_request' }),
      actionsRun({ id: 202, runNumber: 110, event: 'workflow_dispatch' }),
    ],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [prSuccess, dispatchFailure]);
  assert.deepEqual(checkRollupBlockers(result), ['platform-v7 autopilot guard / dispatch-guard:FAILURE']);
});

test('selected Actions run deduplicates the same logical check only by strictly newer parseable startedAt', () => {
  const first = actionsCheck({ runId: 42, conclusion: 'FAILURE', startedAt: '2026-09-17T19:29:13Z' });
  const retry = actionsCheck({ runId: 42, conclusion: 'SUCCESS', startedAt: '2026-09-17T19:31:13Z' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [first, retry],
    [actionsRun({ id: 42, runNumber: 10, runAttempt: 2 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [retry]);
});

test('malformed or ambiguous selected-run duplicate ordering blocks snapshot canonicalization', () => {
  const malformed = canonicalizeExactPrHeadActionsChecks(
    [actionsCheck({ runId: 42, startedAt: 'not-a-date' }), actionsCheck({ runId: 42, startedAt: '2026-09-17T19:31:13Z' })],
    [actionsRun({ id: 42, runNumber: 10, runAttempt: 2 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.equal(malformed, null);

  const ambiguous = canonicalizeExactPrHeadActionsChecks(
    [
      actionsCheck({ runId: 42, conclusion: 'FAILURE', startedAt: '2026-09-17T19:31:13Z' }),
      actionsCheck({ runId: 42, conclusion: 'SUCCESS', startedAt: '2026-09-17T19:31:13Z' }),
    ],
    [actionsRun({ id: 42, runNumber: 10, runAttempt: 2 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.equal(ambiguous, null);
});

test('Actions authority metadata conflicts and exact-head SHA mismatch fail closed', () => {
  const wrongSha = canonicalizeExactPrHeadActionsChecks(
    [actionsCheck({ runId: 42 })],
    [actionsRun({ id: 42, runNumber: 10, headSha: oldHead })],
    head,
    exactHeadRef,
    repo,
  );
  assert.equal(wrongSha, null);

  const ambiguous = canonicalizeExactPrHeadActionsChecks(
    [actionsCheck({ runId: 42 }), actionsCheck({ runId: 43, name: 'other' })],
    [actionsRun({ id: 42, runNumber: 10 }), actionsRun({ id: 43, runNumber: 10 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.equal(ambiguous, null);
});

test('legacy non-Actions status contexts survive exact-PR-head Actions canonicalization unchanged', () => {
  const legacy = { context: 'legacy-green', state: 'SUCCESS' };
  const current = actionsCheck({ runId: 42, conclusion: 'SUCCESS' });
  const result = canonicalizeExactPrHeadActionsChecks(
    [legacy, current],
    [actionsRun({ id: 42, runNumber: 10 })],
    head,
    exactHeadRef,
    repo,
  );
  assert.ok(Array.isArray(result));
  assert.deepEqual(result, [legacy, current]);
});


function fixture(overrides = {}) {
  const pr = { number: 5422, state: 'open', draft: false, auto_merge: null, head: { sha: head, ref: exactHeadRef }, base: { repo: { full_name: repo } } };
  const run = { ...actionsRun({ id: 42, runNumber: 10 }), name: 'platform-v7 autopilot guard', path: '.github/workflows/platform-v7-autopilot-guard.yml', repository: { full_name: repo }, status: 'completed', conclusion: 'success' };
  const raw = { id: 100, head_sha: head, name: 'guard', status: 'completed', conclusion: 'success', started_at: '2026-09-18T12:00:00Z', details_url: `https://github.com/${repo}/actions/runs/42/job/100`, app: { slug: 'github-actions' } };
  const data = { pr, run, reviews: [], comments: [{ id: 1, user: { login: 'pachaninm-lab' }, body: 'OWNER SELF-AUDIT: PASS exact head `' + head + '`' }], threads: [], checks: [raw], statuses: [], runs: [run], ...overrides };
  let prReads = 0;
  const calls = [];
  const read = (args) => {
    calls.push(args);
    const endpoint = args.find((value) => typeof value === 'string' && value.startsWith('repos/'));
    if (args.includes('graphql')) return data.threadPages || [{ data: { repository: { pullRequest: { headRefOid: head, reviewThreads: { nodes: data.threads, pageInfo: { hasNextPage: false, endCursor: null } } } } } }];
    if (endpoint?.endsWith('/pulls/5422')) { prReads += 1; return prReads === 3 && data.finalPr ? data.finalPr : data.pr; }
    if (endpoint?.includes('/reviews?')) return data.reviewPages || [data.reviews];
    if (endpoint?.includes('/comments?')) return [data.comments];
    if (endpoint?.includes('/check-runs?')) return data.checkPages || [{ total_count: data.checks.length, check_runs: data.checks }];
    if (endpoint?.includes('/statuses?')) return [data.statuses];
    if (endpoint?.includes('/actions/runs?')) return data.runPages || [{ total_count: data.runs.length, workflow_runs: data.runs }];
    if (endpoint?.includes('/actions/runs/')) {
      const id = endpoint.split('/').at(-1);
      if (data.fetchError) throw new Error('SYNTHETIC_SECRET_ERROR_SENTINEL');
      return Object.hasOwn(data, 'runOverride') ? data.runOverride : data.runs.find((row) => String(row.id) === id);
    }
    throw new Error(`Unexpected fixture call ${args}`);
  };
  return { data, read, calls, env: { REPO: repo, HEAD_SHA: head, PR_NUMBER: '5422' } };
}
function verify(f) { return verifyManualReadiness({ argv: ['--manual-readiness'], env: f.env, readGitHubJson: f.read }); }
function expectBlocked(f, code) { assert.throws(() => verify(f), { message: code }); }

test('CLI legacy invocation fails before environment or network, with no PASS contract', () => {
  let reads = 0;
  for (const argv of [[], ['--independent-only'], ['--manual-readiness', '--other'], ['manual-readiness']]) {
    assert.throws(() => verifyManualReadiness({ argv, readGitHubJson: () => { reads += 1; } }), { message: 'AUTOMATIC_MERGE_DISABLED' });
  }
  assert.equal(reads, 0);
  const child = spawnSync(process.execPath, ['docs/platform-v7/autopilot/verify-pr-review-gate.mjs'], { encoding: 'utf8', env: { PATH: '/nonexistent' } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr.trim(), 'AUTOMATIC_MERGE_DISABLED');
});

test('zero AI reviews produces engineering readiness only; independent review and manual merge remain required', () => {
  const f = fixture();
  assert.deepEqual(verify(f), { schemaVersion: 'platform-v7.merge-readiness.v1', status: 'READY_FOR_MANUAL_REVIEW', head, independentReviewRequired: true, automaticMergeAllowed: false });
  assert.equal(mergeReadinessResult('short'), null);
  assert.equal(f.calls.some((args) => args.some((value) => /octopus-review|chatgpt\.com|api\.openai|copilot/u.test(value))), false);
});

test('native auto-merge cannot consume readiness, even if enabled during verification', () => {
  for (const auto_merge of [undefined, { enabled_by: 'fixture' }]) {
    const f = fixture(); f.data.pr.auto_merge = auto_merge;
    expectBlocked(f, 'AUTOMATIC_MERGE_DISABLED');
  }
  const f = fixture(); f.data.finalPr = { ...f.data.pr, auto_merge: {} };
  expectBlocked(f, 'AUTOMATIC_MERGE_DISABLED');
});

test('missing owner exact-head audit blocks and another actor cannot substitute it', () => {
  for (const comments of [[], [{ id: 1, user: { login: 'other' }, body: 'OWNER SELF-AUDIT: PASS exact head `' + head + '`' }], [{ id: 1, user: { login: 'pachaninm-lab' }, body: 'OWNER SELF-AUDIT: PASS exact head `' + oldHead + '`' }]]) expectBlocked(fixture({ comments }), 'MERGE_READINESS_OWNER_AUDIT_MISSING');
});

test('all current or outdated unresolved findings and active changes requested block', () => {
  for (const isOutdated of [true, false]) expectBlocked(fixture({ threads: [{ isResolved: false, isOutdated }] }), 'MERGE_READINESS_UNRESOLVED_THREADS');
  const request = { id: 1, state: 'CHANGES_REQUESTED', user: { login: 'independent' }, submitted_at: '2026-09-18T10:00:00Z' };
  expectBlocked(fixture({ reviews: [request] }), 'MERGE_READINESS_CHANGES_REQUESTED');
  const comment = { ...request, id: 2, state: 'COMMENTED', submitted_at: '2026-09-18T11:00:00Z' };
  expectBlocked(fixture({ reviews: [request, comment] }), 'MERGE_READINESS_CHANGES_REQUESTED');
  assert.equal(verify(fixture({ reviews: [request, { ...comment, state: 'APPROVED' }] })).status, 'READY_FOR_MANUAL_REVIEW');
});

test('review page two findings are not lost and malformed pages are rejected', () => {
  const request = { id: 2, state: 'CHANGES_REQUESTED', user: { login: 'independent' }, submitted_at: '2026-09-18T10:00:00Z' };
  expectBlocked(fixture({ reviewPages: [[], [request]] }), 'MERGE_READINESS_CHANGES_REQUESTED');
  for (const pages of [null, [], [[], {}], [[{ id: 1 }], [{ id: 1 }]]]) assert.throws(() => fetchAllList('repos/o/r/reviews', () => pages));
});

test('thread pagination requires a complete, exact-head, error-free chain', () => {
  const page = (hasNextPage, nodes = [], endCursor = 'cursor') => ({ data: { repository: { pullRequest: { headRefOid: head, reviewThreads: { nodes, pageInfo: { hasNextPage, endCursor } } } } } });
  expectBlocked(fixture({ threadPages: [page(true), page(false, [{ isResolved: false, isOutdated: false }])] }), 'MERGE_READINESS_UNRESOLVED_THREADS');
  for (const pages of [[page(true)], [page(false), page(false)], [{ errors: [{ message: 'private' }], ...page(false) }], [{ data: null }]]) assert.throws(() => fetchAllReviewThreads(repo, 5422, head, () => pages));
});

test('provider quota statuses and exact known review jobs are advisory; real findings still block', () => {
  const f = fixture();
  const providerRun = { ...f.data.run, id: 43, workflow_id: 2, name: 'Independent Octopus Review', path: '.github/workflows/octopus-independent-review.yml', conclusion: 'failure' };
  f.data.runs.push(providerRun);
  f.data.checks.push({ ...f.data.checks[0], id: 101, name: 'Octopus exact-head independent review', conclusion: 'failure', details_url: `https://github.com/${repo}/actions/runs/43/job/101` });
  f.data.statuses.push({ id: 1, context: 'review-provider/octopus', state: 'failure' }, { id: 2, context: 'review-provider/local-qwen', state: 'pending' });
  assert.equal(verify(f).status, 'READY_FOR_MANUAL_REVIEW');
  f.data.threads = [{ isResolved: false, isOutdated: false }];
  expectBlocked(f, 'MERGE_READINESS_UNRESOLVED_THREADS');
});

test('advisory names do not mask substantive jobs, security workflows, or unknown review contexts', () => {
  for (const change of [{ name: 'Octopus exact-head independent review' }, { name: 'security-test', workflowName: 'Independent Octopus Review' }]) {
    const f = fixture(); Object.assign(f.data.checks[0], change, { conclusion: 'failure' });
    expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
  }
  const f = fixture(); f.data.statuses = [{ id: 1, context: 'review-provider/unknown-security', state: 'failure' }];
  expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
  assert.equal(isIgnoredMergeGateCheck({ name: 'Exact-head clean-comment gate', workflowName: 'Security', workflowPath: '.github/workflows/security.yml', appSlug: 'github-actions' }), false);
});

test('unexpected security job inside known advisory workflow remains blocking', () => {
  const f = fixture();
  f.data.run.name = 'Independent Octopus Review'; f.data.run.path = '.github/workflows/octopus-independent-review.yml';
  f.data.checks[0].name = 'security'; f.data.checks[0].conclusion = 'failure';
  expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
});

test('legacy provider output without native findings is not a quota/schema veto or review PASS', () => {
  const f = fixture({ reviews: [{ id: 1, user: { login: 'github-actions[bot]' }, state: 'COMMENTED', submitted_at: '2026-09-18T10:00:00Z', body: 'LOCAL QWEN INDEPENDENT REVIEW: BLOCK\nMalformed provider output' }] });
  assert.equal(verify(f).independentReviewRequired, true);
});

test('CI is mandatory regardless of REQUIRE_GREEN_CI and never empty', () => {
  const f = fixture(); f.env.REQUIRE_GREEN_CI = '0'; f.data.checks[0].conclusion = 'failure';
  expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
  expectBlocked(fixture({ checks: [], runs: [], statuses: [] }), 'MERGE_READINESS_CI_EVIDENCE_MISSING');
});

test('full check pagination includes a failing security check after item 100', () => {
  const f = fixture();
  const rows = Array.from({ length: 101 }, (_, i) => ({ ...f.data.checks[0], id: i + 1, name: `job-${i}`, conclusion: i === 100 ? 'failure' : 'success' }));
  f.data.checkPages = [{ total_count: 101, check_runs: rows.slice(0, 100) }, { total_count: 101, check_runs: rows.slice(100) }];
  expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
  f.data.checkPages.pop();
  expectBlocked(f, 'MERGE_READINESS_CI_SNAPSHOT_INVALID');
});

test('new queued run with no check jobs prevents an older green from winning', () => {
  const f = fixture();
  f.data.runs.push({ ...f.data.run, id: 43, run_number: 11, status: 'queued', conclusion: null });
  expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
});

test('incomplete Actions inventory fails closed', () => {
  const f = fixture(); f.data.runPages = [{ total_count: 2, workflow_runs: [f.data.run] }];
  expectBlocked(f, 'MERGE_READINESS_CI_SNAPSHOT_INVALID');
});

test('Actions transport failure is distinct from malformed metadata and does not expose raw error', () => {
  const f = fixture({ fetchError: true });
  const snapshot = fetchCheckSnapshot(repo, 5422, f.read);
  assert.deepEqual(snapshot.runFetchErrors, [{ runId: '42', code: 'ACTIONS_RUN_FETCH_FAILED' }]);
  assert.equal(snapshot.checks, null);
  assert.equal(JSON.stringify(snapshot).includes('SYNTHETIC_SECRET'), false);
  expectBlocked(fixture({ fetchError: true }), 'MERGE_READINESS_CI_ACTIONS_RUN_FETCH_FAILED');
  for (const runOverride of [null, {}, { id: 42, name: 'guard' }]) {
    const broken = fixture({ runOverride });
    assert.deepEqual(fetchCheckSnapshot(repo, 5422, broken.read).runFetchErrors, []);
    expectBlocked(fixture({ runOverride }), 'MERGE_READINESS_CI_SNAPSHOT_INVALID');
  }
});

test('repository and exact head are validated before and after CI', () => {
  const cases = [
    ['MERGE_READINESS_REPO_AUTHORITY_MISMATCH', (f) => { f.env.GITHUB_REPOSITORY = 'other/repo'; }],
    ['MERGE_READINESS_EXPECTED_HEAD_INVALID', (f) => { f.env.HEAD_SHA = 'short'; }],
    ['MERGE_READINESS_PR_NOT_REVIEWABLE', (f) => { f.data.pr.state = 'closed'; }],
    ['MERGE_READINESS_PR_NOT_REVIEWABLE', (f) => { f.data.pr.draft = true; }],
    ['MERGE_READINESS_HEAD_MOVED', (f) => { f.data.pr.head.sha = oldHead; }],
    ['MERGE_READINESS_HEAD_MOVED_DURING_VERIFICATION', (f) => { f.data.finalPr = { ...f.data.pr, head: { ...f.data.pr.head, sha: oldHead } }; }],
  ];
  for (const [code, mutate] of cases) { const f = fixture(); mutate(f); expectBlocked(f, code); }
});

test('latest commit status selection uses monotonic identity and preserves non-provider failures', () => {
  const statuses = [{ id: 1, context: 'security', state: 'success' }, { id: 2, context: 'security', state: 'failure' }];
  assert.deepEqual(latestCommitStatuses(statuses), [statuses[1]]);
  assert.deepEqual(latestCommitStatuses([...statuses].reverse()), [statuses[1]]);
  expectBlocked(fixture({ statuses }), 'MERGE_READINESS_CI_NOT_GREEN');
});

test('workflow contains no merge or provider request and invokes only explicit manual readiness', () => {
  const workflow = readFileSync('.github/workflows/automerge.yml', 'utf8');
  assert.match(workflow, /--manual-readiness/u);
  assert.doesNotMatch(workflow, /gh pr merge|pulls\.merge|@codex review|requestReviewers|schedule:/u);
});

test('readiness self-check on PR head is advisory only with exact trusted-main workflow identity', () => {
  const f = fixture();
  const ownRun = { ...f.data.run, id: 43, head_sha: oldHead, head_branch: 'main', workflow_id: 2, name: 'Repo automations', path: '.github/workflows/automerge.yml', status: 'in_progress', conclusion: null };
  f.data.runs.push(ownRun);
  f.data.runPages = [{ total_count: 1, workflow_runs: [f.data.run] }];
  f.data.checks.push({ ...f.data.checks[0], id: 101, name: 'Exact-head clean-comment gate', status: 'in_progress', conclusion: null, details_url: `https://github.com/${repo}/actions/runs/43` });
  assert.equal(verify(f).status, 'READY_FOR_MANUAL_REVIEW');
  ownRun.path = '.github/workflows/security.yml';
  expectBlocked(f, 'MERGE_READINESS_CI_SNAPSHOT_INVALID');
});

test('pending, failed, cancelled, unknown and timed-out substantive checks stay blocking', () => {
  for (const [status, conclusion] of [['queued', null], ['in_progress', null], ['completed', 'failure'], ['completed', 'cancelled'], ['completed', 'timed_out'], ['completed', null]]) {
    const f = fixture(); Object.assign(f.data.checks[0], { status, conclusion });
    expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
  }
});

test('malformed Actions SHA cannot be normalized into authority', () => {
  const f = fixture(); f.data.run.head_sha = head.toUpperCase();
  expectBlocked(f, 'MERGE_READINESS_CI_SNAPSHOT_INVALID');
});
