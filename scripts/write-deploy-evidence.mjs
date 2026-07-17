import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repository = process.env.REPOSITORY || 'pachaninm-lab/pachanin-demo';
const branch = process.env.BRANCH || process.env.HEAD || 'main';
const commitSha = process.env.COMMIT_REF || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const indexNowKey = process.env.INDEXNOW_KEY || 'transparent-price-indexnow';

if (!/^[0-9a-f]{40}$/.test(commitSha)) {
  throw new Error(`Invalid deployment commit SHA: ${commitSha}`);
}
if (!/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey)) {
  throw new Error('INDEXNOW_KEY must contain 8-128 letters, digits or dashes.');
}

const publicDir = path.resolve('apps/web/public');
const wellKnownDir = path.join(publicDir, '.well-known');
const deployEvidenceFile = path.join(wellKnownDir, 'pc-deploy.json');
const indexNowKeyFile = path.join(publicDir, `${indexNowKey}.txt`);

fs.mkdirSync(wellKnownDir, { recursive: true });
fs.writeFileSync(deployEvidenceFile, `${JSON.stringify({
  schemaVersion: 1,
  repository,
  branch,
  commitSha,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
fs.writeFileSync(indexNowKeyFile, indexNowKey);

console.log(`Deployment evidence written for ${repository}@${commitSha}`);
console.log(`IndexNow ownership file written to /${indexNowKey}.txt`);
