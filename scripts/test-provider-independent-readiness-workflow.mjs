import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { nativeReadinessRunCandidates, nativeReadinessMatchesRun } from '../docs/platform-v7/autopilot/verify-pr-review-gate.mjs';

const workflowUrl = new URL('../.github/workflows/automerge.yml', import.meta.url);
const workflow = readFileSync(workflowUrl, 'utf8');
const marker = '          script: |\n';
assert.equal(workflow.split(marker).length, 2, 'one actual evaluator script');
const source = workflow.split(marker)[1].split('\n').map(line => line.startsWith('            ') ? line.slice(12) : line).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const evaluator = new AsyncFunction('require', 'context', 'github', 'core', source);
const HEAD = 'a'.repeat(40);
const OTHER_HEAD = 'b'.repeat(40);
const repository = { id: 91, full_name: 'fixture-owner/fixture-repo' };
const clone = value => structuredClone(value);
const basePr = () => ({
  number: 17, state: 'open', draft: false, auto_merge: null,
  head: { sha: HEAD }, base: { ref: 'main', repo: repository }, labels: [],
});
const contract = () => ({
  schemaVersion: 'platform-v7.merge-readiness.v1', status: 'READY_FOR_MANUAL_REVIEW',
  head: HEAD, independentReviewRequired: true, automaticMergeAllowed: false,
});
const outputFor = result => `MERGE_READINESS_RESULT=${JSON.stringify(result)}\n`;

async function runFixture(options = {}) {
  const calls = [];
  const logs = [];
  const failures = [];
  const pr = { ...basePr(), ...options.pr };
  const context = {
    repo: { owner: 'fixture-owner', repo: 'fixture-repo' },
    serverUrl: 'https://github.com', runId: 43,
    eventName: options.event || 'pull_request_target', actor: 'fixture-owner', ref: 'refs/heads/main',
    payload: { pull_request: clone(pr), repository, ...options.payload },
    ...options.context,
  };
  let reads = 0;
  const method = (name, handler) => async args => {
    calls.push({ name, args: clone(args) });
    if (options.apiError?.name === name) throw Object.assign(new Error('SYNTHETIC_PRIVATE_API_DETAIL'), { status: options.apiError.status || 503 });
    return handler(args);
  };
  const associatedMethod = method('associated', () => { throw new Error('pagination helper must be used'); });
  const github = {
    rest: {
      pulls: { get: method('get', () => ({ data: clone(reads++ ? (options.live || pr) : pr) })) },
      issues: { removeLabel: method('removeLabel', () => ({ data: [] })) },
      checks: {
        create: method('createCheck', () => ({ data: { id: 83 } })),
        update: method('updateCheck', () => ({ data: {} })),
      },
      repos: {
        createCommitStatus: method('createStatus', () => ({ data: {} })),
        listPullRequestsAssociatedWithCommit: associatedMethod,
      },
    },
    paginate: async (selected, args) => {
      assert.equal(selected, associatedMethod);
      calls.push({ name: 'paginate', args: clone(args) });
      return clone(options.associated || [pr]);
    },
  };
  const require = name => {
    assert.equal(name, 'node:child_process');
    return { execFileSync: (command, args, settings) => {
      calls.push({ name: 'verifier', command, args: clone(args), env: { REPO: settings.env.REPO, PR_NUMBER: settings.env.PR_NUMBER, HEAD_SHA: settings.env.HEAD_SHA, REQUIRE_GREEN_CI: settings.env.REQUIRE_GREEN_CI } });
      assert.equal(command, 'node');
      assert.deepEqual(args, ['docs/platform-v7/autopilot/verify-pr-review-gate.mjs', '--manual-readiness']);
      assert.deepEqual(settings.stdio, ['ignore', 'pipe', 'pipe']);
      assert.equal(settings.shell, undefined);
      if (options.verifierError) throw new Error('SYNTHETIC_PRIVATE_VERIFIER_DETAIL');
      return options.output ?? outputFor(contract());
    } };
  };
  let thrown;
  try {
    await evaluator(require, context, github, { info: value => logs.push(value), setFailed: value => failures.push(value) });
  } catch (error) {
    thrown = error;
  }
  return { calls, logs, failures, thrown };
}

