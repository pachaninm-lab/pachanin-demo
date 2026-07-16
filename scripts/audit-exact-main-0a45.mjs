import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repository = process.env.GITHUB_REPOSITORY;
const targetSha = process.env.TARGET_SHA;
const targetBranch = process.env.TARGET_BRANCH || 'main';
const auditDir = process.env.AUDIT_DIR;
const token = process.env.GITHUB_TOKEN;
const apiBase = `https://api.github.com/repos/${repository}`;
const allowedConclusions = new Set(['success', 'skipped', 'neutral']);
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
  schemaVersion: 3,
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
  exactMainRuns: [],
  requiredWorkflows: {},
  liveSeo: null,
  apiRetries,
  errors,
  warnings,
  maturityBoundary: {
    productionOperationallyAccepted: 'NO_GO',
    acceptedSlice: 'exact-main disposable multi-node Kubernetes acceptance, immutable release authority and production SEO evidence only',
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
          'User-Agent': 'pachanin-demo-exact-main-audit',
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

async function paginate(urlPath, key) {
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

async function exactMainRuns() {
  const runs = await paginate(`${apiBase}/actions/runs?head_sha=${targetSha}`, 'workflow_runs');
  return runs.filter((run) =>
    run.head_sha === targetSha &&
    run.head_branch === targetBranch &&
    ['push', 'workflow_dispatch'].includes(run.event),
  );
}

function latestByName(runs, name) {
  return runs
    .filter((run) => run.name === name)
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0] || null;
}

async function ensureImmutableRun(runs) {
  if (latestByName(runs, 'Immutable Release Authority Acceptance')) return;
  await request(`${apiBase}/actions/workflows/${required['Immutable Release Authority Acceptance'].workflowFile}/dispatches`, {
    method: 'POST',
    body: { ref: targetBranch },
  });
  report.dispatches.push({
    workflow: 'Immutable Release Authority Acceptance',
    ref: targetBranch,
    dispatchedAt: new Date().toISOString(),
  });
}

async function waitForStableExactMain() {
  const deadline = Date.now() + 75 * 60 * 1000;
  let stableSnapshot = null;
  while (Date.now() < deadline) {
    const runs = await exactMainRuns();
    const requiredRuns = Object.keys(required).map((name) => latestByName(runs, name));
    const active = runs.filter((run) => run.status !== 'completed');
    console.log(JSON.stringify({
      observedAt: new Date().toISOString(),
      totalExactMainRuns: runs.length,
      active: active.map((run) => `${run.name}#${run.run_number}:${run.status}`),
      required: Object.fromEntries(Object.keys(required).map((name, index) => [
        name,
        requiredRuns[index] ? `${requiredRuns[index].status}/${requiredRuns[index].conclusion}` : 'missing',
      ])),
    }));
    if (requiredRuns.every((run) => run?.status === 'completed') && active.length === 0) {
      const snapshot = runs.map((run) => `${run.id}:${run.status}:${run.conclusion}`).sort().join('|');
      if (stableSnapshot === snapshot) return runs;
      stableSnapshot = snapshot;
      await sleep(30_000);
    } else {
      stableSnapshot = null;
      await sleep(20_000);
    }
  }
  throw new Error('Timed out waiting for stable exact-main GitHub Actions runs');
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

async function verifyWorkflow(workflowName, config, runs) {
  const run = latestByName(runs, workflowName);
  assert(Boolean(run), `Required exact-main workflow missing: ${workflowName}`);
  if (!run) return;
  assert(run.status === 'completed' && run.conclusion === 'success', `Required workflow did not succeed: ${workflowName} (${run.status}/${run.conclusion})`);
  const jobs = await paginate(`${apiBase}/actions/runs/${run.id}/jobs?filter=latest`, 'jobs');
  writeJson(`run-${run.id}-jobs.json`, { jobs });
  for (const expectedJob of config.jobs) {
    const job = jobs.find((candidate) => candidate.name === expectedJob);
    assert(Boolean(job), `Required job missing: ${workflowName} / ${expectedJob}`);
    if (job) assert(job.status === 'completed' && job.conclusion === 'success', `Required job did not succeed: ${workflowName} / ${expectedJob}`);
  }
  const artifacts = await paginate(`${apiBase}/actions/runs/${run.id}/artifacts`, 'artifacts');
  writeJson(`run-${run.id}-artifacts.json`, { artifacts });
  const workflowReport = {
    run: { id: run.id, event: run.event, status: run.status, conclusion: run.conclusion, headSha: run.head_sha, headBranch: run.head_branch },
    jobs: jobs.map(({ id, name, status, conclusion }) => ({ id, name, status, conclusion })),
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
    workflowReport.artifacts.push({
      id: artifact.id,
      name: artifact.name,
      sizeInBytes: artifact.size_in_bytes,
      digest: artifact.digest,
      calculatedDigest,
      expired: artifact.expired,
    });
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
    const response = await fetch(`${site}${pathname}`, { method: 'HEAD', redirect: 'manual' });
    const robots = response.headers.get('x-robots-tag') || '';
    live.public.push({ pathname, status: response.status, xRobotsTag: robots });
    assert(response.status >= 200 && response.status < 400, `Public SEO route failed: ${pathname} status=${response.status}`);
    assert(robots.toLowerCase().includes('index, follow'), `Public SEO route is not indexable: ${pathname} x-robots-tag=${robots}`);
  }
  for (const pathname of privatePaths) {
    const response = await fetch(`${site}${pathname}`, { method: 'HEAD', redirect: 'manual' });
    const robots = response.headers.get('x-robots-tag') || '';
    live.private.push({ pathname, status: response.status, xRobotsTag: robots });
    assert(response.status >= 200 && response.status < 400, `Private SEO route failed: ${pathname} status=${response.status}`);
    assert(robots.toLowerCase().includes('noindex, nofollow'), `Private SEO route is not noindex: ${pathname} x-robots-tag=${robots}`);
  }
  const sitemapResponse = await fetch(`${site}/sitemap.xml`);
  const sitemap = await sitemapResponse.text();
  live.sitemap = { status: sitemapResponse.status, sha256: `sha256:${crypto.createHash('sha256').update(sitemap).digest('hex')}` };
  assert(sitemapResponse.ok, `sitemap.xml failed: ${sitemapResponse.status}`);
  for (const requiredPath of ['/platform-v7/secure-grain-deal', '/platform-v7/fgis-zerno', '/platform-v7/deal-flow']) {
    assert(sitemap.includes(requiredPath), `sitemap.xml missing ${requiredPath}`);
  }
  for (const forbiddenPath of ['/platform-v7/buyer', '/platform-v7/bank', '/platform-v7/deals/', '/platform-v7/lots/', '/platform-v7/counterparty/', '/platform-v7/demo']) {
    assert(!sitemap.includes(forbiddenPath), `sitemap.xml exposes forbidden route ${forbiddenPath}`);
  }
  const robotsResponse = await fetch(`${site}/robots.txt`);
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
  let runs = await exactMainRuns();
  await ensureImmutableRun(runs);
  runs = await waitForStableExactMain();
  report.exactMainRuns = runs.map((run) => ({
    id: run.id,
    workflowId: run.workflow_id,
    name: run.name,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
  })).sort((left, right) => left.name.localeCompare(right.name));
  writeJson('exact-main-runs.json', { workflow_runs: runs });
  assert(runs.length > 0, 'No exact-main GitHub Actions runs found');
  for (const run of runs) {
    assert(run.status === 'completed', `Exact-main run not completed: ${run.name}#${run.run_number} (${run.status})`);
    assert(allowedConclusions.has(run.conclusion), `Exact-main run non-passing: ${run.name}#${run.run_number} (${run.conclusion})`);
  }
  for (const [workflowName, config] of Object.entries(required)) {
    await verifyWorkflow(workflowName, config, runs);
  }
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
console.log(JSON.stringify({
  verdict: report.verdict,
  errors,
  warnings,
  apiRetries,
  mainRef: report.mainRef,
  requiredWorkflows: Object.fromEntries(Object.entries(report.requiredWorkflows).map(([name, value]) => [name, value.run])),
  liveSeo: report.liveSeo,
}, null, 2));
