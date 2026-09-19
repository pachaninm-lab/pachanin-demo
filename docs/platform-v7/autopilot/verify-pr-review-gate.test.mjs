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
  nativeReadinessRunCandidates, nativeReadinessMatchesRun,
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
      if (endpoint.includes('/attempts/')) {
        if (!data.attempts?.[endpoint.split('/').at(-1)]) throw new Error('Attempt not found');
        return data.attempts[endpoint.split('/').at(-1)];
      }
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

function scopeGuardFixture() {
  const f = fixture();
  const run = f.data.run;
  Object.assign(run, { event: 'pull_request_target', run_attempt: 1, check_suite_id: 77,
    repository: { id: 88, full_name: repo }, head_repository: { id: 88, full_name: repo },
    run_started_at: '2026-09-18T12:00:00Z', updated_at: '2026-09-18T12:02:00Z',
    pull_requests: [{ number: 5422, head: { sha: head, ref: exactHeadRef, repo: { id: 88 } }, base: { sha: oldHead, ref: 'main', repo: { id: 88 } } }],
  });
  const peer = f.data.checks[0];
  Object.assign(peer, { name: 'PC-CROP implementation immutable scope · trusted base', app: { id: 15368, slug: 'github-actions' },
    check_suite: { id: 77 }, completed_at: '2026-09-18T12:01:30Z' });
  const native = { id: 101, name: 'guard', head_sha: head, app: { id: 15368, slug: 'github-actions' },
    status: 'completed', conclusion: 'success', started_at: '2026-09-18T12:01:01Z', completed_at: '2026-09-18T12:01:01Z',
    details_url: `https://github.com/${repo}/runs/101`,
    external_id: `platform-v7.scope-guard.v1:pr:5422:head:${head}:base:${oldHead}:run:42:attempt:1`,
    output: { title: 'PC-CROP immutable scope accepted', summary: 'The exact PR head satisfies the immutable scope recorded in the trusted base.', annotations_count: 0, text: null },
  };
  const status = { id: 102, context: 'scope-guard/exact-head', state: 'success', created_at: '2026-09-18T12:01:00Z',
    description: 'Trusted-base immutable scope result; exact PR head and workflow run required',
    target_url: `https://github.com/${repo}/actions/runs/42`, creator: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' } };
  f.data.checks.push(native); f.data.statuses.push(status);
  return { ...f, native, peer, status };
}

test('bound native scope guard stays substantive and preserves manual-only readiness', () => {
  const f = scopeGuardFixture();
  const snapshot = fetchCheckSnapshot(repo, 5422, f.read);
  assert.ok(Array.isArray(snapshot.checks));
  assert.ok(snapshot.checks.some(check => check.name === 'guard' && check.workflowPath === '.github/workflows/platform-v7-autopilot-guard.yml'));
  assert.deepEqual(checkRollupBlockers(snapshot.checks), []);
  assert.equal(verify(f).automaticMergeAllowed, false);
});

test('native scope provenance rejects missing, forged, stale and ambiguous evidence', () => {
  const mutations = [
    f => { f.native.external_id = ''; },
    f => { f.native.external_id = f.native.external_id.replace('pr:5422', 'pr:5423'); },
    f => { f.native.external_id = f.native.external_id.replace('attempt:1', 'attempt:2'); },
    f => { f.native.app.id = 1; },
    f => { f.native.details_url += '?forged=1'; },
    f => { f.native.output.summary = 'success'; },
    f => { f.data.statuses = []; },
    f => { f.status.creator.id = 1; },
    f => { f.status.target_url = `https://github.com/${repo}/actions/runs/43`; },
    f => { f.status.created_at = '2026-09-18T11:59:59Z'; },
    f => { f.status.created_at = '2026-09-18T12:01:02Z'; },
    f => { f.data.run.event = 'pull_request'; },
    f => { f.data.run.path = '.github/workflows/other.yml'; },
    f => { f.data.run.head_repository.full_name = 'attacker/fork'; },
    f => { f.data.run.pull_requests[0].base.sha = head; },
    f => { f.data.run.pull_requests[0].head.repo.id = 99; },
    f => { f.peer.conclusion = 'skipped'; },
    f => { f.peer.check_suite.id = 78; },
    f => { f.peer.completed_at = '2026-09-18T12:00:59Z'; },
    f => { f.data.checks.push({ ...f.peer, id: 103 }); },
  ];
  for (const mutate of mutations) {
    const f = scopeGuardFixture(); mutate(f);
    const snapshot = fetchCheckSnapshot(repo, 5422, f.read);
    assert.equal(snapshot.checks, null, mutate.toString());
    assert.equal(snapshot.metadataError, 'NATIVE_CHECK_PROVENANCE_INVALID', mutate.toString());
  }
});

test('bound failed scope guard and unrelated pending CI still block', () => {
  const f = scopeGuardFixture();
  f.native.conclusion = f.peer.conclusion = f.status.state = 'failure';
  f.native.output.title = 'PC-CROP immutable scope rejected';
  f.native.output.summary = 'The base-controlled immutable scope check failed closed.';
  f.data.run.conclusion = 'failure';
  const snapshot = fetchCheckSnapshot(repo, 5422, f.read);
  assert.ok(Array.isArray(snapshot.checks));
  assert.ok(checkRollupBlockers(snapshot.checks).some(value => value.includes('guard:FAILURE')));
  const pending = scopeGuardFixture();
  pending.data.checks.push({ ...pending.peer, id: 103, name: 'security', status: 'in_progress', conclusion: null });
  assert.ok(checkRollupBlockers(fetchCheckSnapshot(repo, 5422, pending.read).checks).some(value => value.includes('security:IN_PROGRESS')));
});

test('reruns verify historical native guard provenance before selecting latest attempt', () => {
  const f = scopeGuardFixture();
  f.data.attempts = { 1: structuredClone(f.data.run) };
  f.data.run.run_attempt = 2;
  f.data.run.run_started_at = '2026-09-18T12:03:00Z';
  f.data.run.updated_at = '2026-09-18T12:05:00Z';
  f.data.checks.push({ ...f.peer, id: 103, started_at: '2026-09-18T12:03:00Z', completed_at: '2026-09-18T12:04:30Z' });
  f.data.checks.push({ ...structuredClone(f.native), id: 104, details_url: `https://github.com/${repo}/runs/104`,
    external_id: f.native.external_id.replace('attempt:1', 'attempt:2'),
    started_at: '2026-09-18T12:04:01Z', completed_at: '2026-09-18T12:04:01Z' });
  f.data.statuses.push({ ...f.status, id: 105, created_at: '2026-09-18T12:04:00Z' });
  const snapshot = fetchCheckSnapshot(repo, 5422, f.read);
  assert.ok(Array.isArray(snapshot.checks));
  assert.deepEqual(snapshot.checks.filter(check => check.name === 'guard').map(check => check.id), [104]);
  assert.deepEqual(checkRollupBlockers(snapshot.checks), []);
  // A proven historical failure can be superseded only by the later valid attempt.
  f.native.conclusion = f.peer.conclusion = f.status.state = 'failure';
  f.native.output.title = 'PC-CROP immutable scope rejected';
  f.native.output.summary = 'The base-controlled immutable scope check failed closed.';
  f.data.attempts[1].conclusion = 'failure';
  assert.deepEqual(checkRollupBlockers(fetchCheckSnapshot(repo, 5422, f.read).checks), []);
  f.native.conclusion = f.peer.conclusion = f.status.state = 'success';
  f.native.output.title = 'PC-CROP immutable scope accepted';
  f.native.output.summary = 'The exact PR head satisfies the immutable scope recorded in the trusted base.';
  f.data.attempts[1].conclusion = 'success';
  const latest = f.data.checks.find(check => check.id === 104);
  latest.conclusion = f.data.checks.find(check => check.id === 103).conclusion = f.data.statuses[1].state = 'failure';
  latest.output.title = 'PC-CROP immutable scope rejected';
  latest.output.summary = 'The base-controlled immutable scope check failed closed.';
  f.data.run.conclusion = 'failure';
  assert.ok(checkRollupBlockers(fetchCheckSnapshot(repo, 5422, f.read).checks).some(value => value.includes('guard:FAILURE')));
  f.data.attempts[1].head_sha = oldHead;
  assert.equal(fetchCheckSnapshot(repo, 5422, f.read).metadataError, 'NATIVE_CHECK_PROVENANCE_INVALID');
  delete f.data.attempts[1];
  assert.deepEqual(fetchCheckSnapshot(repo, 5422, f.read).runFetchErrors, [{ runId: '42', code: 'ACTIONS_RUN_ATTEMPT_FETCH_FAILED' }]);
});

test('trusted-base emitter publishes matching bounded native scope provenance', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/platform-v7-autopilot-guard.yml', import.meta.url), 'utf8');
  const emitter = workflow.slice(workflow.indexOf('      - name: Emit required guard context from trusted base on the PR head'), workflow.indexOf('      - name: Enforce trusted immutable-scope result'));
  assert.match(emitter, /platform-v7\.scope-guard\.v1:pr:\$PR_NUMBER:head:\$HEAD_SHA:base:\$BASE_SHA:run:\$GITHUB_RUN_ID:attempt:\$GITHUB_RUN_ATTEMPT/);
  assert.match(emitter, /context='scope-guard\/exact-head'/);
  assert.match(emitter, /-f "external_id=\$binding"/);
  assert.ok(emitter.indexOf('statuses/$HEAD_SHA') < emitter.indexOf('check-runs'));
  assert.match(workflow, /checks: write\n      statuses: write\n      contents: read/);
});

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