const mutations = result => result.calls.filter(call => ['createCheck', 'updateCheck', 'createStatus', 'removeLabel'].includes(call.name));
const successfulChecks = result => result.calls.filter(call => call.name === 'updateCheck' && call.args.conclusion === 'success');
function assertBlocked(result) {
  assert.equal(result.thrown, undefined);
  assert.equal(successfulChecks(result).length, 0);
  assert.equal(result.calls.findLast(call => call.name === 'createStatus').args.state, 'failure');
  assert.equal(result.calls.findLast(call => call.name === 'updateCheck').args.conclusion, 'failure');
  assert.equal(result.failures.length, 1);
  assert.doesNotMatch([...result.logs, ...result.failures].join('\n'), /SYNTHETIC_PRIVATE/);
}

test('workflow retires providers and has no schedule, merging or dispatch loop', () => {
  for (const filename of ['local-qwen-independent-review.yml', 'octopus-independent-review.yml']) {
    assert.equal(existsSync(new URL(`../.github/workflows/${filename}`, import.meta.url)), false);
  }
  assert.doesNotMatch(workflow, /^\s*(schedule|repository_dispatch):/m);
  assert.doesNotMatch(workflow, /cron:|gh pr merge|pulls\.merge|mergePullRequest|enablePullRequestAutoMerge|createDispatch|addLabels/);
  assert.match(workflow, /^\s*contents: read$/m);
  assert.match(workflow, /^\s*pull-requests: read$/m);
  assert.match(workflow, /^\s*checks: write$/m);
  assert.match(workflow, /^\s*ref: main$/m);
  assert.match(workflow, /^\s*persist-credentials: false$/m);
  assert.doesNotMatch(source, /\$\{\{/);
  assert.match(workflow, /group: repo-engineering-readiness\n\s*cancel-in-progress: false\n\s*queue: max/);
  const events = workflow.split('\npermissions:')[0];
  assert.doesNotMatch(events, /^  pull_request(?:_review|_review_comment)?:/m);
  assert.match(events, /workflow_run:[\s\S]*types: \[completed\]/);
  assert.doesNotMatch(events, /- Repo automations|- Local Qwen Independent Review|- Independent Octopus Review/);
});

for (const event of ['pull_request_review', 'pull_request_review_comment', 'pull_request']) {
  test(`PR-selectable workflow event cannot publish readiness: ${event}`, async () => {
    const result = await runFixture({ event });
    assert.match(result.thrown?.message || '', /READINESS_EVENT_UNSUPPORTED/);
    assert.equal(mutations(result).length, 0);
    assert.equal(result.calls.some(call => call.name === 'verifier'), false);
  });
}

test('actual evaluator binds required native check and readiness status to exact head', async () => {
  const result = await runFixture();
  assert.equal(result.thrown, undefined);
  assert.equal(result.failures.length, 0);
  assert.equal(successfulChecks(result).length, 1);
  const created = result.calls.find(call => call.name === 'createCheck').args;
  assert.equal(created.name, 'Exact-head clean-comment gate');
  assert.equal(created.head_sha, HEAD);
  assert.equal(created.status, 'in_progress');
  for (const call of result.calls.filter(call => call.name === 'createStatus')) {
    assert.equal(call.args.sha, HEAD);
    assert.equal(call.args.context, 'merge-readiness/exact-head');
    assert.match(call.args.description, /manual/);
  }
  assert.deepEqual(result.calls.find(call => call.name === 'verifier').env,
    { REPO: repository.full_name, PR_NUMBER: '17', HEAD_SHA: HEAD, REQUIRE_GREEN_CI: '1' });
  assert.match(successfulChecks(result)[0].args.output.summary, /No independent-review approval or merge authority is issued/);
  assert.equal(result.calls.filter(call => call.name === 'get').length, 2);
});

test('removes obsolete admission labels without creating merge authority', async () => {
  const result = await runFixture({ pr: { labels: [{ name: 'review-gate-passed' }, { name: 'review-gate-bootstrap-passed' }, { name: 'unrelated' }] } });
  assert.deepEqual(result.calls.filter(call => call.name === 'removeLabel').map(call => call.args.name), ['review-gate-passed', 'review-gate-bootstrap-passed']);
  assert.equal(result.failures.length, 0);
});

test('label removal handles concurrent disappearance but rejects permission failure', async () => {
  const options = { pr: { labels: [{ name: 'review-gate-passed' }] } };
  const absent = await runFixture({ ...options, apiError: { name: 'removeLabel', status: 404 } });
  assert.equal(successfulChecks(absent).length, 1);
  const denied = await runFixture({ ...options, apiError: { name: 'removeLabel', status: 403 } });
  assert.match(denied.thrown.message, /READINESS_LABEL_INVALIDATION_FAILED/);
  assert.equal(successfulChecks(denied).length, 0);
});

for (const name of ['CI red', 'CI pending', 'active changes requested', 'unresolved thread', 'transport failure']) {
  test(`${name}: nonzero actual verifier invocation cannot publish success`, async () => assertBlocked(await runFixture({ verifierError: true })));
}

for (const [name, result] of [
  ['wrong head', { ...contract(), head: OTHER_HEAD }],
  ['review PASS', { ...contract(), status: 'PASS' }],
  ['independent review omitted', { ...contract(), independentReviewRequired: false }],
  ['automatic merge allowed', { ...contract(), automaticMergeAllowed: true }],
  ['extra authority', { ...contract(), reviewAuthority: 'CODEX' }],
  ['wrong schema', { ...contract(), schemaVersion: 'platform-v7.review-gate-result.v1' }],
  ['array contract', [contract()]],
]) {
  test(`rejects verifier contract: ${name}`, async () => assertBlocked(await runFixture({ output: outputFor(result) })));
}

for (const [name, output] of [
  ['missing', 'PR_REVIEW_GATE=PASS\n'],
  ['duplicate', outputFor(contract()).repeat(2)],
  ['malformed', 'MERGE_READINESS_RESULT={\n'],
]) {
  test(`rejects ${name} readiness result`, async () => assertBlocked(await runFixture({ output })));
}

for (const [name, change] of [
  ['head moves', { head: { sha: OTHER_HEAD } }],
  ['becomes draft', { draft: true }],
  ['closes', { state: 'closed' }],
  ['changes base', { base: { ref: 'release', repo: repository } }],
  ['native automerge becomes enabled', { auto_merge: { enabled_by: { login: 'fixture-owner' } } }],
  ['native automerge metadata disappears', { auto_merge: undefined }],
]) {
  test(`live state race: ${name} cannot publish success`, async () => assertBlocked(await runFixture({ live: { ...basePr(), ...change } })));
}

for (const [name, change] of [
  ['draft', { draft: true }], ['closed', { state: 'closed' }], ['automerge enabled', { auto_merge: {} }],
  ['automerge metadata missing', { auto_merge: undefined }],
]) {
  test(`initial PR ${name} cannot invoke readiness verifier`, async () => {
    const result = await runFixture({ pr: change });
    assertBlocked(result);
    assert.equal(result.calls.some(call => call.name === 'verifier'), false);
  });
}

test('stale event never republishes a result for a different head', async () => {
  const result = await runFixture({ payload: { pull_request: { number: 17, head: { sha: OTHER_HEAD } } } });
  assert.equal(result.thrown, undefined);
  assert.equal(mutations(result).length, 0);
});

test('foreign base repository is rejected before mutations', async () => {
  const result = await runFixture({ pr: { base: { ref: 'main', repo: { full_name: 'foreign/repo' } } } });
  assert.match(result.thrown.message, /READINESS_PR_INVALID/);
  assert.equal(mutations(result).length, 0);
});

test('owner exact comment re-evaluates without using comment text as code', async () => {
  const result = await runFixture({ event: 'issue_comment', payload: { issue: { number: 17, pull_request: {} }, comment: { user: { login: 'fixture-owner' }, author_association: 'OWNER', body: '/merge-readiness' } } });
  assert.equal(successfulChecks(result).length, 1);
});

for (const comment of [
  { user: { login: 'attacker' }, author_association: 'CONTRIBUTOR', body: '/merge-readiness' },
  { user: { login: 'fixture-owner' }, author_association: 'OWNER', body: '/merge-readiness; $(touch marker)' },
  { user: { login: 'fixture-owner' }, author_association: 'MEMBER', body: '/merge-readiness' },
]) {
  test(`unauthorized comment ignored: ${comment.user.login} ${comment.author_association} ${comment.body}`, async () => {
    const result = await runFixture({ event: 'issue_comment', payload: { issue: { number: 17, pull_request: {} }, comment } });
    assert.equal(result.calls.length, 0);
  });
}

test('manual dispatch is owner/main/strict-number bound', async () => {
  const valid = await runFixture({ event: 'workflow_dispatch', payload: { inputs: { pr_number: '17' } } });
  assert.equal(successfulChecks(valid).length, 1);
  for (const context of [{ actor: 'attacker' }, { ref: 'refs/heads/untrusted' }]) {
    const denied = await runFixture({ event: 'workflow_dispatch', context, payload: { inputs: { pr_number: '17' } } });
    assert.match(denied.thrown.message, /READINESS_MANUAL_AUTHORITY_INVALID/);
    assert.equal(mutations(denied).length, 0);
  }
  const injection = await runFixture({ event: 'workflow_dispatch', payload: { inputs: { pr_number: '17; touch marker' } } });
  assert.match(injection.thrown.message, /READINESS_CANDIDATE_INVALID/);
  assert.equal(mutations(injection).length, 0);
});

const workflowRun = overrides => ({ repository, head_sha: HEAD, name: 'CI', pull_requests: [], ...overrides });
test('CI completion uses paginated commit associations and exact live PR', async () => {
  const result = await runFixture({ event: 'workflow_run', payload: { workflow_run: workflowRun() } });
  assert.equal(result.calls.filter(call => call.name === 'paginate').length, 1);
  assert.equal(result.calls.find(call => call.name === 'paginate').args.commit_sha, HEAD);
  assert.equal(successfulChecks(result).length, 1);
});

test('CI payload PR association uses bound head and avoids commit association fallback', async () => {
  const result = await runFixture({ event: 'workflow_run', payload: { workflow_run: workflowRun({ pull_requests: [{ number: 17, head: { sha: HEAD } }] }) } });
  assert.equal(result.calls.some(call => call.name === 'paginate'), false);
  assert.equal(successfulChecks(result).length, 1);
});

test('foreign workflow run is rejected and own/provider workflows never recurse', async () => {
  const foreign = await runFixture({ event: 'workflow_run', payload: { workflow_run: workflowRun({ repository: { id: 92 } }) } });
  assert.match(foreign.thrown.message, /READINESS_RUN_INVALID/);
  assert.equal(mutations(foreign).length, 0);
  for (const name of ['Repo automations', 'Local Qwen Independent Review', 'Independent Octopus Review']) {
    const result = await runFixture({ event: 'workflow_run', payload: { workflow_run: workflowRun({ name }) } });
    assert.equal(result.calls.length, 0);
  }
});

test('conflicting CI association heads fail before publication', async () => {
  const result = await runFixture({ event: 'workflow_run', payload: { workflow_run: workflowRun({ pull_requests: [{ number: 17, head: { sha: HEAD } }, { number: 17, head: { sha: OTHER_HEAD } }] }) } });
  assert.match(result.thrown.message, /READINESS_CANDIDATE_CONFLICT/);
  assert.equal(mutations(result).length, 0);
});

test('failed publication cannot complete required check as successful', async () => {
  const result = await runFixture({ apiError: { name: 'createStatus' } });
  assert.ok(result.thrown);
  assert.equal(successfulChecks(result).length, 0);
  assert.equal(result.calls.find(call => call.name === 'createCheck').args.status, 'in_progress');
});

test('actual publisher pending check is recognized by native provenance verifier', async () => {
  const result = await runFixture();
  const published = result.calls.find(call => call.name === 'createCheck').args;
  const pending = result.calls.find(call => call.name === 'createStatus').args;
  const repo = repository.full_name;
  const time = '2026-09-18T16:00:00Z';
  const check = { ...published, id: 83, details_url: `https://github.com/${repo}/runs/83`,
    conclusion: null, started_at: time, completed_at: null,
    app: { id: 15368, slug: 'github-actions' },
    output: { ...published.output, text: null, annotations_count: 0 } };
  const status = { ...pending, created_at: time,
    creator: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' } };
  const binding = nativeReadinessRunCandidates(check, [status], repo, 17, HEAD);
  assert.equal(binding?.runId, '43');
  const run = { id: 43, repository, head_repository: repository,
    name: 'Repo automations', path: '.github/workflows/automerge.yml',
    head_sha: HEAD, head_branch: 'main', event: 'workflow_run',
    workflow_id: 7, run_number: 9, run_attempt: 1, status: 'in_progress',
    created_at: time, updated_at: time };
  assert.equal(nativeReadinessMatchesRun(binding, run, repo, 17, HEAD, 'fix/test'), true);
  assert.equal(nativeReadinessRunCandidates({ ...check, external_id: '' }, [status], repo, 17, HEAD), null);
  assert.equal(nativeReadinessMatchesRun(binding, { ...run, path: '.github/workflows/foreign.yml' }, repo, 17, HEAD, 'fix/test'), false);
});
