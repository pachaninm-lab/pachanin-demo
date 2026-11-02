import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_SECURITY_QUALITY_JOBS,
  collectStatusCheckContexts,
  captureNativeSecurityCandidate,
  selectSecurityQualityCandidate,
} from './capture-base-security-jobs.mjs';

const EXACT_HEAD = 'd79064333ff5653baa43528fd6a956bd9b2fbb87';

function check({
  id,
  name,
  runId,
  runNumber = Number(runId),
  attempt = 1,
  event = 'pull_request',
  status = 'COMPLETED',
  conclusion = 'SUCCESS',
  suiteId = Number(runId) * 10 + attempt,
  suiteStatus = 'COMPLETED',
  suiteConclusion = 'SUCCESS',
}) {
  return {
    __typename: 'CheckRun',
    databaseId: id,
    name,
    status,
    conclusion,
    detailsUrl: `https://github.invalid/check/${id}`,
    checkSuite: {
      databaseId: suiteId,
      status: suiteStatus,
      conclusion: suiteConclusion,
      app: { slug: 'github-actions' },
      workflowRun: {
        databaseId: runId,
        event,
        runAttempt: attempt,
        runNumber,
        url: `https://github.invalid/run/${runId}`,
        workflow: { name: 'Security Quality Gate' },
      },
    },
  };
}

function coherentRun({
  runId,
  attempt = 1,
  event = 'pull_request',
  conclusion = 'SUCCESS',
  status = 'COMPLETED',
  suiteId = Number(runId) * 10 + attempt,
}) {
  return REQUIRED_SECURITY_QUALITY_JOBS.map((name, index) => check({
    id: Number(runId) * 100 + attempt * 10 + index,
    name,
    runId,
    attempt,
    event,
    status,
    conclusion,
    suiteId,
    suiteStatus: status,
    suiteConclusion: conclusion,
  }));
}