// Actual GitHub response shape from #5422 check 105669150123: checks.create's
// requested /actions/runs URL was rewritten to /runs/<check-id>, with no external_id.
const observedHead = 'ed9306da7d2ef5536c50b3a97ff26e6f4ea3b38d';
const observedNativeCheck = {
  id: 105669150123, name: 'Exact-head clean-comment gate', head_sha: observedHead, external_id: '',
  details_url: `https://github.com/${repo}/runs/105669150123`,
  status: 'completed', conclusion: 'failure', started_at: '2026-09-18T16:03:48Z', completed_at: '2026-09-18T16:03:54Z',
  app: { id: 15368, slug: 'github-actions' }, check_suite: { id: 95717609014 },
  output: { title: 'Engineering readiness blocked', summary: `PR #5422; exact head ${observedHead}. Engineering readiness blocked; manual merge is not ready. No independent-review approval or merge authority is issued.`, text: null, annotations_count: 0 },
};
const observedReadinessStatus = {
  id: 54461440856, context: 'merge-readiness/exact-head', state: 'failure',
  description: 'Engineering readiness blocked; manual merge is not ready',
  target_url: `https://github.com/${repo}/actions/runs/35366171823`, created_at: '2026-09-18T16:03:53Z',
  creator: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
};
const observedPublisherRun = {
  id: 35366171823, name: 'Repo automations', path: '.github/workflows/automerge.yml',
  repository: { full_name: repo }, head_repository: { full_name: repo },
  head_sha: 'e7f42bbdbceedd9c384d78a3e3a2a81f3c12a38d', head_branch: 'main', event: 'issue_comment',
  status: 'completed', conclusion: 'failure', workflow_id: 259435281, run_number: 40936, run_attempt: 1,
  created_at: '2026-09-18T16:03:33Z', updated_at: '2026-09-18T16:03:57Z',
};
function nativeFixture() {
  const f = fixture();
  const check = structuredClone(observedNativeCheck);
  check.head_sha = head; check.output.summary = check.output.summary.replace(observedHead, head);
  const status = structuredClone(observedReadinessStatus);
  const publisher = structuredClone(observedPublisherRun);
  f.data.checks.push(check); f.data.statuses.push(status); f.data.runs.push(publisher);
  // Trusted-main publisher is fetched via status binding, not the exact-PR-head inventory.
  f.data.runPages = [{ total_count: 1, workflow_runs: [f.data.run] }];
  return { ...f, nativeCheck: check, readinessStatus: status, publisher };
}

