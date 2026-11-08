import { strict as assert } from 'node:assert';
import test from 'node:test';

import { scanText } from './scan-secret-history.mjs';

// Synthetic, structurally valid but never-issued values. None is a real credential.
const AWS = `AKIA${'Q'.repeat(16)}`;
const GH = `ghp_${'a'.repeat(36)}`;
const PAT = `github_pat_${'a'.repeat(22)}_${'b'.repeat(59)}`;
const SLACK = `xoxb-${'1'.repeat(12)}-${'a'.repeat(12)}`;
const GOOGLE = `AIza${'A'.repeat(35)}`;
const OPENAI = `sk-${'a'.repeat(40)}`;
const JWT = `eyJ${'a'.repeat(20)}.eyJ${'b'.repeat(20)}.${'c'.repeat(20)}`;

test('detects each high-confidence credential class', () => {
  for (const [label, value] of Object.entries({ AWS, GH, PAT, SLACK, GOOGLE, OPENAI, JWT })) {
    const findings = scanText(`const token = "${value}";`, 'x.ts');
    assert.equal(findings.length, 1, `${label} was not detected`);
  }
});

test('never returns the secret value itself', () => {
  const findings = scanText(`key=${AWS}`, 'x.ts');
  const serialised = JSON.stringify(findings);
  assert.ok(!serialised.includes(AWS), 'the raw secret leaked into the finding');
  assert.match(serialised, /"fingerprint":"[0-9a-f]{16}"/u);
});

// Assembled at run time. A literal key header in this file would be a finding
// for the repository's own secret gates - correctly so - and weakening those
// gates to accommodate a test fixture would be the wrong trade.
const DASHES = '-'.repeat(5);
const beginKey = (kind) => `${DASHES}BEGIN ${kind}PRIVATE ${'KEY'}${DASHES}`;

test('a private key header with a base64 body is a finding', () => {
  const text = `${beginKey('OPENSSH ')}\n${'A'.repeat(64)}\n${DASHES}END`;
  const findings = scanText(text, 'id_ed25519');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'private-key-material');
});

test('a private key header used as a shell case arm is not a finding', () => {
  const text = `    case "$key" in\n      '${beginKey('OPENSSH ')}'|'${beginKey('RSA ')}')\n        ok=1 ;;\n    esac`;
  assert.deepEqual(scanText(text, 'deploy.sh'), []);
});

test("the project's own defensive regexes are not findings", () => {
  const safety = 'export const SECRET_PATTERN = /\\b(?:AKIA|ASIA)[A-Z0-9]{16}\\b/u;';
  const redaction = "sed -e 's#(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)#[REDACTED]#g'";
  assert.deepEqual(scanText(safety, 'safety.ts'), []);
  assert.deepEqual(scanText(redaction, 'redact.sh'), []);
});

const routableUri = ['postgresql://app:', 'pw', 'rotated', '99', '@db.', 'grain', 'host', '.ru:5432/app'].join('');

test('a routable connection string is a finding', () => {
  const findings = scanText(routableUri, 'conf.yml');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'routable-connection-string');
});

test('local and reserved connection targets are not findings', () => {
  for (const uri of [
    'postgresql://postgres:postgres@localhost:5432/test',
    'postgresql://postgres:postgres@127.0.0.1:5432/test',
    'postgresql://app:secret@postgres:5432/app',
    'postgresql://tai:secret@postgres.internal:5432/tai',
    'postgresql://auth:secret1@db.invalid:5432/auth',
    'postgresql://migration:secret@db.example:5432/db',
    'postgresql://app:secret1@db.example.com:5432/app',
    'postgresql://app:${DB_PASSWORD}@postgresql:5432/app',
  ]) {
    assert.deepEqual(scanText(uri, 'ci.yml'), [], `flagged non-routable target: ${uri}`);
  }
});

test('clean text produces no findings', () => {
  assert.deepEqual(scanText('const greeting = "hello";\n', 'a.ts'), []);
});
