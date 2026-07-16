import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repository = process.env.GITHUB_REPOSITORY;
const [owner, repositoryName] = repository.split('/');
const targetSha = process.env.TARGET_SHA;
const targetBranch = process.env.TARGET_BRANCH || 'main';
const auditDir = process.env.AUDIT_DIR;
const token = process.env.GITHUB_TOKEN;
const apiBase = `https://api.github.com/repos/${repository}`;
const allowedConclusions = new Set(['success', 'skipped', 'neutral']);
const legacyExternalContexts = new Set([
  'deploy/pachaninm-lab/pachanin-demo',
  'Vercel – pachanin-demo-landing',
  'Vercel – pachanin-demo-api',
  'Vercel – pachanin-canonical-web',
  'Vercel – pachanin-demo-api-ovdc',
]);
const errors = [];
const warnings = [];
const apiRetries = [];

const required = {
  'SEO Live Smoke': {
    jobs: ['Verify production SEO headers'],
    artifacts: [],
  },
  'Production-like Kubernetes Acceptance': {
    jobs: [
      'Multi-node kind · immutable rollout · rollback',
      'Production-like Kubernetes Gate · blocking',
    ],
    artifacts: [`production-like-kubernetes-${targetSha}`],
  },
  'Immutable Release Authority Acceptance': {
    workflowFile: 'immutable-release-authority-acceptance.yml',
    jobs: [
      'Build once · manifest · migration gate · rollback contract',
      'Migration image · blocking HIGH/CRITICAL scan',
      'Immutable Release Authority Gate · all blocking checks',
    ],
    artifacts: [
      `immutable-release-build-${targetSha}`,
      `immutable-release-migration-security-${targetSha}`,
    ],
  },
};

fs.rmSync(auditDir, { recursive: true, force: true });
for (const directory of ['api', 'downloads', 'evidence']) {
  fs.mkdirSync(path.join(auditDir, directory), { recursive: true });
}

const report = {
  schemaVersion: 5,
  repository,
  target: { branch: targetBranch, commitSha: targetSha },
  auditedAt: new Date().toISOString(),
  auditExecution: {
    event: process.env.GITHUB_EVENT_NAME,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1),
    workflowSha: process.env.GITHUB_SHA,
  },
  dispatches: [],
  mainRef: { startSha: null, endSha: null, authority: 'git-ls-remote' },
  exactMainChecks: { rollupState: null, checkRuns: [], statusContexts: [] },
  requiredWorkflows: {},
  liveSeo: null,
  apiRetries,
  errors,
  warnings,
  maturityBoundary: {
    productionOperationallyAccepted: 'NO_GO',
    acceptedSlice: 'exact-main disposable multi-node Kubernetes acceptance, immutable release authority and production SEO evidence only',
    externalStatusCleanupIssue: 2600,
    notProven: [
      'provider-level PostgreSQL HA/PITR',
      'target production load and capacity',
      'permanent-environment operations',
      'external penetration test',
      'live provider integrations',
      '72-hour, 14-day and 30-day operational soak',
      'deep outbox runtime scenarios tracked by #2649',
    ],
  },
  pass: false,
  verdict: 'FAIL',
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function addError(message) {
  errors.push(message);
  console.error(`AUDIT_ERROR: ${message}`);
}

function assert(condition, message) {
  if (!condition) addError(message);
}

function lower(value) {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function validSha256(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(auditDir, 'api', name), `${JSON.stringify(value, null, 2)}\n`);
}

