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

function fingerprint(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length >= 72 && line.length <= 180)
    .filter((line) => !/^(import |export \{|from |\/\/|\*|#|describe\(|it\(|expect\(|console\.|throw new Error\(|return \{|class |interface |type )/.test(line))
    .filter((line) => /[A-Za-zА-Яа-я]{6,}/.test(line));
  const unique = [...new Set(lines)];
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return unique[0] ?? null;
}

const jobs = files.map((path) => ({ path, phrase: fingerprint(path) })).filter((job) => job.phrase);
const findings = [];
const errors = [];
let queries = 0;

function waitFromHeaders(response) {
  const remaining = Number(response.headers.get('x-ratelimit-remaining') ?? '999');
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? '0') * 1000;
  if (remaining <= 1 && reset > Date.now()) return Math.max(1000, reset - Date.now() + 1500);
  return 0;
}

async function searchCode(url, path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'transparent-price-ip-clean-room',
      },
    });
    queries += 1;
    const rateWait = waitFromHeaders(response);
    if (response.ok) {
      const body = await response.json();
      if (rateWait) await sleep(rateWait);
      return body;
    }

    const text = await response.text();
    if (response.status !== 403 && response.status !== 429) {
      throw new Error(`GitHub code search ${response.status}: ${text.slice(0, 300)}`);
    }

    const retryAfter = Number(response.headers.get('retry-after') ?? '0') * 1000;
    const reset = Number(response.headers.get('x-ratelimit-reset') ?? '0') * 1000;
    const wait = retryAfter || (reset > Date.now() ? reset - Date.now() + 1500 : 65000);
    if (attempt === 2) throw new Error(`GitHub code search rate-limited after retries for ${path}: ${text.slice(0, 220)}`);
    await sleep(Math.max(1000, wait));
  }
  throw new Error(`GitHub code search retry loop exhausted for ${path}`);
}

for (const job of jobs) {
  const safePhrase = job.phrase.replaceAll('"', ' ').slice(0, 180);
  const q = `"${safePhrase}" -repo:${repo}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=10`;
  try {
    const body = await searchCode(url, job.path);
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
  } catch (error) {
    errors.push({ path: job.path, detail: String(error) });
  }
}

const result = {
  status: errors.length ? 'INCOMPLETE' : 'COMPLETE',
  generatedAt: new Date().toISOString(),
  repositoryExcluded: repo,
  protectedSourceFiles: files.length,
  filesWithSearchableFingerprints: jobs.length,
  queries,
  findingCount: findings.length,
  findings,
  errors,
  methodology: 'One longest distinctive 72-180 character source-line fingerprint per protected non-test source file is searched against public GitHub code, excluding this repository. The scanner obeys GitHub code_search rate-limit headers and retries bounded rate-limit responses. A hit is a review candidate, not proof of copying; no hit is not mathematical proof of originality.',
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, protectedSourceFiles: files.length, searchableFiles: jobs.length, queries, findingCount: findings.length, errors: errors.length }, null, 2));
if (errors.length) process.exitCode = 2;
