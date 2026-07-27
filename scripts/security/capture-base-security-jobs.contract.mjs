import assert from 'node:assert/strict';
import {
  REQUIRED_SECURITY_QUALITY_JOBS,
  collectStatusCheckContexts,
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
console.log('capture-base-security-jobs contract: PASS');
