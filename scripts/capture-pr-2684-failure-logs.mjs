import fs from 'node:fs';
import path from 'node:path';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const outputDir = 'audit-results/pr-2684/failure-logs';
const jobs = {
  labeler: 87767685176,
  automerge: 87767685102,
  autopilotGuard: 87767685147,
  gitleaks: 87767705609,
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

async function fetchLog(jobId) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repository}/actions/jobs/${jobId}/logs`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'pachanin-demo-pr-2684-log-capture',
        },
        redirect: 'follow',
      });
      if (response.ok) return response.text();
      const body = await response.text();
      lastError = new Error(`${response.status}: ${body.slice(0, 500)}`);
      if (!(response.status === 429 || response.status >= 500)) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 8) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 2000 * 2 ** (attempt - 1))));
  }
  throw lastError;
}

const summary = { schemaVersion: 1, repository, capturedAt: new Date().toISOString(), jobs: {} };
for (const [name, jobId] of Object.entries(jobs)) {
  const text = (await fetchLog(jobId)).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const tail = lines.slice(-500);
  const errors = lines.filter((line) => /##\[error\]|Error:|ERR!|failed|failure|Process completed|unexpected input|not found|denied|invalid|gitleaks|secret/i.test(line));
  fs.writeFileSync(path.join(outputDir, `${name}.tail.txt`), `${tail.join('\n')}\n`);
  fs.writeFileSync(path.join(outputDir, `${name}.errors.txt`), `${errors.join('\n')}\n`);
  summary.jobs[name] = { jobId, lineCount: lines.length, errorLineCount: errors.length };
}
fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
