#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

const argv = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith('--') || value === undefined) {
    console.error('TAI_LIVE_ATTACHMENT_ARGUMENTS_INVALID');
    process.exit(2);
  }
  argv.set(key.slice(2), value);
}

const base = (argv.get('base') || '').replace(/\/$/u, '');
const fixtureRoot = resolve(argv.get('fixtures') || '');
const evidencePath = resolve(argv.get('evidence') || '');
const targetSha = argv.get('target-sha') || '';
const runUi = argv.get('ui') !== 'false';
const endpoint = `${base}/api/public-platform-assistant/attachments`;

if (!/^https:\/\/[a-z0-9.-]+$/u.test(base)) failFast('TAI_LIVE_ATTACHMENT_BASE_INVALID');
if (!/^[0-9a-f]{40}$/u.test(targetSha)) failFast('TAI_LIVE_ATTACHMENT_TARGET_INVALID');
if (!fixtureRoot || !evidencePath) failFast('TAI_LIVE_ATTACHMENT_PATH_INVALID');

function failFast(code) {
  console.error(code);
  process.exit(2);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalize(value) {
  return String(value)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '');
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, output);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
  return output;
}

function safeCode(error) {
  const candidate = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
  return /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/u.test(candidate)
    ? candidate
    : 'TAI_LIVE_ATTACHMENT_ACCEPTANCE_FAILED';
}

function assertion(condition, code) {
  if (condition) return;
  const error = new Error(code);
  error.code = code;
  throw error;
}

const evidence = {
  schemaVersion: 'tai.live-public-attachment-acceptance.v1',
  targetSha,
  baseHostHash: sha256(new URL(base).host),
  productionMutationAllowed: false,
  customerDataUsed: false,
  externalOcrServiceUsed: false,
  cases: [],
  ui: { attempted: runUi, passed: false },
  passed: false,
};

async function persistEvidence() {
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function verifyBatch(files, expectedByName) {
  const form = new FormData();
  for (const file of files) {
    const bytes = await readFile(join(fixtureRoot, file.name));
    form.append('files', new File([bytes], file.name, { type: file.mimeType }));
  }

  const started = performance.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Origin: base,
      Referer: `${base}/`,
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'TAI-Live-Attachment-Acceptance/1.0',
    },
    body: form,
    redirect: 'error',
    signal: AbortSignal.timeout(240_000),
  });
  const durationMs = Math.round(performance.now() - started);
  const responseText = await response.text();
  assertion(response.ok, `TAI_LIVE_ATTACHMENT_HTTP_${response.status}`);
  assertion(responseText.length > 0 && responseText.length <= 2_000_000, 'TAI_LIVE_ATTACHMENT_RESPONSE_INVALID');

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    const error = new Error('TAI_LIVE_ATTACHMENT_JSON_INVALID');
    error.code = 'TAI_LIVE_ATTACHMENT_JSON_INVALID';
    throw error;
  }

  for (const forbidden of [
    '192.168.0.206',
    'AI_ASSISTANT_API_KEY',
    'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
    'tenantId',
    'membershipId',
    'subjectId',
    '/var/lib/pc-release-authority',
  ]) {
    assertion(!responseText.includes(forbidden), 'TAI_LIVE_ATTACHMENT_INTERNAL_DATA_EXPOSED');
  }

  const normalizedResponse = normalize(collectStrings(payload).join('\n'));
  for (const file of files) {
    const expected = expectedByName.get(file.name);
    assertion(expected, 'TAI_LIVE_ATTACHMENT_MANIFEST_MISMATCH');
    assertion(normalizedResponse.includes(normalize(expected.token)), `TAI_LIVE_ATTACHMENT_TOKEN_MISSING_${normalize(file.mode)}`);
    const bytes = await readFile(join(fixtureRoot, file.name));
    evidence.cases.push({
      fileNameHash: sha256(file.name),
      tokenHash: sha256(expected.token),
      mode: file.mode,
      bytes: bytes.length,
      httpStatus: response.status,
      durationMs,
      passed: true,
    });
  }
}

