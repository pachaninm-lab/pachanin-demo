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

if (!repository || !/^[0-9a-f]{40}$/.test(targetSha || '') || !auditDir || !token) {
  throw new Error('Exact-main audit environment is incomplete.');
}

const required = {
  'SEO Live Smoke': {
    jobs: ['Verify production SEO headers'],
    artifacts: [`seo-live-${targetSha}`],
  },
  'IndexNow Submit': {
    jobs: ['Submit public URLs to IndexNow'],
    artifacts: [`indexnow-${targetSha}`],
  },
  'Security Quality Gate': {
    jobs: ['Security Gate · all blocking checks'],
    artifacts: [],
  },
  'Security Abuse and Evidence Acceptance': {
    jobs: ['Security abuse · exact-head evidence manifest'],
    artifacts: [
      `security-evidence-manifest-${targetSha}`,
      `security-abuse-${targetSha}`,
    ],
  },
  'Runtime Context Security Gate': {
    jobs: [
      'Runtime evidence · exact-head manifest',
      'Runtime Context Gate · all blocking checks',
    ],
    artifacts: [`runtime-security-manifest-${targetSha}`],
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
  schemaVersion: 1,
  repository,
  target: { branch: targetBranch, commitSha: targetSha },
  auditedAt: new Date().toISOString(),
  auditExecution: {
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1),
    auditHead: process.env.AUDIT_HEAD,
  },
  mainRef: { startSha: null, endSha: null },
  exactMainChecks: { rollupState: null, effectiveCheckRuns: [], statusContexts: [] },
  dispatches: [],
  requiredWorkflows: {},
  live: null,
  warnings,
  errors,
  apiRetries,
  maturityBoundary: {
    productionOperationallyAccepted: 'NO_GO',
    issue2649RemainsOpen: true,
    issue2600RemainsOpen: true,
    acceptedSlice: 'exact-main CI, live SEO, IndexNow, security, runtime, Kubernetes and immutable-release evidence only',
  },
  pass: false,
  verdict: 'FAIL',
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : null;

function addError(message) {
  errors.push(message);
  console.error(`AUDIT_ERROR: ${message}`);
}

function assert(condition, message) {
  if (!condition) addError(message);
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
          'User-Agent': 'pachanin-demo-exact-main-452d-audit',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (response.ok) {
        if (options.binary) return Buffer.from(await response.arrayBuffer());
        if (response.status === 204) return null;
        return response.json();
      }
      const body = await response.text();
      lastError = new Error(`GitHub API ${response.status} for ${url}: ${body.slice(0, 1200)}`);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 10) throw lastError;
      const retryAfterMs = Number(response.headers.get('retry-after') || 0) * 1000;
      const delayMs = Math.max(retryAfterMs, Math.min(60_000, 2_000 * 2 ** (attempt - 1)));
      apiRetries.push({ url, attempt, status: response.status, delayMs });
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
      await sleep(Math.min(30_000, 2_000 * 2 ** (attempt - 1)));
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
              pageInfo { hasNextPage endCursor }
              nodes {
                __typename
                ... on CheckRun {
                  databaseId
                  name
                  status
                  conclusion
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
    }));
  return { rollupState: lower(rollupState), checkRuns, statusContexts };
}

function resolveWorkflowGroup(rollup, workflowName, config) {
  const matching = rollup.checkRuns.filter((run) => run.workflowRun.workflowName === workflowName);
  const runIds = [...new Set(matching.map((run) => run.workflowRun.databaseId))]
    .sort((left, right) => Number(right) - Number(left));
  for (const runId of runIds) {
    const jobs = config.jobs.map((jobName) => matching.find((run) => run.workflowRun.databaseId === runId && run.name === jobName) || null);
    if (jobs.every(Boolean)) return { runId, jobs };
  }
  return null;
}

async function ensureImmutableRun(rollup) {
  const config = required['Immutable Release Authority Acceptance'];
  if (resolveWorkflowGroup(rollup, 'Immutable Release Authority Acceptance', config)) return;
  await request(`${apiBase}/actions/workflows/${config.workflowFile}/dispatches`, {
    method: 'POST',
    body: { ref: targetBranch },
  });
  report.dispatches.push({ workflow: 'Immutable Release Authority Acceptance', ref: targetBranch, dispatchedAt: new Date().toISOString() });
}

