import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_SECURITY_QUALITY_JOBS = Object.freeze([
  'Secrets · Gitleaks blocking',
  'TypeScript · strict blocking',
  'Security Gate · all blocking checks',
]);

export const SECURITY_QUALITY_WORKFLOW = 'Security Quality Gate';
export const MAX_CONTEXT_PAGES = 20;
const CONTEXTS_PER_PAGE = 100;
const GRAPHQL_RETRIES = 8;
const CAPTURE_TIMEOUT_MS = 50 * 60 * 1000;
const CAPTURE_POLL_MS = 15_000;

const query = `
  query SecurityQualityChecks(
    $owner: String!
    $name: String!
    $oid: GitObjectID!
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        ... on Commit {
          oid
          statusCheckRollup {
            contexts(first: ${CONTEXTS_PER_PAGE}, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
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

function normalize(value) {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

function finiteInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) ? value : fallback;
}

function numericId(value) {
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareNumericIdDescending(left, right) {
  const leftId = numericId(left);
  const rightId = numericId(right);
  if (leftId === rightId) return 0;
  return leftId > rightId ? -1 : 1;
}

function normalizedCheck(node) {
  if (node?.__typename !== 'CheckRun') return null;
  const suite = node.checkSuite;
  const run = suite?.workflowRun;
  if (suite?.app?.slug !== 'github-actions') return null;
  if (run?.workflow?.name !== SECURITY_QUALITY_WORKFLOW) return null;
  if (run.databaseId === null || run.databaseId === undefined) return null;
  if (typeof node.name !== 'string' || node.name.length === 0) return null;

  return {
    name: node.name,
    databaseId: node.databaseId,
    status: normalize(node.status),
    conclusion: normalize(node.conclusion),
    detailsUrl: node.detailsUrl,
    workflowRunId: run.databaseId,
    workflowRunNumber: finiteInteger(run.runNumber),
    workflowRunAttempt: finiteInteger(run.runAttempt, 1),
    workflowRunEvent: run.event,
    workflowRunUrl: run.url,
    suiteId: suite.databaseId,
    suiteStatus: normalize(suite.status),
    suiteConclusion: normalize(suite.conclusion),
  };
}

function checkIsNewer(candidate, current) {
  if (candidate.workflowRunAttempt !== current.workflowRunAttempt) {
    return candidate.workflowRunAttempt > current.workflowRunAttempt;
  }
  return compareNumericIdDescending(candidate.databaseId, current.databaseId) < 0;
}

function deduplicateLatestChecksByName(checks) {
  const byName = new Map();
  for (const check of checks) {
    const current = byName.get(check.name);
    if (!current || checkIsNewer(check, current)) byName.set(check.name, check);
  }
  return [...byName.values()].sort((left, right) =>
    compareText(left.name, right.name)
    || compareNumericIdDescending(left.databaseId, right.databaseId));
}

function latestAttemptSuite(checks) {
  const latestAttempt = Math.max(...checks.map((check) => check.workflowRunAttempt));
  const attemptChecks = checks.filter((check) => check.workflowRunAttempt === latestAttempt);
  const suiteIds = attemptChecks
    .map((check) => check.suiteId)
    .filter((suiteId) => suiteId !== null && suiteId !== undefined);
  if (suiteIds.length === 0) return { latestAttempt, checks: attemptChecks };
  const latestSuiteId = suiteIds.sort(compareNumericIdDescending)[0];
  return {
    latestAttempt,
    checks: attemptChecks.filter((check) => String(check.suiteId) === String(latestSuiteId)),
  };
}

function candidateOrder(left, right) {
  const runIdOrder = compareNumericIdDescending(left.workflowRunId, right.workflowRunId);
  if (runIdOrder !== 0) return runIdOrder;
  if (left.workflowRunAttempt !== right.workflowRunAttempt) {
    return right.workflowRunAttempt - left.workflowRunAttempt;
  }
  if (left.workflowRunNumber !== right.workflowRunNumber) {
    return right.workflowRunNumber - left.workflowRunNumber;
  }
  return compareText(left.workflowRunEvent, right.workflowRunEvent);
}

export function groupSecurityQualityCandidates(contextNodes) {
  const grouped = new Map();
  for (const node of Array.isArray(contextNodes) ? contextNodes : []) {
    const check = normalizedCheck(node);
    if (!check) continue;
    const runId = String(check.workflowRunId);
    const bucket = grouped.get(runId) ?? [];
    bucket.push(check);
    grouped.set(runId, bucket);
  }

  return [...grouped.values()].map((runChecks) => {
    const checks = deduplicateLatestChecksByName(runChecks);
    const first = checks[0];
    const currentAttempt = latestAttemptSuite(runChecks);
    const required = REQUIRED_SECURITY_QUALITY_JOBS.map(
      (jobName) => checks.find((check) => check.name === jobName) ?? null,
    );
    const missing = REQUIRED_SECURITY_QUALITY_JOBS.filter(
      (_, index) => required[index] === null,
    );
    const activeRequired = required.filter(
      (check) => check !== null && check.status !== 'completed',
    );
    const suiteActive = currentAttempt.checks.some(
      (check) => check.suiteStatus !== 'completed',
    );
    const suiteSuccessful = currentAttempt.checks.length > 0 && currentAttempt.checks.every(
      (check) => check.suiteStatus === 'completed' && check.suiteConclusion === 'success',
    );
    const requiredSuccessful = required.every(
      (check) => check !== null
        && check.status === 'completed'
        && check.conclusion === 'success',
    );
    const successful = missing.length === 0
      && activeRequired.length === 0
      && suiteSuccessful
      && requiredSuccessful;
    const canStillComplete = !successful && (suiteActive || activeRequired.length > 0);

    return {
      workflowRunId: first.workflowRunId,
      workflowRunNumber: first.workflowRunNumber,
      workflowRunAttempt: currentAttempt.latestAttempt,
      workflowRunEvent: first.workflowRunEvent,
      workflowRunUrl: first.workflowRunUrl,
      checks,
      required,
      missing,
      activeRequired,
      successful,
      canStillComplete,
    };
  }).sort(candidateOrder);
}

export function selectSecurityQualityCandidate(contextNodes) {
  const candidates = groupSecurityQualityCandidates(contextNodes);
  const selected = candidates.find((candidate) => candidate.successful);
  if (selected) {
    return { state: 'SELECTED', selected, candidates };
  }
  if (candidates.length === 0 || candidates.some((candidate) => candidate.canStillComplete)) {
    return { state: 'WAIT', selected: null, candidates };
  }
  return { state: 'FAILED', selected: null, candidates };
}

export async function collectStatusCheckContexts({
  fetchPage,
  exactHead,
  maxPages = MAX_CONTEXT_PAGES,
}) {
  if (typeof fetchPage !== 'function') throw new Error('fetchPage must be a function.');
  if (typeof exactHead !== 'string' || exactHead.length === 0) {
    throw new Error('exactHead is required.');
  }
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_CONTEXT_PAGES) {
    throw new Error(`maxPages must be between 1 and ${MAX_CONTEXT_PAGES}.`);
  }

  const nodes = [];
  let after = null;
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchPage(after);
    if (!result || result.oid !== exactHead) {
      throw new Error(
        `Security evidence commit mismatch: expected ${exactHead}, actual ${result?.oid || 'missing'}.`,
      );
    }
    const connection = result.contexts;
    nodes.push(...(Array.isArray(connection?.nodes) ? connection.nodes : []));
    if (!connection?.pageInfo?.hasNextPage) return nodes;
    if (typeof connection.pageInfo.endCursor !== 'string' || connection.pageInfo.endCursor.length === 0) {
      throw new Error('Security check pagination returned no end cursor.');
    }
    after = connection.pageInfo.endCursor;
  }
  throw new Error(
    `Security check rollup exceeds the strict ${maxPages}-page capture bound.`,
  );
}

async function requestGraphqlPage({ owner, name, exactHead, token, after }) {
  let lastError;
  for (let attempt = 1; attempt <= GRAPHQL_RETRIES; attempt += 1) {
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
        body: JSON.stringify({
          query,
          variables: { owner, name, oid: exactHead, after },
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`GraphQL HTTP ${response.status}: ${text.slice(0, 1200)}`);
        if (!(response.status === 429 || response.status >= 500)) throw lastError;
      } else {
        const payload = JSON.parse(text);
        if (payload.errors?.length) {
          throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
        }
        const commit = payload.data?.repository?.object;
        return {
          oid: commit?.oid,
          contexts: commit?.statusCheckRollup?.contexts,
        };
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt === GRAPHQL_RETRIES) throw lastError;
    await sleep(Math.min(30_000, 2_000 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

function decisionSummary(decision, exactHead) {
  return {
    observedAt: new Date().toISOString(),
    exactHead,
    decision: decision.state,
    candidates: decision.candidates.map((candidate) => ({
      workflowRunId: String(candidate.workflowRunId),
      workflowRunAttempt: candidate.workflowRunAttempt,
      workflowRunEvent: candidate.workflowRunEvent,
      missing: candidate.missing,
      active: candidate.activeRequired.map((check) => `${check.name}:${check.status}`),
      required: candidate.required.map((check, index) =>
        check
          ? `${REQUIRED_SECURITY_QUALITY_JOBS[index]}:${check.status}/${check.conclusion}`
          : `${REQUIRED_SECURITY_QUALITY_JOBS[index]}:missing`),
      successful: candidate.successful,
      canStillComplete: candidate.canStillComplete,
    })),
  };
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const exactHead = process.env.EXACT_HEAD;
  const inputDir = process.env.SECURITY_INPUT_DIR;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const githubEnv = process.env.GITHUB_ENV;
  if (!repository || !exactHead || !inputDir || !token || !githubEnv) {
    throw new Error('Missing required security evidence environment.');
  }
  const [owner, name] = repository.split('/');
  if (!owner || !name) throw new Error('GITHUB_REPOSITORY must be owner/name.');
  fs.mkdirSync(inputDir, { recursive: true });

  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const contexts = await collectStatusCheckContexts({
      exactHead,
      fetchPage: (after) => requestGraphqlPage({ owner, name, exactHead, token, after }),
    });
    const decision = selectSecurityQualityCandidate(contexts);
    console.log(JSON.stringify(decisionSummary(decision, exactHead)));

    if (decision.state === 'SELECTED') {
      const selected = decision.selected;
      const baseSecurityRunId = String(selected.workflowRunId);
      const payload = {
        schemaVersion: 1,
        repository,
        commitSha: exactHead,
        workflow: SECURITY_QUALITY_WORKFLOW,
        workflowRunId: baseSecurityRunId,
        workflowRunNumber: selected.workflowRunNumber,
        workflowRunAttempt: selected.workflowRunAttempt,
        workflowRunEvent: selected.workflowRunEvent,
        capturedAt: new Date().toISOString(),
        jobs: selected.checks,
      };
      fs.writeFileSync(
        path.join(inputDir, 'base-security-jobs.json'),
        `${JSON.stringify(payload, null, 2)}\n`,
      );
      fs.appendFileSync(githubEnv, `BASE_SECURITY_RUN_ID=${baseSecurityRunId}\n`);
      console.log(`Captured Security Quality Gate run ${baseSecurityRunId} for ${exactHead}.`);
      return;
    }

    if (decision.state === 'FAILED') {
      const failedRuns = decision.candidates.map((candidate) =>
        `${candidate.workflowRunId}@${candidate.workflowRunAttempt}`).join(', ');
      throw new Error(
        `All coherent Security Quality candidates completed without success: ${failedRuns}.`,
      );
    }

    await sleep(CAPTURE_POLL_MS);
  }
  throw new Error(`Timed out waiting for Security Quality Gate on exact head ${exactHead}.`);
}

const invokedUrl = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedUrl === import.meta.url) {
  await main();
}