async function request(urlOrPath, options = {}) {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `https://api.github.com${urlOrPath}`;
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        redirect: 'follow',
        headers: {
          Accept: options.accept || 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'pachanin-demo-exact-main-graphql-audit',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (response.ok) {
        if (options.binary) return Buffer.from(await response.arrayBuffer());
        if (response.status === 204) return null;
        return response.json();
      }
      const body = await response.text();
      lastError = new Error(`GitHub API ${response.status} for ${url}: ${body.slice(0, 1600)}`);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 10) throw lastError;
      const retryAfterMs = Number(response.headers.get('retry-after') || 0) * 1000;
      const delayMs = Math.max(retryAfterMs, Math.min(60_000, 2_000 * 2 ** (attempt - 1)));
      apiRetries.push({ url, attempt, status: response.status, delayMs });
      console.warn(`Transient GitHub API ${response.status}; retrying ${url} in ${delayMs}ms`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      const retryable = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|GitHub API (429|5\d\d)/i.test(String(error));
      if (!retryable || attempt === 10) throw error;
      const delayMs = Math.min(60_000, 2_000 * 2 ** (attempt - 1));
      apiRetries.push({ url, attempt, error: String(error), delayMs });
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, redirect: options.redirect || 'manual' });
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt === 8) throw lastError;
    await sleep(Math.min(30_000, 1_500 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

async function paginateRest(urlPath, key) {
  const values = [];
  for (let page = 1; page <= 20; page += 1) {
    const joiner = urlPath.includes('?') ? '&' : '?';
    const payload = await request(`${urlPath}${joiner}per_page=100&page=${page}`);
    const pageValues = payload[key] || [];
    values.push(...pageValues);
    if (pageValues.length < 100) break;
  }
  return values;
}

async function graphql(query, variables) {
  const payload = await request('https://api.github.com/graphql', {
    method: 'POST',
    body: { query, variables },
  });
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }
  return payload.data;
}

async function resolveMainSha() {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const output = execFileSync(
        'git',
        ['ls-remote', `https://github.com/${repository}.git`, `refs/heads/${targetBranch}`],
        { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();
      const sha = output.split(/\s+/)[0] || '';
      if (/^[0-9a-f]{40}$/.test(sha)) return sha;
      throw new Error(`Unexpected git ls-remote output: ${output}`);
    } catch (error) {
      lastError = error;
      if (attempt === 8) throw error;
      const delayMs = Math.min(30_000, 2_000 * 2 ** (attempt - 1));
      warnings.push(`git ls-remote attempt ${attempt} failed; retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

const rollupQuery = `
  query ExactCommitChecks($owner: String!, $name: String!, $oid: GitObjectID!, $after: String) {
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        ... on Commit {
          oid
          statusCheckRollup {
            state
            contexts(first: 100, after: $after) {
              totalCount
              checkRunCount
              statusContextCount
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
                    databaseId
                    status
                    conclusion
                    branch { name }
                    app { slug }
                    workflowRun {
                      databaseId
                      event
                      runAttempt
                      runNumber
                      url
                      workflow { name }
                      file { path }
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

async function exactMainRollup() {
  const nodes = [];
  let cursor = null;
  let rollupState = null;
  let commitOid = null;
  for (let page = 1; page <= 20; page += 1) {
    const data = await graphql(rollupQuery, { owner, name: repositoryName, oid: targetSha, after: cursor });
    const commit = data?.repository?.object;
    if (!commit) throw new Error(`GraphQL could not resolve commit ${targetSha}`);
    commitOid = commit.oid;
    const rollup = commit.statusCheckRollup;
    if (!rollup) throw new Error(`GraphQL statusCheckRollup is missing for ${targetSha}`);
    rollupState = rollup.state;
    nodes.push(...(rollup.contexts?.nodes || []));
    if (!rollup.contexts?.pageInfo?.hasNextPage) break;
    cursor = rollup.contexts.pageInfo.endCursor;
  }
  if (commitOid !== targetSha) throw new Error(`GraphQL commit mismatch: expected ${targetSha}, actual ${commitOid}`);
  const checkRuns = nodes
    .filter((node) => node?.__typename === 'CheckRun' && node.checkSuite?.workflowRun)
    .map((node) => ({
      databaseId: node.databaseId,
      name: node.name,
      status: lower(node.status),
      conclusion: lower(node.conclusion),
      detailsUrl: node.detailsUrl,
      startedAt: node.startedAt,
      completedAt: node.completedAt,
      suite: {
        databaseId: node.checkSuite.databaseId,
        status: lower(node.checkSuite.status),
        conclusion: lower(node.checkSuite.conclusion),
        branch: node.checkSuite.branch?.name || null,
        app: node.checkSuite.app?.slug || null,
      },
      workflowRun: {
        databaseId: node.checkSuite.workflowRun.databaseId,
        event: node.checkSuite.workflowRun.event,
        runAttempt: node.checkSuite.workflowRun.runAttempt,
        runNumber: node.checkSuite.workflowRun.runNumber,
        url: node.checkSuite.workflowRun.url,
        workflowName: node.checkSuite.workflowRun.workflow?.name || null,
        workflowFile: node.checkSuite.workflowRun.file?.path || null,
      },
    }));
  const statusContexts = nodes
    .filter((node) => node?.__typename === 'StatusContext')
    .map((node) => ({
      context: node.context,
      state: lower(node.state),
      description: node.description,
      targetUrl: node.targetUrl,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }));
  return { rollupState: lower(rollupState), checkRuns, statusContexts };
}

async function ensureImmutableRun(rollup) {
  const immutableNames = new Set(required['Immutable Release Authority Acceptance'].jobs);
  if (rollup.checkRuns.some((run) => immutableNames.has(run.name))) return;
  await request(`${apiBase}/actions/workflows/${required['Immutable Release Authority Acceptance'].workflowFile}/dispatches`, {
    method: 'POST',
    body: { ref: targetBranch },
  });
  report.dispatches.push({ workflow: 'Immutable Release Authority Acceptance', ref: targetBranch, dispatchedAt: new Date().toISOString() });
}

async function waitForStableExactMainRollup() {
  const deadline = Date.now() + 75 * 60 * 1000;
  let stableSnapshot = null;
  while (Date.now() < deadline) {
    const rollup = await exactMainRollup();
    const activeRuns = rollup.checkRuns.filter((run) => run.status !== 'completed');
    const requiredRuns = Object.values(required).flatMap((config) => config.jobs).map((name) => rollup.checkRuns.find((run) => run.name === name) || null);
    console.log(JSON.stringify({
      observedAt: new Date().toISOString(),
      rollupState: rollup.rollupState,
      checkRunCount: rollup.checkRuns.length,
      statusContextCount: rollup.statusContexts.length,
      active: activeRuns.map((run) => `${run.name}:${run.status}`),
      required: Object.fromEntries(Object.values(required).flatMap((config) => config.jobs).map((name, index) => [
        name,
        requiredRuns[index] ? `${requiredRuns[index].status}/${requiredRuns[index].conclusion}` : 'missing',
      ])),
    }));
    if (requiredRuns.every((run) => run?.status === 'completed') && activeRuns.length === 0) {
      const snapshot = rollup.checkRuns.map((run) => `${run.databaseId}:${run.status}:${run.conclusion}`).sort().join('|');
      if (stableSnapshot === snapshot) return rollup;
      stableSnapshot = snapshot;
      await sleep(30_000);
    } else {
      stableSnapshot = null;
      await sleep(20_000);
    }
  }
  throw new Error('Timed out waiting for stable exact-main GitHub GraphQL rollup');
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function findUnique(root, basename) {
  const matches = walk(root).filter((file) => path.basename(file) === basename);
  assert(matches.length === 1, `${basename} expected exactly once in ${root}; found ${matches.length}`);
  return matches[0] || null;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    addError(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

async function downloadAndExtract(artifact) {
  const safe = artifact.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const zipFile = path.join(auditDir, 'downloads', `${safe}.zip`);
  const extractDir = path.join(auditDir, 'downloads', safe);
  fs.writeFileSync(zipFile, await request(`${apiBase}/actions/artifacts/${artifact.id}/zip`, { binary: true }));
  const calculatedDigest = sha256File(zipFile);
  assert(validSha256(artifact.digest), `Artifact digest missing or invalid: ${artifact.name}`);
  assert(artifact.digest === calculatedDigest, `Artifact digest mismatch for ${artifact.name}`);
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync('unzip', ['-q', zipFile, '-d', extractDir]);
  return { extractDir, calculatedDigest };
}

function verifyKubernetes(extractDir) {
  const file = findUnique(extractDir, 'production-like-kubernetes-evidence.json');
  if (!file) return null;
  const evidence = readJson(file, 'Production-like Kubernetes evidence');
  if (!evidence) return null;
  assert(evidence.schemaVersion === 1, 'Kubernetes evidence schemaVersion must be 1');
  assert(evidence.repository === repository, 'Kubernetes evidence repository mismatch');
  assert(evidence.commitSha === targetSha && evidence.branch === targetBranch, 'Kubernetes exact-main mismatch');
  assert(evidence.pass === true && evidence.result === 'PASS', 'Kubernetes evidence did not pass');
  assert(evidence.failureReason === null, 'Kubernetes evidence contains failureReason');
  assert(Array.isArray(evidence.violatedThresholds) && evidence.violatedThresholds.length === 0, 'Kubernetes evidence contains violated thresholds');
  assert(evidence.release?.sourceCommit === targetSha, 'Kubernetes release sourceCommit mismatch');
  assert(evidence.actualMeasurements?.mutablePlatformImageReferences === 0, 'Kubernetes mutable image reference found');
  assert(evidence.actualMeasurements?.rollbackDigestMismatches === 0, 'Kubernetes rollback digest mismatch found');
  assert(evidence.assertions?.immutablePlatformImages === true, 'Kubernetes immutable image assertion missing');
  assert(evidence.assertions?.rollingUpdateDigestSetApplied === true, 'Kubernetes rollout assertion missing');
  assert(evidence.assertions?.sameSchemaRollbackDigestSetRestored === true, 'Kubernetes rollback assertion missing');
  const references = [...(evidence.logs || []), ...(evidence.artifacts || [])];
  assert(references.length > 0, 'Kubernetes retained evidence is empty');
  for (const reference of references) {
    const normalized = path.posix.normalize(reference);
    assert(!path.isAbsolute(reference) && normalized !== '..' && !normalized.startsWith('../'), `Kubernetes reference escapes artifact: ${reference}`);
    assert(fs.existsSync(path.join(extractDir, normalized)), `Kubernetes retained reference missing: ${reference}`);
  }
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), retainedReferenceCount: references.length, evidence };
}

function verifyImmutable(extractDir) {
  const file = findUnique(extractDir, 'immutable-release-evidence.json');
  if (!file) return null;
  const evidence = readJson(file, 'Immutable release evidence');
  if (!evidence) return null;
  assert(evidence.schemaVersion === 1, 'Immutable release schemaVersion must be 1');
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'Immutable release exact-main mismatch');
  assert(evidence.pass === true, 'Immutable release evidence did not pass');
  assert(Array.isArray(evidence.violatedThresholds) && evidence.violatedThresholds.length === 0, 'Immutable release thresholds violated');
  assert(validSha256(evidence.manifestId) && validSha256(evidence.rollbackId), 'Immutable manifest or rollback ID invalid');
  for (const component of ['api', 'web', 'outboxWorker', 'migration']) {
    assert(validSha256(evidence.imageDigests?.[component]), `Immutable image digest invalid: ${component}`);
    assert(validSha256(evidence.imageConfigIds?.[component]), `Immutable image config ID invalid: ${component}`);
  }
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

function verifyMigrationSecurity(extractDir) {
  const file = findUnique(extractDir, 'trivy-migration-container-evaluation.json');
  if (!file) return null;
  const evidence = readJson(file, 'Migration image security evidence');
  if (!evidence) return null;
  assert(evidence.schemaVersion === 1, 'Migration security schemaVersion must be 1');
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'Migration security exact-main mismatch');
  assert(evidence.passed === true && evidence.scannerResult === 'success', 'Migration security evidence did not pass');
  assert(evidence.recognizedReportShape === true, 'Migration security report shape unrecognized');
  assert(evidence.summary?.highOrCritical === 0 && evidence.summary?.blocked === 0, 'Migration security contains blocked findings');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

async function verifyWorkflow(workflowName, config, rollup) {
  const jobChecks = config.jobs.map((jobName) => rollup.checkRuns.find((run) => run.name === jobName) || null);
  for (let index = 0; index < config.jobs.length; index += 1) {
    const jobCheck = jobChecks[index];
    assert(Boolean(jobCheck), `Required job missing: ${workflowName} / ${config.jobs[index]}`);
    if (jobCheck) assert(jobCheck.status === 'completed' && jobCheck.conclusion === 'success', `Required job did not succeed: ${workflowName} / ${config.jobs[index]}`);
  }
  const workflowRunIds = new Set(jobChecks.filter(Boolean).map((run) => run.workflowRun.databaseId).filter(Boolean));
  assert(workflowRunIds.size === 1, `Required workflow ${workflowName} must resolve to one workflow run; found ${[...workflowRunIds].join(',')}`);
  if (workflowRunIds.size !== 1) return;
  const runId = [...workflowRunIds][0];
  const firstCheck = jobChecks.find(Boolean);
  assert(firstCheck.workflowRun.workflowName === workflowName, `Workflow name mismatch: expected ${workflowName}, actual ${firstCheck.workflowRun.workflowName}`);
  assert(['push', 'workflow_dispatch'].includes(firstCheck.workflowRun.event), `Workflow event invalid: ${workflowName} (${firstCheck.workflowRun.event})`);
  if (firstCheck.suite.branch !== null) assert(firstCheck.suite.branch === targetBranch, `Workflow branch mismatch: ${workflowName} (${firstCheck.suite.branch})`);
  assert(firstCheck.suite.status === 'completed' && firstCheck.suite.conclusion === 'success', `Workflow check suite did not succeed: ${workflowName}`);
  const artifacts = await paginateRest(`${apiBase}/actions/runs/${runId}/artifacts`, 'artifacts');
  writeJson(`run-${runId}-artifacts.json`, { artifacts });
  const workflowReport = {
    run: {
      id: runId,
      event: firstCheck.workflowRun.event,
      runAttempt: firstCheck.workflowRun.runAttempt,
      runNumber: firstCheck.workflowRun.runNumber,
      workflowName: firstCheck.workflowRun.workflowName,
      workflowFile: firstCheck.workflowRun.workflowFile,
      url: firstCheck.workflowRun.url,
      branch: firstCheck.suite.branch,
      suiteStatus: firstCheck.suite.status,
      suiteConclusion: firstCheck.suite.conclusion,
      headSha: targetSha,
    },
    jobs: jobChecks.filter(Boolean),
    artifacts: [],
    evidence: {},
  };
  report.requiredWorkflows[workflowName] = workflowReport;
  for (const artifactName of config.artifacts) {
    const matches = artifacts.filter((artifact) => artifact.name === artifactName);
    assert(matches.length === 1, `Expected artifact ${artifactName} exactly once; found ${matches.length}`);
    if (matches.length !== 1) continue;
    const artifact = matches[0];
    assert(artifact.expired === false, `Artifact expired: ${artifactName}`);
    assert(artifact.workflow_run?.head_sha === targetSha, `Artifact head SHA mismatch: ${artifactName}`);
    const { extractDir, calculatedDigest } = await downloadAndExtract(artifact);
    workflowReport.artifacts.push({ id: artifact.id, name: artifact.name, sizeInBytes: artifact.size_in_bytes, digest: artifact.digest, calculatedDigest, expired: artifact.expired });
    if (artifactName.startsWith('production-like-kubernetes-')) workflowReport.evidence.productionLikeKubernetes = verifyKubernetes(extractDir);
    if (artifactName.startsWith('immutable-release-build-')) workflowReport.evidence.immutableRelease = verifyImmutable(extractDir);
    if (artifactName.startsWith('immutable-release-migration-security-')) workflowReport.evidence.migrationSecurity = verifyMigrationSecurity(extractDir);
  }
}

async function verifyLiveSeo() {
  const site = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
  const publicPaths = ['/platform-v7', '/platform-v7/secure-grain-deal', '/platform-v7/fgis-zerno', '/platform-v7/deal-flow'];
  const privatePaths = ['/platform-v7/buyer', '/platform-v7/bank', '/platform-v7/deals/DL-9102/clean'];
  const live = { checkedAt: new Date().toISOString(), public: [], private: [], sitemap: {}, robots: {} };
  for (const pathname of publicPaths) {
    const response = await fetchWithRetry(`${site}${pathname}`, { method: 'HEAD', redirect: 'manual' });
    const robots = response.headers.get('x-robots-tag') || '';
    live.public.push({ pathname, status: response.status, xRobotsTag: robots });
    assert(response.status >= 200 && response.status < 400, `Public SEO route failed: ${pathname} status=${response.status}`);
    assert(robots.toLowerCase().includes('index, follow'), `Public SEO route is not indexable: ${pathname} x-robots-tag=${robots}`);
  }
  for (const pathname of privatePaths) {
    const response = await fetchWithRetry(`${site}${pathname}`, { method: 'HEAD', redirect: 'manual' });
    const robots = response.headers.get('x-robots-tag') || '';
    live.private.push({ pathname, status: response.status, xRobotsTag: robots });
    assert(response.status >= 200 && response.status < 400, `Private SEO route failed: ${pathname} status=${response.status}`);
    assert(robots.toLowerCase().includes('noindex, nofollow'), `Private SEO route is not noindex: ${pathname} x-robots-tag=${robots}`);
  }
  const sitemapResponse = await fetchWithRetry(`${site}/sitemap.xml`, { redirect: 'follow' });
  const sitemap = await sitemapResponse.text();
  live.sitemap = { status: sitemapResponse.status, sha256: `sha256:${crypto.createHash('sha256').update(sitemap).digest('hex')}` };
  assert(sitemapResponse.ok, `sitemap.xml failed: ${sitemapResponse.status}`);
  for (const requiredPath of ['/platform-v7/secure-grain-deal', '/platform-v7/fgis-zerno', '/platform-v7/deal-flow']) assert(sitemap.includes(requiredPath), `sitemap.xml missing ${requiredPath}`);
  for (const forbiddenPath of ['/platform-v7/buyer', '/platform-v7/bank', '/platform-v7/deals/', '/platform-v7/lots/', '/platform-v7/counterparty/', '/platform-v7/demo']) assert(!sitemap.includes(forbiddenPath), `sitemap.xml exposes forbidden route ${forbiddenPath}`);
  const robotsResponse = await fetchWithRetry(`${site}/robots.txt`, { redirect: 'follow' });
  const robotsText = await robotsResponse.text();
  live.robots = { status: robotsResponse.status, sha256: `sha256:${crypto.createHash('sha256').update(robotsText).digest('hex')}` };
  assert(robotsResponse.ok, `robots.txt failed: ${robotsResponse.status}`);
  assert(robotsText.includes('/platform-v7/secure-grain-deal'), 'robots.txt missing secure-grain-deal');
  assert(robotsText.includes('/platform-v7/buyer'), 'robots.txt missing protected buyer disallow');
  fs.writeFileSync(path.join(auditDir, 'evidence', 'live-sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(auditDir, 'evidence', 'live-robots.txt'), robotsText);
  report.liveSeo = live;
}

try {
  report.mainRef.startSha = await resolveMainSha();
  assert(report.mainRef.startSha === targetSha, `main mismatch at start: expected ${targetSha}, actual ${report.mainRef.startSha}`);
  let rollup = await exactMainRollup();
  await ensureImmutableRun(rollup);
  rollup = await waitForStableExactMainRollup();
  report.exactMainChecks.rollupState = rollup.rollupState;
  report.exactMainChecks.checkRuns = rollup.checkRuns;
  report.exactMainChecks.statusContexts = rollup.statusContexts;
  writeJson('exact-main-graphql-rollup.json', rollup);
  assert(rollup.checkRuns.length > 0, 'No exact-main GitHub Actions check runs found');
  for (const checkRun of rollup.checkRuns) {
    assert(checkRun.status === 'completed', `Exact-main check not completed: ${checkRun.name} (${checkRun.status})`);
    assert(allowedConclusions.has(checkRun.conclusion), `Exact-main check non-passing: ${checkRun.name} (${checkRun.conclusion})`);
  }
  for (const status of rollup.statusContexts) {
    if (status.state === 'failure' && legacyExternalContexts.has(status.context)) {
      warnings.push(`Legacy external status remains failed under #2600: ${status.context}`);
    }
  }
  for (const [workflowName, config] of Object.entries(required)) await verifyWorkflow(workflowName, config, rollup);
  await verifyLiveSeo();
  report.mainRef.endSha = await resolveMainSha();
  assert(report.mainRef.endSha === targetSha, `main mismatch at end: expected ${targetSha}, actual ${report.mainRef.endSha}`);
  assert(Boolean(report.requiredWorkflows['Production-like Kubernetes Acceptance']?.evidence?.productionLikeKubernetes), 'Validated Kubernetes evidence missing');
  assert(Boolean(report.requiredWorkflows['Immutable Release Authority Acceptance']?.evidence?.immutableRelease), 'Validated immutable release evidence missing');
  assert(Boolean(report.requiredWorkflows['Immutable Release Authority Acceptance']?.evidence?.migrationSecurity), 'Validated migration security evidence missing');
} catch (error) {
  addError(`Audit execution failed: ${error.stack || error.message}`);
}

report.pass = errors.length === 0;
report.verdict = report.pass ? 'PASS' : 'FAIL';
report.auditedAt = new Date().toISOString();
fs.writeFileSync(path.join(auditDir, 'exact-main-0a45-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(auditDir, 'verdict.txt'), `${report.verdict}\n`);
console.log(JSON.stringify({ verdict: report.verdict, errors, warnings, apiRetries, mainRef: report.mainRef, requiredWorkflows: Object.fromEntries(Object.entries(report.requiredWorkflows).map(([name, value]) => [name, value.run])), liveSeo: report.liveSeo }, null, 2));
