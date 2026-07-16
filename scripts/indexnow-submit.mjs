import fs from 'node:fs';
import path from 'node:path';

const siteUrl = process.env.SITE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const indexNowKey = process.env.INDEXNOW_KEY || 'a7a2b84a1d594be0b7648166c4c4cf26';
const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const expectedDeploySha = process.env.EXPECTED_DEPLOY_SHA || '';
const evidenceFile = process.env.INDEXNOW_EVIDENCE || 'artifacts/indexnow/indexnow-evidence.json';
const publicSeoAuthority = JSON.parse(
  fs.readFileSync(new URL('../apps/web/lib/platform-v7/public-seo-routes.json', import.meta.url), 'utf8'),
);
const defaultPaths = [
  ...publicSeoAuthority.routes.map((route) => route.path),
  '/sitemap.xml',
  '/robots.txt',
];
const paths = (process.env.INDEXNOW_URLS ? process.env.INDEXNOW_URLS.split(',') : defaultPaths)
  .map((value) => value.trim())
  .filter(Boolean);

if (!/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey)) {
  throw new Error('INDEXNOW_KEY must contain 8-128 letters, digits or dashes.');
}

const origin = new URL(siteUrl).origin;
const keyLocation = `${origin}/${indexNowKey}.txt`;
const payload = {
  host: new URL(origin).host,
  key: indexNowKey,
  keyLocation,
  urlList: paths.map((value) => new URL(value, origin).toString()),
};

for (const url of payload.urlList) {
  if (new URL(url).host !== payload.host) {
    throw new Error(`IndexNow URL does not belong to payload host: ${url}`);
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evidence = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || 'pachaninm-lab/pachanin-demo',
  branch: process.env.GITHUB_REF_NAME || null,
  commitSha: process.env.GITHUB_SHA || expectedDeploySha || null,
  endpoint,
  host: payload.host,
  keyLocation,
  urlCount: payload.urlList.length,
  checkedAt: new Date().toISOString(),
  deployAttempts: [],
  keyVerificationAttempts: [],
  submissionAttempts: [],
  violatedThresholds: [],
  pass: false,
  result: 'FAIL',
};

function persistEvidence() {
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
  evidence.checkedAt = new Date().toISOString();
  fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function fetchWithRetry(url, options, attempts, classify) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const body = await response.text();
      const record = { attempt, status: response.status, bodyPrefix: body.slice(0, 500) };
      classify(record);
      if (response.ok) return { response, body };
      lastError = new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 500)}`);
      if (!(response.status === 403 || response.status === 429 || response.status >= 500)) throw lastError;
    } catch (error) {
      lastError = error;
      classify({ attempt, error: String(error) });
    }
    if (attempt === attempts) throw lastError;
    await sleep(Math.min(60_000, 2_000 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

try {
  if (expectedDeploySha) {
    const deployEvidenceUrl = `${origin}/.well-known/pc-deploy.json`;
    let matched = false;
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      try {
        const response = await fetch(`${deployEvidenceUrl}?expected=${expectedDeploySha}&attempt=${attempt}`, { cache: 'no-store' });
        const body = await response.text();
        let liveSha = null;
        try {
          liveSha = JSON.parse(body).commitSha || null;
        } catch {
          liveSha = null;
        }
        evidence.deployAttempts.push({ attempt, status: response.status, liveSha });
        if (response.ok && liveSha === expectedDeploySha) {
          matched = true;
          break;
        }
      } catch (error) {
        evidence.deployAttempts.push({ attempt, error: String(error) });
      }
      if (attempt < 60) await sleep(20_000);
    }
    if (!matched) {
      throw new Error(`Production did not expose exact deployment ${expectedDeploySha}.`);
    }
  }

  const keyVerification = await fetchWithRetry(
    `${keyLocation}?verification=${encodeURIComponent(expectedDeploySha || Date.now())}`,
    { cache: 'no-store' },
    8,
    (record) => evidence.keyVerificationAttempts.push(record),
  );
  if (keyVerification.body.trim() !== indexNowKey) {
    throw new Error(`IndexNow key file content mismatch at ${keyLocation}.`);
  }

  const submission = await fetchWithRetry(
    endpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    },
    8,
    (record) => evidence.submissionAttempts.push(record),
  );

  evidence.acceptedStatus = submission.response.status;
  evidence.pass = true;
  evidence.result = 'PASS';
  persistEvidence();
  console.log(`IndexNow submit accepted for ${payload.urlList.length} URLs with HTTP ${submission.response.status}.`);
} catch (error) {
  evidence.violatedThresholds.push(error.message || String(error));
  persistEvidence();
  throw error;
}
