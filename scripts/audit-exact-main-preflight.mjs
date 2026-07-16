import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repository = process.env.GITHUB_REPOSITORY;
const [owner, name] = repository.split('/');
const targetSha = process.env.TARGET_SHA;
const targetBranch = process.env.TARGET_BRANCH || 'main';
const auditDir = process.env.AUDIT_DIR;
const token = process.env.GITHUB_TOKEN;
const requiredJobs = [
  'Verify production SEO headers',
  'Multi-node kind · immutable rollout · rollback',
  'Production-like Kubernetes Gate · blocking',
  'Build once · manifest · migration gate · rollback contract',
  'Migration image · blocking HIGH/CRITICAL scan',
  'Immutable Release Authority Gate · all blocking checks',
];

fs.mkdirSync(auditDir, { recursive: true });
const outputFile = path.join(auditDir, 'preflight.json');
const result = {
  schemaVersion: 1,
  repository,
  targetSha,
  targetBranch,
  checkedAt: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID,
  auditHead: process.env.AUDIT_HEAD,
  mainSha: null,
  graphQl: { success: false, attempts: [], rollupState: null, totalCount: null },
  requiredJobs: {},
  activeChecks: [],
  checkRuns: [],
  statusContexts: [],
  error: null,
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  const lsRemote = execFileSync(
    'git',
    ['ls-remote', `https://github.com/${repository}.git`, `refs/heads/${targetBranch}`],
    { encoding: 'utf8', timeout: 60_000 },
  ).trim();
  result.mainSha = lsRemote.split(/\s+/)[0] || null;

  const query = `
    query Preflight($owner: String!, $name: String!, $oid: GitObjectID!) {
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
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  let payload = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'pachanin-demo-exact-main-preflight',
        },
        body: JSON.stringify({ query, variables: { owner, name, oid: targetSha } }),
      });
      const text = await response.text();
      result.graphQl.attempts.push({ attempt, status: response.status, bodyPrefix: response.ok ? null : text.slice(0, 300) });
      if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
      payload = JSON.parse(text);
      if (payload.errors?.length) throw new Error(JSON.stringify(payload.errors));
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(2_000 * 2 ** (attempt - 1));
    }
  }

  const commit = payload?.data?.repository?.object;
  const rollup = commit?.statusCheckRollup;
  if (!commit || commit.oid !== targetSha || !rollup) throw new Error('GraphQL commit or statusCheckRollup missing');
  const nodes = rollup.contexts?.nodes || [];
  result.graphQl.success = true;
  result.graphQl.rollupState = String(rollup.state || '').toLowerCase();
  result.graphQl.totalCount = rollup.contexts?.totalCount ?? null;
  result.graphQl.hasNextPage = Boolean(rollup.contexts?.pageInfo?.hasNextPage);
  result.checkRuns = nodes
    .filter((node) => node?.__typename === 'CheckRun' && node.checkSuite?.workflowRun)
    .map((node) => ({
      id: node.databaseId,
      name: node.name,
      status: String(node.status || '').toLowerCase(),
      conclusion: node.conclusion ? String(node.conclusion).toLowerCase() : null,
      detailsUrl: node.detailsUrl,
      suiteStatus: String(node.checkSuite.status || '').toLowerCase(),
      suiteConclusion: node.checkSuite.conclusion ? String(node.checkSuite.conclusion).toLowerCase() : null,
      branch: node.checkSuite.branch?.name || null,
      app: node.checkSuite.app?.slug || null,
      workflowRunId: node.checkSuite.workflowRun.databaseId,
      workflowName: node.checkSuite.workflowRun.workflow?.name || null,
      event: node.checkSuite.workflowRun.event,
      runNumber: node.checkSuite.workflowRun.runNumber,
      runAttempt: node.checkSuite.workflowRun.runAttempt,
      url: node.checkSuite.workflowRun.url,
    }));
  result.statusContexts = nodes
    .filter((node) => node?.__typename === 'StatusContext')
    .map((node) => ({
      context: node.context,
      state: String(node.state || '').toLowerCase(),
      description: node.description,
      targetUrl: node.targetUrl,
    }));
  result.activeChecks = result.checkRuns.filter((check) => check.status !== 'completed');
  for (const jobName of requiredJobs) {
    result.requiredJobs[jobName] = result.checkRuns.find((check) => check.name === jobName) || null;
  }
} catch (error) {
  result.error = error.stack || error.message || String(error);
}

result.checkedAt = new Date().toISOString();
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