test('observed GitHub rewritten native check is correlated without treating check ID as workflow run ID', () => {
  const binding = nativeReadinessRunCandidates(observedNativeCheck, [observedReadinessStatus], repo, 5422, observedHead);
  assert.equal(binding.runId, '35366171823');
  assert.notEqual(binding.runId, String(observedNativeCheck.id));
  assert.equal(nativeReadinessMatchesRun(binding, observedPublisherRun, repo, 5422, observedHead, 'fix/provider-review-scope-guard-20260918'), true);
  const f = nativeFixture();
  assert.equal(verify(f).status, 'READY_FOR_MANUAL_REVIEW');
  assert.ok(f.calls.some(args => args.includes(`repos/${repo}/actions/runs/35366171823`)));
  assert.equal(f.calls.some(args => args.includes(`repos/${repo}/actions/runs/105669150123`)), false);
});

test('new explicit external_id safely identifies an in-progress rewritten readiness check', () => {
  const f = nativeFixture();
  Object.assign(f.nativeCheck, { status: 'in_progress', conclusion: null, completed_at: null,
    external_id: `platform-v7.merge-readiness.v1:pr:5422:head:${head}:run:35366171823`,
    output: { title: 'Engineering readiness evaluation', summary: 'Independent review and a manual exact-SHA merge remain required.', text: null, annotations_count: 0 } });
  Object.assign(f.readinessStatus, { state: 'pending', created_at: '2026-09-18T16:03:49Z', description: 'Engineering readiness is being evaluated; manual review remains required' });
  Object.assign(f.publisher, { status: 'in_progress', conclusion: null, updated_at: '2026-09-18T16:03:35Z' });
  assert.equal(verify(f).status, 'READY_FOR_MANUAL_REVIEW');
  f.nativeCheck.external_id = '';
  expectBlocked(f, 'MERGE_READINESS_CI_NATIVE_CHECK_PROVENANCE_INVALID');
});