async function waitForStableExactMainRollup() {
  const deadline = Date.now() + 100 * 60 * 1000;
  let stableSnapshot = null;
  while (Date.now() < deadline) {
    const currentMain = await resolveMainSha();
    if (currentMain !== targetSha) throw new Error(`main moved during audit: expected ${targetSha}, actual ${currentMain}`);
    const rollup = await exactMainRollup();
    const groups = Object.fromEntries(Object.entries(required).map(([name, config]) => [name, resolveWorkflowGroup(rollup, name, config)]));
    const requiredReady = Object.values(groups).every((group) => group?.jobs.every((job) => job.status === 'completed'));
    const active = rollup.checkRuns.filter((run) => run.status !== 'completed');
    console.log(JSON.stringify({
      observedAt: new Date().toISOString(),
      rollupState: rollup.rollupState,
      active: active.map((run) => `${run.workflowRun.workflowName}/${run.name}:${run.status}`),
      required: Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, group ? Object.fromEntries(group.jobs.map((job) => [job.name, `${job.status}/${job.conclusion}`])) : 'missing'])),
    }));
    if (requiredReady && active.length === 0) {
      const snapshot = rollup.checkRuns.map((run) => `${run.databaseId}:${run.status}:${run.conclusion}`).sort().join('|');
      if (stableSnapshot === snapshot) return rollup;
      stableSnapshot = snapshot;
      await sleep(30_000);
    } else {
      stableSnapshot = null;
      await sleep(20_000);
    }
  }
  throw new Error('Timed out waiting for stable exact-main GitHub Actions rollup.');
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

function verifySeo(extractDir) {
  const file = findUnique(extractDir, 'seo-live-evidence.json');
  if (!file) return null;
  const evidence = readJson(file, 'SEO live evidence');
  if (!evidence) return null;
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'SEO exact-main mismatch');
  assert(evidence.pass === true && evidence.result === 'PASS', 'SEO evidence did not pass');
  assert(Array.isArray(evidence.violatedThresholds) && evidence.violatedThresholds.length === 0, 'SEO thresholds violated');
  assert(Array.isArray(evidence.public) && evidence.public.length >= 4 && evidence.public.every((entry) => /index, follow/i.test(entry.xRobotsTag || '')), 'SEO public authority invalid');
  assert(Array.isArray(evidence.private) && evidence.private.length >= 3 && evidence.private.every((entry) => /noindex, nofollow/i.test(entry.xRobotsTag || '')), 'SEO private authority invalid');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

