#!/usr/bin/env node
// Repeatable secret scan over the working tree or the full Git history.
//
// Patterns deliberately require a COMPLETE credential shape rather than a
// prefix. A prefix match would flag this repository's own defensive code - the
// safety filter that blocks a model from emitting an AWS key, and the log
// redaction that rewrites tokens to [REDACTED] - both of which contain the
// prefix inside a character-class regex and never a real credential.
//
// A finding never prints the secret. Only class, location and a short SHA-256
// fingerprint are emitted, so evidence can be compared without republishing the
// value.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MODE = process.argv.includes('--history') ? 'history' : 'tree';
const ROOT = process.env.SECRET_SCAN_ROOT ?? '.';
const ALLOWLIST_PATH = process.env.SECRET_SCAN_ALLOWLIST ?? 'docs/security/secret-scan-allowlist.json';

const PATTERNS = [
  { id: 'aws-access-key-id', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/gu },
  { id: 'github-fine-grained-pat', re: /\bgithub_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}\b/gu },
  { id: 'slack-bot-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,255}\b/gu },
  { id: 'google-api-key', re: /\bAIza[A-Za-z0-9_-]{35}\b/gu },
  { id: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{32,255}\b/gu },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,4096}\.eyJ[A-Za-z0-9_-]{10,4096}\.[A-Za-z0-9_-]{10,4096}\b/gu },
];

// A credential is only meaningful when it points somewhere reachable. A
// connection string aimed at localhost, a Docker service name, or a reserved
// test domain is CI configuration, not a leaked secret, and flagging ~100 of
// them would bury a real finding in noise.
const CONNECTION = /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp|smtp)(?:\+\w+)?:\/\/(?<user>[^\s:@/]{1,64}):(?<matched>[^\s:@/]{6,256})@(?<host>[^\s/:'"]{1,255})/gu;
const RESERVED_SUFFIXES = ['.internal', '.invalid', '.test', '.local', '.localdomain',
  '.example', '.example.com', '.example.org', '.example.net'];
const LOOPBACK = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

// Written as explicit checks rather than one alternation. A regex mixing `[^.]*`
// with `.*\.` backtracks polynomially on a long hostile hostname.
function isNonRoutable(host) {
  const value = host.toLowerCase();
  if (LOOPBACK.has(value)) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(value)) return true;
  if (!value.includes('.')) return true; // bare Docker/Compose service name
  return RESERVED_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

function isPlaceholder(value) {
  return value.includes('${') || value.includes('$(') || value.includes('{{');
}

// A private key header is only a finding when the following line looks like the
// base64 body of an actual key. In shell `case` arms the header sits between
// quotes with no body after it.
const KEY_HEADER = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/u;
const BASE64_BODY = /^[A-Za-z0-9+/=]{40,8192}\s*$/u;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

// A stable identifier for a finding, so two scans can be compared without ever
// republishing the value. This is not password storage: nothing is verified
// against this digest and it is never used for authentication, which is why a
// plain SHA-256 is the right primitive rather than a slow password hash.
function fingerprint(detectedValue) {
  return createHash('sha256').update(detectedValue).digest('hex').slice(0, 16);
}

export function scanText(text, location) {
  const findings = [];
  for (const { id, re } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      findings.push({ class: id, location, fingerprint: fingerprint(match[0]), length: match[0].length });
    }
  }
  for (const match of text.matchAll(CONNECTION)) {
    const { matched, host } = match.groups;
    if (isPlaceholder(matched) || isPlaceholder(host)) continue;
    if (isNonRoutable(host)) continue;
    findings.push({ class: 'routable-connection-string', location, fingerprint: fingerprint(matched), length: matched.length });
  }

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!KEY_HEADER.test(lines[i])) continue;
    const next = lines[i + 1] ?? '';
    if (BASE64_BODY.test(next)) {
      findings.push({ class: 'private-key-material', location: `${location}:${i + 1}`, fingerprint: fingerprint(next), length: next.trim().length });
    }
  }
  return findings;
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean);
}

// rev-list --objects yields commits and trees as well as blobs, and spawning one
// git process per object over a repository this size does not finish. Enumerate
// blobs by type, then stream them through a single batch reader.
function historyBlobShas() {
  const out = execFileSync('git', ['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
  });
  const shas = [];
  for (const line of out.split('\n')) {
    const [sha, type, size] = line.split(' ');
    if (type !== 'blob') continue;
    if (Number(size) > 2 * 1024 * 1024) continue; // credentials are not megabytes long
    shas.push(sha);
  }
  return shas;
}

function readBlobBatch(shas) {
  const result = spawnSync('git', ['cat-file', '--batch'], {
    cwd: ROOT, input: `${shas.join('\n')}\n`, maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('git cat-file --batch failed');
  const buffer = result.stdout;
  const blobs = [];
  let offset = 0;
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset);
    if (newline === -1) break;
    const header = buffer.toString('utf8', offset, newline);
    const [sha, type, sizeText] = header.split(' ');
    const size = Number(sizeText);
    if (type !== 'blob' || !Number.isInteger(size)) break;
    const start = newline + 1;
    blobs.push({ sha, text: buffer.toString('utf8', start, start + size) });
    offset = start + size + 1;
  }
  return blobs;
}

function loadAllowlist() {
  try {
    const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
    return new Set((parsed.allowlist ?? []).map((entry) => String(entry.blob)));
  } catch {
    return new Set();
  }
}

function main() {
  const findings = [];
  const allowed = loadAllowlist();
  let allowlisted = 0;
  let scanned = 0;

  if (MODE === 'tree') {
    for (const path of trackedFiles()) {
      let text;
      try {
        text = readFileSync(`${ROOT}/${path}`, 'utf8');
      } catch {
        continue;
      }
      scanned += 1;
      findings.push(...scanText(text, path));
    }
  } else {
    const shas = historyBlobShas();
    const CHUNK = 2000;
    for (let i = 0; i < shas.length; i += CHUNK) {
      for (const { sha, text } of readBlobBatch(shas.slice(i, i + CHUNK))) {
        scanned += 1;
        const blobFindings = scanText(text, `blob ${sha.slice(0, 12)}`);
        if (blobFindings.length === 0) continue;
        if (allowed.has(sha)) {
          allowlisted += blobFindings.length;
          continue;
        }
        findings.push(...blobFindings);
      }
    }
  }

  console.log(`secret scan (${MODE})`);
  console.log(`  objects scanned  ${scanned}`);
  console.log(`  findings         ${findings.length}`);
  console.log(`  allowlisted      ${allowlisted} (reviewed, not credentials)`);

  if (findings.length > 0) {
    console.error('\nSECRET_SCAN: FAIL_CLOSED');
    for (const finding of findings) {
      console.error(`  - ${finding.class} at ${finding.location} (sha256:${finding.fingerprint}, ${finding.length} chars)`);
    }
    console.error('\nValues are never printed. Treat every finding as COMPROMISED_UNTIL_ROTATED.');
    return 1;
  }

  console.log('\nSECRET_SCAN: NO_FINDINGS');
  console.log('  Absence of a match is not absolute proof; see SECRET_ROTATION_REGISTER.md for coverage limits.');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
