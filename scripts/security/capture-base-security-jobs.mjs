import fs from 'node:fs';
import path from 'node:path';

const repository = process.env.GITHUB_REPOSITORY;
const [owner, name] = repository.split('/');
const exactHead = process.env.EXACT_HEAD;
const inputDir = process.env.SECURITY_INPUT_DIR;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const githubEnv = process.env.GITHUB_ENV;
const requiredJobs = [
  'Secrets · Gitleaks blocking',
  'TypeScript · strict blocking',
  'Security Gate · all blocking checks',
];

if (!repository || !exactHead || !inputDir || !token || !githubEnv) {
  throw new Error('Missing required security evidence environment.');
}

fs.mkdirSync(inputDir, { recursive: true });

const query = `
  query SecurityQualityChecks($owner: String!, $name: String!, $oid: GitObjectID!) {
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        ... on Commit {
          oid
          statusCheckRollup {
            contexts(first: 100) {
              nodes {
                __typename
                ... on CheckRun {
                  databaseId
                  name
                  status
                  conclusion
                  detailsUrl
                  checkSuite {
                    databaseId
                    status
                    conclusion
                    app { slug }
                    workflowRun {
                      databaseId
                      event
                      runAttempt
                      runNumber
                      url
                      workflow { name }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
          'User-Agent': 'pachanin-demo-security-evidence-capture',
        },
        body: JSON.stringify({ query, variables: { owner, name, oid: exactHead } }),
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`GraphQL HTTP ${response.status}: ${text.slice(0, 1200)}`);
        if (!(response.status === 429 || response.status >= 500)) throw lastError;
      } else {
        const payload = JSON.parse(text);
        if (payload.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
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

function normalize(value) {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

const deadline = Date.now() + 50 * 60 * 1000;
while (Date.now() < deadline) {
  const data = await graphql();
  const commit = data?.repository?.object;
  if (!commit || commit.oid !== exactHead) {
    throw new Error(`Security evidence commit mismatch: expected ${exactHead}, actual ${commit?.oid || 'missing'}.`);
  }

  const checks = (commit.statusCheckRollup?.contexts?.nodes || [])
    .filter((node) => node?.__typename === 'CheckRun')
    .filter((node) => node.checkSuite?.app?.slug === 'github-actions')
    .filter((node) => node.checkSuite?.workflowRun?.workflow?.name === 'Security Quality Gate')
    .map((node) => ({
      name: node.name,
      databaseId: node.databaseId,
      status: normalize(node.status),
      conclusion: normalize(node.conclusion),
      detailsUrl: node.detailsUrl,
      workflowRunId: node.checkSuite.workflowRun.databaseId,
      workflowRunNumber: node.checkSuite.workflowRun.runNumber,
      workflowRunAttempt: node.checkSuite.workflowRun.runAttempt,
      workflowRunEvent: node.checkSuite.workflowRun.event,
      workflowRunUrl: node.checkSuite.workflowRun.url,
      suiteId: node.checkSuite.databaseId,
      suiteStatus: normalize(node.checkSuite.status),
      suiteConclusion: normalize(node.checkSuite.conclusion),
    }));

  const required = requiredJobs.map((jobName) => checks.find((check) => check.name === jobName) || null);
  const active = required.filter((check) => check && check.status !== 'completed');
  const missing = requiredJobs.filter((_, index) => !required[index]);

  console.log(JSON.stringify({
    observedAt: new Date().toISOString(),
    exactHead,
    missing,
    active: active.map((check) => `${check.name}:${check.status}`),
    required: required.map((check, index) => check ? `${requiredJobs[index]}:${check.status}/${check.conclusion}` : `${requiredJobs[index]}:missing`),
  }));

  if (missing.length === 0 && active.length === 0) {
    for (const check of required) {
      if (check.conclusion !== 'success') {
        throw new Error(`Required base security job ${check.name} concluded ${check.conclusion}.`);
      }
    }
    const runIds = new Set(required.map((check) => check.workflowRunId));
    if (runIds.size !== 1) {
      throw new Error(`Security Quality jobs resolve to multiple workflow runs: ${[...runIds].join(',')}.`);
    }
    const baseSecurityRunId = String([...runIds][0]);
    const payload = {
      schemaVersion: 1,
      repository,
      commitSha: exactHead,
      workflow: 'Security Quality Gate',
      workflowRunId: baseSecurityRunId,
      capturedAt: new Date().toISOString(),
      jobs: checks,
    };
    fs.writeFileSync(path.join(inputDir, 'base-security-jobs.json'), `${JSON.stringify(payload, null, 2)}\n`);
    fs.appendFileSync(githubEnv, `BASE_SECURITY_RUN_ID=${baseSecurityRunId}\n`);
    console.log(`Captured Security Quality Gate run ${baseSecurityRunId} for ${exactHead}.`);
    process.exit(0);
  }

  await sleep(15_000);
}

throw new Error(`Timed out waiting for Security Quality Gate on exact head ${exactHead}.`);