function verifyIndexNow(extractDir) {
  const file = findUnique(extractDir, 'indexnow-evidence.json');
  if (!file) return null;
  const evidence = readJson(file, 'IndexNow evidence');
  if (!evidence) return null;
  assert(evidence.commitSha === targetSha, 'IndexNow exact-main mismatch');
  assert(evidence.pass === true && evidence.result === 'PASS', 'IndexNow evidence did not pass');
  assert(Array.isArray(evidence.violatedThresholds) && evidence.violatedThresholds.length === 0, 'IndexNow thresholds violated');
  assert([200, 202].includes(evidence.acceptedStatus), `IndexNow acceptance status invalid: ${evidence.acceptedStatus}`);
  assert(String(evidence.keyLocation || '').endsWith('/transparent-price-indexnow.txt'), 'IndexNow root key location mismatch');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

function verifySecurityManifest(extractDir) {
  const file = findUnique(extractDir, 'security-evidence-manifest.json');
  if (!file) return null;
  const evidence = readJson(file, 'Security evidence manifest');
  if (!evidence) return null;
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'Security manifest exact-main mismatch');
  assert(evidence.passed === true, 'Security manifest did not pass');
  assert(evidence.summary?.dependencyHighOrCritical === 0 && evidence.summary?.dependencyBlocked === 0 && evidence.summary?.containerBlocked === 0, 'Security manifest contains blocked findings');
  assert(evidence.summary?.evaluatorFixtures === 3 && evidence.summary?.evaluatorFixturesPassed === 3, 'Security evaluator fixtures incomplete');
  assert(evidence.summary?.abuseScenarios === 10 && evidence.summary?.abusePassed === 10, 'Security abuse scenarios incomplete');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

function verifySecurityAbuse(extractDir) {
  const file = findUnique(extractDir, 'security-abuse-evidence.json');
  if (!file) return null;
  const evidence = readJson(file, 'Security abuse evidence');
  if (!evidence) return null;
  const commitSha = evidence.commitSha || evidence.validatedCommit;
  assert(commitSha === targetSha, 'Security abuse exact-main mismatch');
  assert((evidence.passed ?? evidence.valid) === true, 'Security abuse evidence did not pass');
  assert(Array.isArray(evidence.scenarios) && evidence.scenarios.length === 10 && evidence.scenarios.every((scenario) => scenario.passed === true), 'Security abuse scenarios are not 10/10');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

function verifyRuntime(extractDir) {
  const file = findUnique(extractDir, 'runtime-security-manifest.json');
  if (!file) return null;
  const evidence = readJson(file, 'Runtime security manifest');
  if (!evidence) return null;
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'Runtime manifest exact-main mismatch');
  assert(evidence.passed === true, 'Runtime manifest did not pass');
  assert(evidence.canonicalImages?.api?.highOrCritical === 0 && evidence.canonicalImages?.web?.highOrCritical === 0, 'Runtime images contain HIGH/CRITICAL findings');
  assert(evidence.canonicalImages?.api?.user === 'nonroot' && evidence.canonicalImages?.web?.user === 'nonroot', 'Runtime image user is not nonroot');
  assert(evidence.runtimePolicy?.violations === 0 && evidence.helm?.lintPassed === true, 'Runtime policy or Helm lint failed');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

function verifyKubernetes(extractDir) {
  const file = findUnique(extractDir, 'production-like-kubernetes-evidence.json');
  if (!file) return null;
  const evidence = readJson(file, 'Production-like Kubernetes evidence');
  if (!evidence) return null;
  assert(evidence.repository === repository && evidence.commitSha === targetSha && evidence.branch === targetBranch, 'Kubernetes exact-main mismatch');
  assert(evidence.pass === true && evidence.result === 'PASS' && evidence.failureReason === null, 'Kubernetes evidence did not pass');
  assert(Array.isArray(evidence.violatedThresholds) && evidence.violatedThresholds.length === 0, 'Kubernetes thresholds violated');
  assert(evidence.release?.sourceCommit === targetSha, 'Kubernetes release source commit mismatch');
  assert(evidence.actualMeasurements?.mutablePlatformImageReferences === 0 && evidence.actualMeasurements?.rollbackDigestMismatches === 0, 'Kubernetes immutable/rollback measurements invalid');
  assert(evidence.assertions?.immutablePlatformImages === true && evidence.assertions?.rollingUpdateDigestSetApplied === true && evidence.assertions?.sameSchemaRollbackDigestSetRestored === true, 'Kubernetes assertions incomplete');
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
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'Immutable release exact-main mismatch');
  assert(evidence.pass === true && Array.isArray(evidence.violatedThresholds) && evidence.violatedThresholds.length === 0, 'Immutable release evidence did not pass');
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
  assert(evidence.repository === repository && evidence.commitSha === targetSha, 'Migration security exact-main mismatch');
  assert(evidence.passed === true && evidence.scannerResult === 'success' && evidence.recognizedReportShape === true, 'Migration security evidence did not pass');
  assert(evidence.summary?.highOrCritical === 0 && evidence.summary?.blocked === 0, 'Migration security contains blocked findings');
  fs.copyFileSync(file, path.join(auditDir, 'evidence', path.basename(file)));
  return { evidenceSha256: sha256File(file), evidence };
}

const validators = {
  'seo-live-': verifySeo,
  'indexnow-': verifyIndexNow,
  'security-evidence-manifest-': verifySecurityManifest,
  'security-abuse-': verifySecurityAbuse,
  'runtime-security-manifest-': verifyRuntime,
  'production-like-kubernetes-': verifyKubernetes,
  'immutable-release-build-': verifyImmutable,
  'immutable-release-migration-security-': verifyMigrationSecurity,
};

async function verifyWorkflow(workflowName, config, rollup) {
  const group = resolveWorkflowGroup(rollup, workflowName, config);
  assert(Boolean(group), `Required workflow group missing: ${workflowName}`);
  if (!group) return;
  for (const job of group.jobs) {
    assert(job.status === 'completed' && job.conclusion === 'success', `Required job did not succeed: ${workflowName} / ${job.name}`);
  }
  const first = group.jobs[0];
  assert(['push', 'workflow_dispatch'].includes(first.workflowRun.event), `Workflow event invalid: ${workflowName} (${first.workflowRun.event})`);
  if (first.suite.branch !== null) assert(first.suite.branch === targetBranch, `Workflow branch mismatch: ${workflowName} (${first.suite.branch})`);
  const artifacts = await paginateRest(`${apiBase}/actions/runs/${group.runId}/artifacts`, 'artifacts');
  writeJson(`run-${group.runId}-artifacts.json`, { artifacts });
  const workflowReport = {
    run: {
      id: group.runId,
      event: first.workflowRun.event,
      runAttempt: first.workflowRun.runAttempt,
      runNumber: first.workflowRun.runNumber,
      workflowName,
      workflowFile: first.workflowRun.workflowFile,
      url: first.workflowRun.url,
      branch: first.suite.branch,
      headSha: targetSha,
    },
    jobs: group.jobs,
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
    const validatorEntry = Object.entries(validators).find(([prefix]) => artifactName.startsWith(prefix));
    const evidence = validatorEntry ? validatorEntry[1](extractDir) : null;
    workflowReport.artifacts.push({
      id: artifact.id,
      name: artifact.name,
      sizeInBytes: artifact.size_in_bytes,
      digest: artifact.digest,
      calculatedDigest,
      expired: artifact.expired,
    });
    if (evidence) workflowReport.evidence[validatorEntry[0].replace(/-$/, '')] = evidence;
  }
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, cache: 'no-store', redirect: options.redirect || 'manual' });
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt === 30) throw lastError;
    await sleep(Math.min(30_000, 2_000 * 2 ** Math.min(attempt - 1, 4)));
  }
  throw lastError;
}