async function verifyMobileUi(manifest) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const fileInput = page.locator('input[type="file"]');
    if ((await fileInput.count()) === 0) {
      const candidates = page.locator('button, a, [role="button"]');
      const count = Math.min(await candidates.count(), 120);
      for (let index = 0; index < count && (await fileInput.count()) === 0; index += 1) {
        const candidate = candidates.nth(index);
        if (!(await candidate.isVisible().catch(() => false))) continue;
        const label = [
          await candidate.getAttribute('aria-label'),
          await candidate.getAttribute('title'),
          await candidate.innerText().catch(() => ''),
        ]
          .filter(Boolean)
          .join(' ');
        if (!/(?:^|\s)(?:ИИ|AI)(?:\s|$)|ПОМОЩНИК|ASSISTANT/iu.test(label)) continue;
        await candidate.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(450);
      }
    }

    assertion((await fileInput.count()) === 1, 'TAI_LIVE_ATTACHMENT_CONTROL_MISSING');
    const input = fileInput.first();
    assertion(await input.isEnabled(), 'TAI_LIVE_ATTACHMENT_CONTROL_DISABLED');
    assertion((await input.getAttribute('multiple')) !== null, 'TAI_LIVE_ATTACHMENT_MULTIPLE_MISSING');
    const accept = (await input.getAttribute('accept')) || '';
    for (const required of ['.pdf', '.docx', '.xlsx', '.png', '.jpg']) {
      assertion(accept.toLowerCase().includes(required), 'TAI_LIVE_ATTACHMENT_ACCEPT_CONTRACT_INVALID');
    }

    const txt = manifest.files.find((entry) => entry.name.endsWith('.txt'));
    assertion(Boolean(txt), 'TAI_LIVE_ATTACHMENT_UI_FIXTURE_MISSING');
    await input.setInputFiles(join(fixtureRoot, txt.name));
    await page.waitForTimeout(300);
    assertion(await page.getByText(txt.name, { exact: false }).first().isVisible(), 'TAI_LIVE_ATTACHMENT_FILE_CHIP_MISSING');

    evidence.ui = {
      attempted: true,
      passed: true,
      viewport: '390x844',
      multiple: true,
      acceptHash: sha256(accept),
      selectedFileNameHash: sha256(txt.name),
    };
  } finally {
    await browser.close();
  }
}

try {
  const manifest = JSON.parse(await readFile(join(fixtureRoot, 'manifest.json'), 'utf8'));
  assertion(manifest?.schemaVersion === 'tai.live-attachment-fixtures.v1', 'TAI_LIVE_ATTACHMENT_MANIFEST_INVALID');
  assertion(Array.isArray(manifest.files) && manifest.files.length >= 7, 'TAI_LIVE_ATTACHMENT_FIXTURE_SET_INCOMPLETE');
  const expectedByName = new Map(manifest.files.map((item) => [item.name, item]));

  for (let offset = 0; offset < manifest.files.length; offset += 4) {
    await verifyBatch(manifest.files.slice(offset, offset + 4), expectedByName);
  }
  if (runUi) await verifyMobileUi(manifest);

  const requiredModes = new Set(['native-text', 'docx', 'xlsx', 'text-pdf', 'image-ocr', 'scan-pdf-ocr']);
  for (const mode of requiredModes) {
    assertion(evidence.cases.some((item) => item.mode === mode && item.passed), `TAI_LIVE_ATTACHMENT_MODE_MISSING_${normalize(mode)}`);
  }
  evidence.passed = true;
  await persistEvidence();
  console.log('TAI_LIVE_PUBLIC_ATTACHMENT_ACCEPTANCE=PASS');
} catch (error) {
  evidence.errorCode = safeCode(error);
  evidence.passed = false;
  await persistEvidence().catch(() => {});
  console.error(evidence.errorCode);
  process.exit(1);
}