test('pull_request_target publisher requires the matching PR/head/ref tuple', () => {
  const f = nativeFixture();
  f.nativeCheck.external_id = `platform-v7.merge-readiness.v1:pr:5422:head:${head}:run:35366171823`;
  Object.assign(f.publisher, { event: 'pull_request_target', head_sha: head, head_branch: exactHeadRef,
    pull_requests: [{ number: 5422, head: { sha: head, ref: exactHeadRef }, base: { ref: 'main' } }] });
  assert.equal(verify(f).status, 'READY_FOR_MANUAL_REVIEW');
  f.publisher.pull_requests[0].number = 9999;
  expectBlocked(f, 'MERGE_READINESS_CI_NATIVE_CHECK_PROVENANCE_INVALID');
});

test('legacy attribution retains historical statuses rather than only the latest context value', () => {
  const f = nativeFixture();
  f.data.statuses.unshift({ ...f.readinessStatus, id: f.readinessStatus.id + 1,
    created_at: '2026-09-18T17:00:00Z', target_url: `https://github.com/${repo}/actions/runs/42` });
  assert.equal(verify(f).status, 'READY_FOR_MANUAL_REVIEW');
});

test('a name, rewritten URL or shared Actions app alone cannot suppress another check', () => {
  const mutations = [
    c => { c.app.id = 999; }, c => { c.name = 'security'; }, c => { c.output.title = 'Security check'; },
    c => { c.output.annotations_count = 1; }, c => { c.output.text = 'real finding'; },
    c => { c.output.summary += ' Additional finding'; }, c => { c.details_url += '?untrusted=1'; },
    c => { c.external_id = 42; }, c => { c.external_id = 'invalid'; },
    c => { c.external_id = `platform-v7.merge-readiness.v1:pr:9999:head:${head}:run:35366171823`; },
    c => { c.external_id = `platform-v7.merge-readiness.v1:pr:5422:head:${oldHead}:run:35366171823`; },
    c => { c.external_id = `platform-v7.merge-readiness.v1:pr:5422:head:${head}:run:123`; },
  ];
  for (const mutate of mutations) { const f = nativeFixture(); mutate(f.nativeCheck); expectBlocked(f, 'MERGE_READINESS_CI_NATIVE_CHECK_PROVENANCE_INVALID'); }
});

test('native correlation rejects absent, foreign, ambiguous or out-of-window status evidence', () => {
  for (const mutate of [
    f => { f.data.statuses = []; }, f => { f.readinessStatus.creator.id = 1; },
    f => { f.readinessStatus.creator.login = 'owner'; }, f => { f.readinessStatus.created_at = '2026-09-18T16:03:47Z'; },
    f => { f.readinessStatus.created_at = '2026-09-18T16:03:55Z'; },
    f => { f.readinessStatus.target_url = 'https://github.com/foreign/repo/actions/runs/35366171823'; },
    f => { f.readinessStatus.description = 'looks ready'; },
    f => { f.data.statuses.push({ ...f.readinessStatus, id: f.readinessStatus.id + 1, target_url: `https://github.com/${repo}/actions/runs/42` }); },
  ]) { const f = nativeFixture(); mutate(f); expectBlocked(f, 'MERGE_READINESS_CI_NATIVE_CHECK_PROVENANCE_INVALID'); }
});

test('native correlation still verifies trusted workflow metadata and event provenance', () => {
  for (const changes of [
    { name: 'Security' }, { path: '.github/workflows/security.yml' }, { event: 'pull_request' },
    { head_branch: 'untrusted' }, { head_sha: 'malformed' }, { head_repository: { full_name: 'foreign/repo' } },
    { created_at: '2026-09-18T16:03:49Z' }, { updated_at: '2026-09-18T16:03:52Z' },
    { run_attempt: 0 }, { status: 'queued' },
  ]) { const f = nativeFixture(); Object.assign(f.publisher, changes); expectBlocked(f, 'MERGE_READINESS_CI_NATIVE_CHECK_PROVENANCE_INVALID'); }
});

test('valid native self-check attribution never hides a substantive security failure', () => {
  const f = nativeFixture(); f.data.checks[0].name = 'security'; f.data.checks[0].conclusion = 'failure';
  expectBlocked(f, 'MERGE_READINESS_CI_NOT_GREEN');
});