async function verifyLive() {
  const site = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
  const live = { checkedAt: new Date().toISOString(), deploy: null, indexNowKey: null, public: [], private: [], sitemap: {}, robots: {} };
  let deployMatched = false;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(`${site}/.well-known/pc-deploy.json?expected=${targetSha}&attempt=${attempt}`, { cache: 'no-store' });
      const body = await response.text();
      const payload = JSON.parse(body);
      live.deploy = { status: response.status, payload, attempt };
      if (response.ok && payload.commitSha === targetSha) {
        deployMatched = true;
        break;
      }
    } catch (error) {
      live.deploy = { attempt, error: String(error) };
    }
    if (attempt < 60) await sleep(20_000);
  }
  assert(deployMatched, `Production did not expose exact deployment ${targetSha}`);

  const keyResponse = await fetchWithRetry(`${site}/transparent-price-indexnow.txt?acceptance_sha=${targetSha}`, { redirect: 'follow' });
  const keyBody = await keyResponse.text();
  live.indexNowKey = { status: keyResponse.status, body: keyBody.trim() };
  assert(keyResponse.ok && keyBody.trim() === 'transparent-price-indexnow', 'Live IndexNow root key file mismatch');

  const publicPaths = ['/platform-v7', '/platform-v7/secure-grain-deal', '/platform-v7/fgis-zerno', '/platform-v7/deal-flow'];
  const privatePaths = ['/platform-v7/buyer', '/platform-v7/bank', '/platform-v7/deals/DL-9102/clean'];
  for (const pathname of publicPaths) {
    const response = await fetchWithRetry(`${site}${pathname}?acceptance_sha=${targetSha}`, { method: 'HEAD', redirect: 'manual' });
    const robots = response.headers.get('x-robots-tag') || '';
    live.public.push({ pathname, status: response.status, xRobotsTag: robots });
    assert(response.status >= 200 && response.status < 400, `Public route failed: ${pathname} status=${response.status}`);
    assert(/index, follow/i.test(robots), `Public route is not indexable: ${pathname} x-robots-tag=${robots}`);
  }
  for (const pathname of privatePaths) {
    const response = await fetchWithRetry(`${site}${pathname}?acceptance_sha=${targetSha}`, { method: 'HEAD', redirect: 'manual' });
    const robots = response.headers.get('x-robots-tag') || '';
    live.private.push({ pathname, status: response.status, xRobotsTag: robots });
    assert(response.status >= 200 && response.status < 400, `Private route failed: ${pathname} status=${response.status}`);
    assert(/noindex, nofollow/i.test(robots), `Private route is not noindex: ${pathname} x-robots-tag=${robots}`);
  }

  const sitemapResponse = await fetchWithRetry(`${site}/sitemap.xml?acceptance_sha=${targetSha}`, { redirect: 'follow' });
  const sitemap = await sitemapResponse.text();
  live.sitemap = { status: sitemapResponse.status, sha256: `sha256:${crypto.createHash('sha256').update(sitemap).digest('hex')}` };
  assert(sitemapResponse.ok, `sitemap.xml failed: ${sitemapResponse.status}`);
  for (const requiredPath of publicPaths) assert(sitemap.includes(requiredPath), `sitemap.xml missing ${requiredPath}`);
  for (const forbiddenPath of ['/platform-v7/buyer', '/platform-v7/bank', '/platform-v7/deals/', '/platform-v7/lots/', '/platform-v7/counterparty/', '/platform-v7/demo']) {
    assert(!sitemap.includes(forbiddenPath), `sitemap.xml exposes forbidden route ${forbiddenPath}`);
  }
  const robotsResponse = await fetchWithRetry(`${site}/robots.txt?acceptance_sha=${targetSha}`, { redirect: 'follow' });
  const robotsText = await robotsResponse.text();
  live.robots = { status: robotsResponse.status, sha256: `sha256:${crypto.createHash('sha256').update(robotsText).digest('hex')}` };
  assert(robotsResponse.ok, `robots.txt failed: ${robotsResponse.status}`);
  assert(robotsText.includes('/platform-v7/secure-grain-deal'), 'robots.txt missing public secure-grain-deal');
  assert(robotsText.includes('/platform-v7/buyer'), 'robots.txt missing protected buyer disallow');
  fs.writeFileSync(path.join(auditDir, 'evidence', 'live-sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(auditDir, 'evidence', 'live-robots.txt'), robotsText);
  report.live = live;
}

try {
  report.mainRef.startSha = await resolveMainSha();
  assert(report.mainRef.startSha === targetSha, `main mismatch at start: expected ${targetSha}, actual ${report.mainRef.startSha}`);
  let rollup = await exactMainRollup();
  await ensureImmutableRun(rollup);
  rollup = await waitForStableExactMainRollup();
  report.exactMainChecks.rollupState = rollup.rollupState;
  report.exactMainChecks.effectiveCheckRuns = rollup.checkRuns;
  report.exactMainChecks.statusContexts = rollup.statusContexts;
  writeJson('exact-main-graphql-rollup.json', rollup);
  assert(rollup.checkRuns.length > 0, 'No exact-main GitHub Actions check runs found');
  for (const checkRun of rollup.checkRuns) {
    assert(checkRun.status === 'completed', `Exact-main check not completed: ${checkRun.workflowRun.workflowName}/${checkRun.name}`);
    assert(allowedConclusions.has(checkRun.conclusion), `Exact-main check non-passing: ${checkRun.workflowRun.workflowName}/${checkRun.name} (${checkRun.conclusion})`);
  }
  for (const status of rollup.statusContexts) {
    if (status.state === 'failure' && legacyExternalContexts.has(status.context)) {
      warnings.push(`Legacy external status remains failed under #2600: ${status.context}`);
    }
  }
  for (const [workflowName, config] of Object.entries(required)) {
    await verifyWorkflow(workflowName, config, rollup);
  }
  await verifyLive();
  report.mainRef.endSha = await resolveMainSha();
  assert(report.mainRef.endSha === targetSha, `main mismatch at end: expected ${targetSha}, actual ${report.mainRef.endSha}`);
} catch (error) {
  addError(`Audit execution failed: ${error.stack || error.message || String(error)}`);
}

report.pass = errors.length === 0;
report.verdict = report.pass ? 'PASS' : 'FAIL';
report.auditedAt = new Date().toISOString();
fs.writeFileSync(path.join(auditDir, 'exact-main-452d-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(auditDir, 'verdict.txt'), `${report.verdict}\n`);
console.log(JSON.stringify({
  verdict: report.verdict,
  mainRef: report.mainRef,
  dispatches: report.dispatches,
  workflows: Object.fromEntries(Object.entries(report.requiredWorkflows).map(([name, value]) => [name, {
    run: value.run,
    artifacts: value.artifacts,
  }])),
  live: report.live,
  warnings,
  errors,
}, null, 2));
if (!report.pass) process.exit(1);
