import fs from 'node:fs';
import path from 'node:path';

const repository = process.env.GITHUB_REPOSITORY;
const [owner, name] = repository.split('/');
const targetSha = process.env.TARGET_SHA;
const token = process.env.GITHUB_TOKEN;
const mode = process.argv.includes('--wait') ? 'wait' : 'once';
const outputFile = 'audit-results/pr-2684/status.json';
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const query = `
  query PullRequestChecks($owner: String!, $name: String!, $oid: GitObjectID!) {
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        ... on Commit {
          oid
          statusCheckRollup {
            state
            contexts(first: 100) {
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes {
                __typename
                ... on CheckRun {
                  databaseId
                  name
                  status
                  conclusion
                  detailsUrl
                  startedAt
                  completedAt
                  checkSuite {
                    status
                    conclusion
                    branch { name }
                    app { slug }
                    workflowRun {
                      databaseId
                      event
                      runNumber
                      runAttempt
                      url
                      workflow { name }
                    }
                  }
                }
                ... on StatusContext {
                  context
                  state
                  description
                  targetUrl
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
      }
    }
  }
`;

function normalize(value) {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

async function graphql() {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'pachanin-demo-pr-2684-check-audit',
        },
        body: JSON.stringify({ query, variables: { owner, name, oid: targetSha } }),
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`GraphQL HTTP ${response.status}: ${text.slice(0, 1000)}`);
      } else {
        const payload = JSON.parse(text);
        if (payload.errors?.length) throw new Error(JSON.stringify(payload.errors));
        return payload.data;
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt === 8) throw lastError;
    await sleep(Math.min(30_000, 2_000 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

async function snapshot() {
  const data = await graphql();
  const commit = data?.repository?.object;
  if (!commit || commit.oid !== targetSha) {
    throw new Error(`Commit mismatch: expected ${targetSha}, actual ${commit?.oid || 'missing'}`);
  }
  const rollup = commit.statusCheckRollup;
  if (!rollup) throw new Error('statusCheckRollup missing');
  const nodes = rollup.contexts?.nodes || [];
  const checkRuns = nodes
    .filter((node) => node?.__typename === 'CheckRun')
    .map((node) => ({
      id: node.databaseId,
      name: node.name,
      status: normalize(node.status),
      conclusion: normalize(node.conclusion),
      detailsUrl: node.detailsUrl,
      startedAt: node.startedAt,
      completedAt: node.completedAt,
      suiteStatus: normalize(node.checkSuite?.status),
      suiteConclusion: normalize(node.checkSuite?.conclusion),
      branch: node.checkSuite?.branch?.name || null,
      app: node.checkSuite?.app?.slug || null,
      workflowRunId: node.checkSuite?.workflowRun?.databaseId || null,
      workflowName: node.checkSuite?.workflowRun?.workflow?.name || null,
      event: node.checkSuite?.workflowRun?.event || null,
      runNumber: node.checkSuite?.workflowRun?.runNumber || null,
      runAttempt: node.checkSuite?.workflowRun?.runAttempt || null,
      url: node.checkSuite?.workflowRun?.url || null,
    }));
  const statusContexts = nodes
    .filter((node) => node?.__typename === 'StatusContext')
    .map((node) => ({
      context: node.context,
      state: normalize(node.state),
      description: node.description,
      targetUrl: node.targetUrl,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }));
  const active = checkRuns.filter((check) => check.status !== 'completed');
  const failures = checkRuns.filter((check) => check.status === 'completed' && !['success', 'skipped', 'neutral'].includes(check.conclusion));
  return {
    schemaVersion: 1,
    repository,
    targetSha,
    capturedAt: new Date().toISOString(),
    mode,
    rollupState: normalize(rollup.state),
    totalCount: rollup.contexts?.totalCount ?? nodes.length,
    hasNextPage: Boolean(rollup.contexts?.pageInfo?.hasNextPage),
    active,
    failures,
    checkRuns,
    statusContexts,
    terminal: active.length === 0,
  };
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });

if (mode === 'once') {
  const result = await snapshot();
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ terminal: result.terminal, active: result.active.map((check) => check.name), failures: result.failures.map((check) => check.name) }, null, 2));
} else {
  const deadline = Date.now() + 70 * 60 * 1000;
  let stable = null;
  while (Date.now() < deadline) {
    const result = await snapshot();
    fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ capturedAt: result.capturedAt, terminal: result.terminal, active: result.active.map((check) => check.name), failures: result.failures.map((check) => check.name) }));
    if (result.terminal) {
      const current = result.checkRuns.map((check) => `${check.id}:${check.status}:${check.conclusion}`).sort().join('|');
      if (stable === current) process.exit(0);
      stable = current;
      await sleep(30_000);
    } else {
      stable = null;
      await sleep(20_000);
    }
  }
  throw new Error('Timed out waiting for PR #2684 checks');
}
