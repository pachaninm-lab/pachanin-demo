import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
mkdirSync(outDir, { recursive: true });
const output = join(outDir, 'public-code-match-candidates.json');
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

if (!token || !repo) {
  writeFileSync(output, JSON.stringify({ status: 'INCOMPLETE', reason: 'GITHUB_TOKEN or GITHUB_REPOSITORY missing', findings: [] }, null, 2) + '\n');
  process.exit(2);
}

const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const roots = boundary.protectedRoots.map((entry) => entry.path.replace(/\/+$/, '') + '/');
const sourceExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql']);
const files = git(['ls-files', '-z']).split('\0').filter(Boolean)
  .filter((path) => roots.some((root) => path === root.slice(0, -1) || path.startsWith(root)))
  .filter((path) => sourceExt.has(extname(path).toLowerCase()))
  .filter((path) => !/\.(spec|test)\.[^.]+$/i.test(path));

function fingerprints(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length >= 72 && line.length <= 180)
    .filter((line) => !/^(import |export \{|from |\/\/|\*|#|describe\(|it\(|expect\(|console\.|throw new Error\(|return \{|class |interface |type )/.test(line))
    .filter((line) => /[A-Za-zА-Яа-я]{6,}/.test(line));
  const unique = [...new Set(lines)];
  return unique.slice(0, 2);
}

const jobs = [];
for (const path of files) {
  for (const phrase of fingerprints(path)) jobs.push({ path, phrase });
}

const findings = [];
const errors = [];
let queries = 0;
for (const job of jobs) {
  const safePhrase = job.phrase.replaceAll('"', ' ').slice(0, 180);
  const q = `"${safePhrase}" -repo:${repo}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=10`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'transparent-price-ip-clean-room',
      },
    });
    queries += 1;
    if (!response.ok) {
      const text = await response.text();
      errors.push({ path: job.path, status: response.status, detail: text.slice(0, 300) });
      if (response.status === 403 || response.status === 429) await sleep(65000);
      else await sleep(2200);
      continue;
    }
    const body = await response.json();
    if ((body.total_count ?? 0) > 0) {
      findings.push({
        sourcePath: job.path,
        fingerprint: safePhrase,
        totalCount: body.total_count,
        candidates: (body.items ?? []).map((item) => ({
          repository: item.repository?.full_name,
          path: item.path,
          htmlUrl: item.html_url,
        })),
      });
    }
    await sleep(2200);
  } catch (error) {
    errors.push({ path: job.path, detail: String(error) });
    await sleep(2200);
  }
}

const result = {
  status: errors.length ? 'INCOMPLETE' : 'COMPLETE',
  generatedAt: new Date().toISOString(),
  repositoryExcluded: repo,
  protectedSourceFiles: files.length,
  filesWithSearchableFingerprints: new Set(jobs.map((x) => x.path)).size,
  queries,
  findingCount: findings.length,
  findings,
  errors,
  methodology: 'Up to two distinctive 72-180 character source-line fingerprints per protected non-test source file are searched against public GitHub code, excluding this repository. A hit is a review candidate, not proof of copying; no hit is not mathematical proof of originality.',
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, protectedSourceFiles: files.length, queries, findingCount: findings.length, errors: errors.length }, null, 2));
if (errors.length) process.exitCode = 2;
