import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repository = process.env.REPOSITORY || 'pachaninm-lab/pachanin-demo';
const branch = process.env.BRANCH || process.env.HEAD || 'main';
const commitSha = process.env.COMMIT_REF || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

if (!/^[0-9a-f]{40}$/.test(commitSha)) {
  throw new Error(`Invalid deployment commit SHA: ${commitSha}`);
}

const outputDir = path.resolve('apps/web/public/.well-known');
const outputFile = path.join(outputDir, 'pc-deploy.json');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify({
  schemaVersion: 1,
  repository,
  branch,
  commitSha,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);

console.log(`Deployment evidence written for ${repository}@${commitSha}`);
