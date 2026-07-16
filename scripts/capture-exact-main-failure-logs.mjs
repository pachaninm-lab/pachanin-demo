import fs from 'node:fs';
import path from 'node:path';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const auditHead = process.env.AUDIT_HEAD;
const outputDir = 'audit-results/exact-main-0a45/failure-logs';
const jobs = {
  seo: 87752601689,
  indexnow: 87752601156,
  securityAbuse: 87752601798,
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'pachanin-demo-failure-log-capture',
        },
        redirect: 'follow',
      });
      if (response.ok) return response.text();
      const body = await response.text();
      lastError = new Error(`${response.status} ${body.slice(0, 500)}`);
      if (!(response.status === 429 || response.status >= 500)) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 8) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 2_000 * 2 ** (attempt - 1))));
  }
  throw lastError;
}

const summary = {
  schemaVersion: 1,
  repository,
  auditHead,
  capturedAt: new Date().toISOString(),
  jobs: {},
};

for (const [name, jobId] of Object.entries(jobs)) {
  const text = await fetchText(`https://api.github.com/repos/${repository}/actions/jobs/${jobId}/logs`);
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const tail = lines.slice(-350).join('\n');
  const errorLines = lines.filter((line) => /##\[error\]|Error:|ERR!|failed|failure|403|404|500|502|503|Required base security job|not successful/i.test(line));
  fs.writeFileSync(path.join(outputDir, `${name}.tail.log`), `${tail}\n`);
  fs.writeFileSync(path.join(outputDir, `${name}.errors.log`), `${errorLines.join('\n')}\n`);
  summary.jobs[name] = {
    jobId,
    lineCount: lines.length,
    tailSha256: await sha256(tail),
    errorLineCount: errorLines.length,
  };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