async function provesPaginationBeyondOneHundredContexts() {
  const cursors = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    __typename: 'StatusContext',
    context: `unrelated-${index}`,
  }));
  const secondPage = coherentRun({ runId: 200 });
  const nodes = await collectStatusCheckContexts({
    exactHead: EXACT_HEAD,
    fetchPage: async (after) => {
      cursors.push(after);
      if (after === null) {
        return {
          oid: EXACT_HEAD,
          contexts: {
            nodes: firstPage,
            pageInfo: { hasNextPage: true, endCursor: 'page-2' },
          },
        };
      }
      return {
        oid: EXACT_HEAD,
        contexts: {
          nodes: secondPage,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
  });
  assert.equal(nodes.length, 103);
  assert.deepEqual(cursors, [null, 'page-2']);
  assert.equal(selectSecurityQualityCandidate(nodes).state, 'SELECTED');
}

function selectsOneDeterministicRunAcrossPushAndPullRequestSuites() {
  const decision = selectSecurityQualityCandidate([
    ...coherentRun({ runId: 201, event: 'push' }),
    ...coherentRun({ runId: 202, event: 'pull_request' }),
  ]);
  assert.equal(decision.state, 'SELECTED');
  assert.equal(String(decision.selected.workflowRunId), '202');
  assert.equal(new Set(decision.selected.checks.map((item) => item.workflowRunId)).size, 1);
}

function usesTheLatestEffectiveStateAcrossAPartialRerun() {
  const firstAttempt = coherentRun({ runId: 203, attempt: 1, conclusion: 'FAILURE' });
  firstAttempt[0].conclusion = 'SUCCESS';
  firstAttempt[1].conclusion = 'SUCCESS';
  const rerunAggregate = check({
    id: 20399,
    name: REQUIRED_SECURITY_QUALITY_JOBS[2],
    runId: 203,
    attempt: 2,
    conclusion: 'SUCCESS',
    suiteConclusion: 'SUCCESS',
  });
  const decision = selectSecurityQualityCandidate([...firstAttempt, rerunAggregate]);
  assert.equal(decision.state, 'SELECTED');
  assert.equal(decision.selected.workflowRunAttempt, 2);
  assert.deepEqual(
    decision.selected.required.map((item) => item.workflowRunAttempt),
    [1, 1, 2],
  );
  assert.ok(decision.selected.required.every((item) => item.conclusion === 'success'));
}

function latestDuplicateCheckWinsInsideOneRun() {
  const firstAttempt = coherentRun({ runId: 204, attempt: 1 });
  const supersededFailure = check({
    id: 20499,
    name: REQUIRED_SECURITY_QUALITY_JOBS[2],
    runId: 204,
    attempt: 2,
    conclusion: 'FAILURE',
    suiteId: 2041,
    suiteConclusion: 'FAILURE',
  });
  const latestSuccess = check({
    id: 20500,
    name: REQUIRED_SECURITY_QUALITY_JOBS[2],
    runId: 204,
    attempt: 2,
    conclusion: 'SUCCESS',
    suiteId: 2042,
    suiteConclusion: 'SUCCESS',
  });
  const decision = selectSecurityQualityCandidate([
    ...firstAttempt,
    supersededFailure,
    latestSuccess,
  ]);
  assert.equal(decision.state, 'SELECTED');
  assert.equal(decision.selected.required[2].databaseId, 20500);
  assert.equal(decision.selected.checks.filter(
    (item) => item.name === REQUIRED_SECURITY_QUALITY_JOBS[2],
  ).length, 1);
}

function successfulRunWinsOverFailedAndActiveRuns() {
  const active = coherentRun({
    runId: 206,
    status: 'IN_PROGRESS',
    conclusion: null,
  });
  const decision = selectSecurityQualityCandidate([
    ...coherentRun({ runId: 205, conclusion: 'FAILURE' }),
    ...active,
    ...coherentRun({ runId: 207 }),
  ]);
  assert.equal(decision.state, 'SELECTED');
  assert.equal(String(decision.selected.workflowRunId), '207');
}

function waitsOnlyWhileACandidateCanStillComplete() {
  const decision = selectSecurityQualityCandidate(coherentRun({
    runId: 208,
    status: 'IN_PROGRESS',
    conclusion: null,
  }));
  assert.equal(decision.state, 'WAIT');
  assert.equal(decision.candidates[0].canStillComplete, true);
}

function waitsWhileTheRollupHasNotIndexedAnyCandidate() {
  const decision = selectSecurityQualityCandidate([]);
  assert.equal(decision.state, 'WAIT');
}

function failsClosedWhenAllCoherentRunsFailed() {
  const decision = selectSecurityQualityCandidate([
    ...coherentRun({ runId: 209, conclusion: 'FAILURE' }),
    ...coherentRun({ runId: 210, conclusion: 'CANCELLED' }),
  ]);
  assert.equal(decision.state, 'FAILED');
  assert.equal(decision.selected, null);
}

function failsClosedWhenOnlyCompletedIncompleteRunsExist() {
  const incomplete = coherentRun({ runId: 211 }).slice(0, 2);
  const decision = selectSecurityQualityCandidate(incomplete);
  assert.equal(decision.state, 'FAILED');
  assert.deepEqual(decision.candidates[0].missing, [REQUIRED_SECURITY_QUALITY_JOBS[2]]);
}

async function enforcesStrictPaginationBound() {
  await assert.rejects(
    collectStatusCheckContexts({
      exactHead: EXACT_HEAD,
      maxPages: 2,
      fetchPage: async () => ({
        oid: EXACT_HEAD,
        contexts: {
          nodes: [],
          pageInfo: { hasNextPage: true, endCursor: 'next' },
        },
      }),
    }),
    /strict 2-page capture bound/u,
  );
}

const NATIVE_REPOSITORY = 'pachaninm-lab/pachanin-demo';
function nativeRun(overrides = {}) {
  return { id: 901, head_sha: EXACT_HEAD, head_branch: 'fix/gekta-owned-example',
    repository: { full_name: NATIVE_REPOSITORY }, head_repository: { full_name: NATIVE_REPOSITORY },
    name: 'Security Quality Gate', path: '.github/workflows/security-quality-gate.yml',
    event: 'pull_request', workflow_id: 81, run_number: 9, run_attempt: 1, check_suite_id: 9011,
    status: 'completed', conclusion: 'success', updated_at: '2026-11-01T09:02:22Z',
    html_url: `https://github.com/${NATIVE_REPOSITORY}/actions/runs/901`, ...overrides };
}
function nativeJobs(run = nativeRun()) {
  return REQUIRED_SECURITY_QUALITY_JOBS.map((name, i) => ({ id: 9100 + i, name,
    run_id: run.id, head_sha: run.head_sha, head_branch: run.head_branch,
    workflow_name: run.name, run_attempt: run.run_attempt, status: 'completed', conclusion: 'success',
    html_url: `https://github.com/${NATIVE_REPOSITORY}/actions/runs/${run.id}/job/${9100 + i}` }));
}
async function nativeCapture({ run = nativeRun(), jobs = nativeJobs(run), after = run, pageMutation,
  expectedAttempt = 1, expectedSuite = 9011 } = {}) {
  const reads = [];
  let runReads = 0;
  const result = await captureNativeSecurityCandidate({
    repository: NATIVE_REPOSITORY, exactHead: EXACT_HEAD, runId: 901,
    runAttempt: expectedAttempt, suiteId: expectedSuite,
    fetchJson: async resource => {
      reads.push(resource);
      if (!resource.includes('/jobs?')) return ++runReads === 1 ? run : after;
      const page = Number(new URL(`https://api.github.com/${resource}`).searchParams.get('page'));
      const payload = { total_count: jobs.length, jobs: jobs.slice((page - 1) * 100, page * 100) };
      return pageMutation ? pageMutation(payload, page) : payload;
    },
  });
  return { ...result, reads };
}
async function provesNativeRunCaptureWithoutFabricatedGraphqlNodes() {
  const result = await nativeCapture();
  assert.equal(result.state, 'SELECTED');
  assert.equal(result.selected.captureAuthority, 'github-actions-rest-complete-run-jobs.v1');
  assert.equal(result.selected.nativeJobCount, 3);
  assert.equal(result.selected.nativeRunMetadata.head_sha, EXACT_HEAD);
  assert.deepEqual(result.selected.checks.map(job => job.databaseId).sort((a, b) => a - b), [9100, 9101, 9102]);
  assert.ok(result.selected.checks.every(job => !Object.hasOwn(job, '__typename') && !Object.hasOwn(job, 'suiteStatus') && !Object.hasOwn(job, 'suiteId')));
  assert.equal(result.reads.length, 3);
  assert.equal(result.reads[0], result.reads[2]);
}
async function provesCompleteNativePagination() {
  const jobs = nativeJobs();
  for (let i = 0; i < 202; i++) jobs.push({ ...jobs[0], id: 10000 + i, name: `Additional native job ${i}` });
  const result = await nativeCapture({ jobs });
  assert.equal(result.state, 'SELECTED');
  assert.equal(result.selected.nativeJobCount, 205);
  assert.equal(result.reads.filter(value => value.includes('/jobs?')).length, 3);
}
async function refusesMalformedOrMixedNativeAuthority() {
  for (const patch of [
    { head_sha: '0'.repeat(40) }, { id: 902 }, { run_attempt: 0 }, { workflow_id: null },
    { path: '.github/workflows/lookalike.yml' }, { name: 'Lookalike Security Quality Gate' },
    { repository: { full_name: 'other/repository' } }, { head_repository: { full_name: 'fork/repository' } },
    { event: 'pull_request_target' }, { status: 'unknown' }, { status: 'completed', conclusion: null },
  ]) await assert.rejects(nativeCapture({ run: nativeRun(patch) }), /Native security run identity/u);
  for (const patch of [
    { head_sha: '0'.repeat(40) }, { run_id: 902 }, { run_attempt: 2 }, { run_attempt: 0 },
    { workflow_name: 'Lookalike' }, { head_branch: 'other-branch' }, { id: null },
    { name: '' }, { status: 'unknown' }, { status: 'completed', conclusion: null },
  ]) {
    const jobs = nativeJobs(); jobs[0] = { ...jobs[0], ...patch };
    await assert.rejects(nativeCapture({ jobs }), /Native security job identity/u);
  }
  const duplicate = nativeJobs(); duplicate[1].id = duplicate[0].id;
  await assert.rejects(nativeCapture({ jobs: duplicate }), /Native security job identity/u);
  await assert.rejects(nativeCapture({ pageMutation: payload => ({ ...payload, jobs: payload.jobs.slice(0, 2) }) }), /page length/u);
  await assert.rejects(nativeCapture({ pageMutation: payload => ({ ...payload, total_count: 2001 }) }), /pagination/u);
  await assert.rejects(nativeCapture({ pageMutation: payload => ({ ...payload, total_count: undefined }) }), /pagination/u);
  const many = nativeJobs();
  for (let i = 0; i < 100; i++) many.push({ ...many[0], id: 11000 + i, name: `Extra ${i}` });
  await assert.rejects(nativeCapture({ jobs: many, pageMutation: (payload, page) => ({ ...payload, total_count: payload.total_count + (page === 2 ? 1 : 0) }) }), /pagination/u);
}
async function preservesFailureAndPartialRerunSemanticsForNativeRecords() {
  assert.equal((await nativeCapture({ jobs: nativeJobs().slice(0, 2) })).state, 'FAILED');
  const failed = nativeJobs(); failed[0].conclusion = 'failure';
  assert.equal((await nativeCapture({ jobs: failed })).state, 'FAILED');
  assert.equal((await nativeCapture({ run: nativeRun({ conclusion: 'failure' }) })).state, 'FAILED');
  const run = nativeRun({ run_attempt: 2 });
  const jobs = nativeJobs(nativeRun()); jobs[2].conclusion = 'failure';
  jobs.push({ ...nativeJobs(run)[2], id: 9202 });
  const retry = await nativeCapture({ run, jobs, expectedAttempt: 2 });
  assert.equal(retry.state, 'SELECTED');
  assert.equal(retry.selected.checks.find(job => job.name === REQUIRED_SECURITY_QUALITY_JOBS[2]).databaseId, 9202);
  jobs.push({ ...jobs[3], id: 9302, conclusion: 'failure' });
  assert.equal((await nativeCapture({ run, jobs, expectedAttempt: 2 })).state, 'FAILED');
}
async function neverAcceptsChangingOrActiveNativeEvidence() {
  assert.equal((await nativeCapture({ expectedAttempt: 2 })).state, 'WAIT');
  assert.equal((await nativeCapture({ expectedSuite: 9021 })).state, 'WAIT');
  assert.equal((await nativeCapture({ after: nativeRun({ run_attempt: 2 }) })).state, 'WAIT');
  assert.equal((await nativeCapture({ after: nativeRun({ updated_at: '2026-11-01T09:03:00Z' }) })).state, 'WAIT');
  assert.equal((await nativeCapture({ run: nativeRun({ status: 'in_progress', conclusion: null }) })).state, 'WAIT');
  assert.equal((await nativeCapture({ run: nativeRun({ run_attempt: 2 }), jobs: nativeJobs(), expectedAttempt: 2 })).state, 'WAIT');
  const jobs = nativeJobs(); jobs[0] = { ...jobs[0], status: 'in_progress', conclusion: null };
  assert.equal((await nativeCapture({ jobs })).state, 'WAIT');
  await assert.rejects(nativeCapture({ after: nativeRun({ head_sha: '0'.repeat(40) }) }), /run identity/u);
}

function provesActualEntrypointUsesNativeEvidenceWithoutLaunderingAFailure() {
  const source = fileURLToPath(new URL('./capture-base-security-jobs.mjs', import.meta.url));
  for (const scenario of ['missing-node', 'visible-failure', 'visible-suite-failure', 'native-failure', 'complete-rollup']) {
    const directory = mkdtempSync(path.join(tmpdir(), 'security-capture-contract-'));
    try {
      const run = nativeRun(); const jobs = nativeJobs(run);
      const nodes = REQUIRED_SECURITY_QUALITY_JOBS.map((name, i) => check({ id: 9100 + i, name, runId: 901 }));
      if (scenario !== 'complete-rollup') nodes.pop();
      if (scenario === 'visible-failure') nodes[0].conclusion = 'FAILURE';
      if (scenario === 'visible-suite-failure') for (const node of nodes) node.checkSuite.conclusion = 'FAILURE';
      if (scenario === 'native-failure') jobs[0].conclusion = 'failure';
      writeFileSync(path.join(directory, 'input.json'), JSON.stringify({ run, jobs, nodes, exactHead: EXACT_HEAD }));
      const preload = path.join(directory, 'fetch.mjs');
      writeFileSync(preload, `
        import fs from 'node:fs';
        const root = ${JSON.stringify(directory)};
        const input = JSON.parse(fs.readFileSync(root + '/input.json', 'utf8'));
        globalThis.fetch = async url => {
          fs.appendFileSync(root + '/requests.txt', String(url) + '\\n');
          if (url === 'https://api.github.com/graphql') return Response.json({ data: { repository: { object: {
            oid: input.exactHead, statusCheckRollup: { contexts: { nodes: input.nodes,
              pageInfo: { hasNextPage: false, endCursor: null } } }
          } } } });
          if (String(url).endsWith('/actions/runs/901')) return Response.json(input.run);
          if (String(url).endsWith('/actions/runs/901/jobs?filter=all&per_page=100&page=1'))
            return Response.json({ total_count: input.jobs.length, jobs: input.jobs });
          throw new Error('Unexpected authority endpoint in isolated contract');
        };
      `);
      const child = spawnSync(process.execPath, ['--import', preload, source], {
        env: { NODE_ENV: 'test', GITHUB_REPOSITORY: NATIVE_REPOSITORY, EXACT_HEAD,
          GITHUB_TOKEN: 'synthetic-contract-value-not-a-credential',
          SECURITY_INPUT_DIR: path.join(directory, 'captured'), GITHUB_ENV: path.join(directory, 'environment') },
        encoding: 'utf8', timeout: 5000, maxBuffer: 100000,
      });
      assert.ifError(child.error);
      const requests = readFileSync(path.join(directory, 'requests.txt'), 'utf8').trim().split('\n');
      if (scenario === 'missing-node' || scenario === 'complete-rollup') {
        assert.equal(child.status, 0, child.stderr);
        const output = JSON.parse(readFileSync(path.join(directory, 'captured/base-security-jobs.json'), 'utf8'));
        assert.equal(output.commitSha, EXACT_HEAD); assert.equal(output.workflowRunId, '901');
        assert.equal(output.jobs.length, 3);
        assert.ok(output.jobs.every(job => job.conclusion === 'success'));
        assert.equal(output.captureAuthority, scenario === 'missing-node'
          ? 'github-actions-rest-complete-run-jobs.v1' : 'github-graphql-commit-rollup.v1');
        assert.equal(readFileSync(path.join(directory, 'environment'), 'utf8'), 'BASE_SECURITY_RUN_ID=901\n');
      } else {
        assert.equal(child.status, 1);
        assert.throws(() => readFileSync(path.join(directory, 'captured/base-security-jobs.json')));
        if (scenario.startsWith('visible-')) assert.deepEqual(requests, ['https://api.github.com/graphql']);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}

await provesPaginationBeyondOneHundredContexts();
selectsOneDeterministicRunAcrossPushAndPullRequestSuites();
usesTheLatestEffectiveStateAcrossAPartialRerun();
latestDuplicateCheckWinsInsideOneRun();
successfulRunWinsOverFailedAndActiveRuns();
waitsOnlyWhileACandidateCanStillComplete();
waitsWhileTheRollupHasNotIndexedAnyCandidate();
failsClosedWhenAllCoherentRunsFailed();
failsClosedWhenOnlyCompletedIncompleteRunsExist();
await enforcesStrictPaginationBound();
await provesNativeRunCaptureWithoutFabricatedGraphqlNodes();
await provesCompleteNativePagination();
await refusesMalformedOrMixedNativeAuthority();
await preservesFailureAndPartialRerunSemanticsForNativeRecords();
await neverAcceptsChangingOrActiveNativeEvidence();
provesActualEntrypointUsesNativeEvidenceWithoutLaunderingAFailure();
console.log('capture-base-security-jobs contract: PASS');
