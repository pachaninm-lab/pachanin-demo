#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const TARGET_SHA = String(process.argv[2] || '').trim();
const RUN_ID = String(process.env.GEKTA_ACCEPTANCE_RUN_ID || 'manual').trim();
const LIVE_BASE = String(process.env.GEKTA_LIVE_BASE || 'https://xn----8sbjf4befbjgs9b.xn--p1ai').replace(/\/+$/u, '');
const EVIDENCE_DIR = path.resolve(process.env.GEKTA_EVIDENCE_DIR || 'artifacts/production-gekta-first-user');
const LOCATOR_FILE = path.resolve(process.env.GEKTA_OWNER_LOCATOR_FILE || path.join(EVIDENCE_DIR, '.owner-locator'));
const OWNER_TIMEOUT_SECONDS = Number.parseInt(process.env.GEKTA_OWNER_TIMEOUT_SECONDS || '1800', 10);
const REPOSITORY = String(process.env.GITHUB_REPOSITORY || '').trim();

let stage = 'bootstrap';
let browser;

class AcceptanceFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new AcceptanceFailure(code);
}

function assert(condition, code) {
  if (!condition) fail(code);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function runGh(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 256 * 1024,
    timeout: 30_000,
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function publishOwnerProgress(marker) {
  assert(/^(?:7_DAYS|30_DAYS|LIFETIME)$/u.test(marker), 'GEKTA_OWNER_PROGRESS_MARKER_INVALID');
  assertExactMain();
  const body = [
    '## Gekta production owner ceremony progress',
    '',
    `- exact main: \`${TARGET_SHA}\``,
    `- observed entitlement: \`${marker}\``,
    `- run: \`${RUN_ID}\``,
  ].join('\n');
  const result = spawnSync('gh', [
    'issue', 'comment', '3072', '--repo', REPOSITORY, '--body', body,
  ], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024,
    timeout: 30_000,
  });
  assert(result.status === 0, 'GEKTA_OWNER_PROGRESS_PUBLICATION_FAILED');
}

function assertExactMain() {
  const sha = runGh(['api', `repos/${REPOSITORY}/commits/main`, '--jq', '.sha']);
  assert(sha === TARGET_SHA, sha ? 'GEKTA_MAIN_ADVANCED_DURING_ACCEPTANCE' : 'GEKTA_EXACT_MAIN_LOOKUP_FAILED');
}

function validatePrerequisites() {
  stage = 'protected-prerequisites';
  assert(/^[0-9a-f]{40}$/u.test(TARGET_SHA), 'GEKTA_TARGET_SHA_INVALID');
  assert(/^[A-Za-z0-9._:-]{1,64}$/u.test(RUN_ID), 'GEKTA_RUN_ID_INVALID');
  assert(LIVE_BASE === 'https://xn----8sbjf4befbjgs9b.xn--p1ai', 'GEKTA_CANONICAL_LIVE_BASE_MISMATCH');
  assert(REPOSITORY === 'pachaninm-lab/pachanin-demo', 'GEKTA_REPOSITORY_AUTHORITY_INVALID');
  assert(process.env.GH_TOKEN, 'GEKTA_GITHUB_AUTHORITY_MISSING');
  assert(Number.isInteger(OWNER_TIMEOUT_SECONDS) && OWNER_TIMEOUT_SECONDS >= 300 && OWNER_TIMEOUT_SECONDS <= 2700, 'GEKTA_OWNER_TIMEOUT_INVALID');
  for (const name of ['PC_P0_EMAIL_TEMPLATE', 'PC_P0_IMAP_HOST', 'PC_P0_IMAP_USER', 'PC_P0_IMAP_PASSWORD']) {
    assert(String(process.env[name] || '').trim(), 'MISSING_GEKTA_MAILBOX_PREREQUISITE');
  }
  assert(/^\d{1,5}$/u.test(String(process.env.PC_P0_IMAP_PORT || '993')), 'MISSING_GEKTA_MAILBOX_PREREQUISITE');
  assertExactMain();
}

function syntheticIdentity() {
  const digits = RUN_ID.replace(/\D/gu, '').padStart(12, '0').slice(-12);
  return {
    phone: `+999${digits}`,
    emailIdentity: `gekta-${RUN_ID.toLowerCase().replace(/[^a-z0-9-]/gu, '-').slice(0, 44)}`,
    prompt: `Acceptance ${RUN_ID}: назови три шага проверки влажности почвы перед посевом.`,
    project: `Acceptance ${RUN_ID}`.slice(0, 80),
  };
}

function renderEmail(identity) {
  const template = String(process.env.PC_P0_EMAIL_TEMPLATE || '').trim();
  let email = '';
  if (template.split('{identity}').length === 2 && !template.includes('{run}') && !template.includes('{slot}')) {
    email = template.replace('{identity}', identity);
  } else if (!template.includes('{identity}') && template.split('{run}').length === 2 && template.split('{slot}').length === 2) {
    email = template.replace('{run}', RUN_ID).replace('{slot}', 'gekta');
  }
  email = email.toLowerCase();
  assert(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email), 'GEKTA_EMAIL_TEMPLATE_INVALID');
  return email;
}

const MAIL_READER = String.raw`
import email
import imaplib
import os
import re
import ssl
import subprocess
import time
from email.policy import default
from email.utils import getaddresses, parsedate_to_datetime
from html import unescape
from urllib.parse import parse_qs, urlparse

def canonical_address(value):
    try:
        normalized = str(value or '').strip().lower()
        if normalized.count('@') != 1:
            return None
        local, domain = normalized.rsplit('@', 1)
        local.encode('ascii')
        domain = domain.encode('idna').decode('ascii').lower()
        result = f'{local}@{domain}'
        if len(result) > 254 or not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,189}', result):
            return None
        return result
    except Exception:
        return None

host = os.environ['PC_P0_IMAP_HOST'].strip()
port = int((os.environ.get('PC_P0_IMAP_PORT') or '993').strip())
username = os.environ['PC_P0_IMAP_USER']
password = os.environ['PC_P0_IMAP_PASSWORD']
folder = (os.environ.get('PC_P0_IMAP_FOLDER') or 'INBOX').strip() or 'INBOX'
target = canonical_address(os.environ['GEKTA_TARGET_EMAIL'])
if not target:
    raise SystemExit(45)
not_before = int(os.environ['GEKTA_NOT_BEFORE']) - 300
deadline = time.time() + 240
live = os.environ['GEKTA_LIVE_BASE']
pattern = re.compile(r'https://[^\s<>"\']+/api/gekta/auth/email/verify\?[^\s<>"\']+', re.I)

def exact_main():
    result = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    return result.returncode == 0 and result.stdout.strip() == os.environ['GEKTA_TARGET_SHA']

def body_text(message):
    rows = []
    iterator = message.walk() if message.is_multipart() else (message,)
    for part in iterator:
        if part.get_content_type() not in ('text/plain', 'text/html'):
            continue
        try:
            rows.append(part.get_content())
        except Exception:
            raw = part.get_payload(decode=True) or b''
            rows.append(raw.decode(part.get_content_charset() or 'utf-8', errors='replace'))
    return unescape('\n'.join(rows))

context = ssl.create_default_context()
while time.time() < deadline:
    if not exact_main():
        raise SystemExit(42)
    client = None
    try:
        client = imaplib.IMAP4_SSL(host, port, ssl_context=context)
        client.login(username, password)
        status, _ = client.select(folder, readonly=True)
        if status != 'OK':
            raise RuntimeError('select')
        status, data = client.search(None, 'ALL')
        if status != 'OK':
            raise RuntimeError('search')
        for identifier in reversed((data[0] or b'').split()[-250:]):
            status, rows = client.fetch(identifier, '(BODY.PEEK[])')
            if status != 'OK':
                continue
            raw = next((item[1] for item in rows if isinstance(item, tuple) and len(item) > 1), None)
            if not raw:
                continue
            message = email.message_from_bytes(raw, policy=default)
            recipients = []
            for header in ('to', 'cc', 'delivered-to', 'x-original-to', 'envelope-to'):
                for _, address in getaddresses(message.get_all(header, [])):
                    canonical = canonical_address(address)
                    if canonical:
                        recipients.append(canonical)
            if target not in recipients:
                continue
            try:
                sent_at = int(parsedate_to_datetime(message.get('date')).timestamp())
            except Exception:
                sent_at = int(time.time())
            if sent_at < not_before:
                continue
            for candidate in pattern.findall(body_text(message)):
                parsed = urlparse(candidate)
                token = (parse_qs(parsed.query).get('token') or [''])[0]
                if f'{parsed.scheme}://{parsed.netloc}' != live:
                    continue
                if parsed.path != '/api/gekta/auth/email/verify':
                    continue
                if not (48 <= len(token) <= 512 and re.fullmatch(r'[A-Za-z0-9._~-]+', token)):
                    continue
                print(candidate)
                client.logout()
                raise SystemExit(0)
        client.logout()
    except SystemExit:
        raise
    except Exception:
        if client is not None:
            try:
                client.logout()
            except Exception:
                pass
    time.sleep(5)
raise SystemExit(44)
`;

function fetchVerificationUrl(email, notBefore) {
  assertExactMain();
  const result = spawnSync('python3', ['-c', MAIL_READER], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GEKTA_TARGET_EMAIL: email,
      GEKTA_NOT_BEFORE: String(notBefore),
      GEKTA_TARGET_SHA: TARGET_SHA,
      GEKTA_LIVE_BASE: LIVE_BASE,
    },
    maxBuffer: 64 * 1024,
    timeout: 270_000,
  });
  assert(result.status === 0, result.status === 42 ? 'GEKTA_MAIN_ADVANCED_DURING_EMAIL_WAIT' : 'GEKTA_VERIFICATION_EMAIL_NOT_FOUND');
  const value = result.stdout.trim();
  const parsed = new URL(value);
  assert(parsed.origin === LIVE_BASE && parsed.pathname === '/api/gekta/auth/email/verify', 'GEKTA_VERIFICATION_EMAIL_LINK_INVALID');
  return value;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value) {
  const clean = value.replace(/\s/gu, '').replace(/=+$/u, '').toUpperCase();
  assert(clean.length >= 16 && /^[A-Z2-7]+$/u.test(clean), 'GEKTA_MFA_SECRET_INVALID');
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const character of clean) {
    accumulator = (accumulator << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

async function currentTotp(secret) {
  const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (remaining < 12) await delay((remaining + 1) * 1000);
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

async function exactPublicRevision(context) {
  assertExactMain();
  const response = await context.request.get(`${LIVE_BASE}/manifest-pc-deploy.json?gekta-acceptance=${encodeURIComponent(RUN_ID)}-${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' },
    timeout: 30_000,
  });
  assert(response.status() === 200, 'GEKTA_PUBLIC_MANIFEST_UNAVAILABLE');
  const payload = await response.json().catch(() => null);
  assert(payload?.commitSha === TARGET_SHA, 'GEKTA_PUBLIC_REVISION_MISMATCH');
}

async function pageJson(page, pathName, init = {}) {
  return page.evaluate(async ({ pathName, init }) => {
    const csrf = document.cookie.split('; ').find((row) => row.startsWith('pc_csrf_token='))?.split('=').slice(1).join('=') || '';
    const request = async () => fetch(pathName, {
      method: init.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...((init.method || 'GET') === 'GET' ? {} : { 'x-csrf-token': decodeURIComponent(csrf) }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    let response = await request();
    if (response.status === 401 && pathName.startsWith('/api/gekta/account/')) {
      await fetch('/api/gekta/auth/refresh', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'x-csrf-token': decodeURIComponent(csrf) },
      });
      response = await request();
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, data };
  }, { pathName, init });
}

function isEntitlementResponse(response, method) {
  try {
    const url = new URL(response.url());
    return url.origin === LIVE_BASE
      && url.pathname === '/api/gekta/entitlement'
      && response.request().method() === method;
  } catch {
    return false;
  }
}

async function pageAnonymousStream(page, { ticket, message, conversationId }) {
  return page.evaluate(async ({ ticket, message, conversationId }) => {
    try {
      const response = await fetch('/api/agro-chat?stream=1', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'x-gekta-answer-ticket': ticket,
        },
        body: JSON.stringify({
          message,
          locale: 'ru',
          context: 'gekta-standalone',
          conversationId,
          history: [],
        }),
        signal: AbortSignal.timeout(155_000),
      });
      const contentType = response.headers.get('content-type') || '';
      const body = await response.text();
      return {
        status: response.status,
        contentType,
        meta: body.includes('"event":"meta"'),
        token: body.includes('"event":"token"'),
        done: body.includes('"event":"done"') && body.includes('"complete":true'),
        bytes: body.length,
      };
    } catch {
      return { status: 0, contentType: '', meta: false, token: false, done: false, bytes: 0 };
    }
  }, { ticket, message, conversationId });
}

async function waitFor(check, { timeoutMs = 60_000, intervalMs = 1_000, code }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(intervalMs);
  }
  fail(code);
}

function entitlementWindow(payload) {
  const entitlement = payload?.entitlement;
  const server = Date.parse(entitlement?.serverTime || '');
  const expiry = Date.parse(entitlement?.expiresAt || '');
  return {
    state: entitlement?.state || '',
    canAsk: entitlement?.canAsk === true,
    days: Number.isFinite(server) && Number.isFinite(expiry) ? (expiry - server) / 86_400_000 : null,
  };
}

async function anonymousQuotaAndHistory(page, identity) {
  stage = 'anonymous-live-answer';
  const entitlementResponsePromise = page.waitForResponse(
    (response) => isEntitlementResponse(response, 'GET'),
    { timeout: 30_000 },
  );
  await page.goto(`${LIVE_BASE}/gekta?chat=new&acceptance=${encodeURIComponent(RUN_ID)}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('[data-gekta-chat-workspace="true"]').waitFor({ state: 'visible', timeout: 30_000 });
  const entitlementResponse = await entitlementResponsePromise;
  const consentPayload = await entitlementResponse.json().catch(() => null);
  assert(
    entitlementResponse.status() === 200 && typeof consentPayload?.legalVersion === 'string',
    'GEKTA_ANONYMOUS_ENTITLEMENT_BOOTSTRAP_FAILED',
  );
  if (consentPayload?.consent?.version !== consentPayload.legalVersion) {
    const consent = page.locator('[data-gekta-consent-accept="true"]');
    await consent.waitFor({ state: 'visible', timeout: 10_000 });
    const consentResponsePromise = page.waitForResponse(
      (response) => isEntitlementResponse(response, 'POST'),
      { timeout: 30_000 },
    );
    await consent.click();
    const consentResponse = await consentResponsePromise;
    const acceptedConsent = await consentResponse.json().catch(() => null);
    assert(
      consentResponse.status() === 200
        && acceptedConsent?.consent?.version === consentPayload.legalVersion,
      'GEKTA_ANONYMOUS_CONSENT_FAILED',
    );
    await page.locator('[data-gekta-consent="true"]').waitFor({ state: 'detached', timeout: 10_000 });
    const persistedConsent = await pageJson(page, '/api/gekta/entitlement');
    assert(
      persistedConsent.status === 200
        && persistedConsent.data?.legalVersion === consentPayload.legalVersion
        && persistedConsent.data?.consent?.version === consentPayload.legalVersion,
      'GEKTA_ANONYMOUS_CONSENT_PERSISTENCE_FAILED',
    );
  }
  await page.locator('#gekta-composer-input').fill(identity.prompt);
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await page.getByRole('button', { name: 'Копировать', exact: true }).waitFor({ state: 'visible', timeout: 150_000 });

  const afterLive = await pageJson(page, '/api/gekta/entitlement');
  assert(afterLive.status === 200 && afterLive.data?.entitlement?.remaining === 9, 'GEKTA_LIVE_ANSWER_NOT_ACCOUNTED');
  console.log('GEKTA_LIVE_ANONYMOUS_ANSWER=PASS');

  stage = 'anonymous-ten-answer-boundary';
  for (let index = 0; index < 9; index += 1) {
    const reserved = await pageJson(page, '/api/gekta/entitlement', { method: 'POST', body: { action: 'reserve' } });
    assert(reserved.status === 200 && reserved.data?.allowed === true && typeof reserved.data?.ticket === 'string', 'GEKTA_ANONYMOUS_RESERVATION_FAILED');
    const streamed = await pageAnonymousStream(page, {
      ticket: reserved.data.ticket,
      message: `Acceptance ${index + 2}/10: одним коротким предложением назови один безопасный шаг осмотра поля.`,
      conversationId: `gektaaccept-${RUN_ID.toLowerCase().replace(/[^a-z0-9-]/gu, '-').slice(0, 36)}-${index + 2}`,
    });
    assert(
      streamed.status === 200
        && /^text\/event-stream/iu.test(streamed.contentType)
        && streamed.meta && streamed.token && streamed.done && streamed.bytes > 0,
      'GEKTA_DURABLE_ANONYMOUS_ANSWER_FAILED',
    );
    const usage = await pageJson(page, '/api/gekta/entitlement');
    assert(usage.status === 200 && usage.data?.entitlement?.remaining === 8 - index, 'GEKTA_DURABLE_ANONYMOUS_USAGE_MISMATCH');
  }
  const exhausted = await pageJson(page, '/api/gekta/entitlement');
  assert(exhausted.status === 200 && exhausted.data?.entitlement?.state === 'REGISTRATION_REQUIRED' && exhausted.data?.entitlement?.canAsk === false, 'GEKTA_TEN_ANSWER_BOUNDARY_FAILED');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('[data-gekta-registration-cta="true"]').waitFor({ state: 'visible', timeout: 30_000 });
  console.log('GEKTA_ANONYMOUS_TEN_ANSWER_GATE=PASS');
}

async function registerAndActivate(page, identity, email, password) {
  stage = 'registration-ui';
  await page.locator('[data-gekta-registration-cta="true"]').click();
  await page.waitForURL(/\/gekta\/register/u, { timeout: 30_000 });
  await page.locator('input[autocomplete="name"]').fill('Production Gekta Acceptance');
  await page.locator('input[autocomplete="tel"]').fill(identity.phone);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="new-password"]').fill(password);
  const checkboxes = page.locator('input[type="checkbox"]');
  assert(await checkboxes.count() === 2, 'GEKTA_SEPARATE_CONSENTS_MISSING');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  const submittedAt = Math.floor(Date.now() / 1000);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await page.getByRole('heading', { name: 'Проверьте почту', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  console.log('GEKTA_REGISTRATION_FORM=PASS');

  stage = 'real-email-verification';
  const verificationUrl = fetchVerificationUrl(email, submittedAt);
  await page.goto(verificationUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
  await page.getByRole('heading', { name: 'Защитите аккаунт', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  const secret = (await page.locator('code').innerText()).trim();
  decodeBase32(secret);
  console.log('GEKTA_REAL_EMAIL_VERIFICATION=PASS');

  stage = 'mandatory-mfa-enrollment';
  await page.getByLabel('Код MFA', { exact: true }).fill(await currentTotp(secret));
  await page.getByRole('button', { name: 'Подтвердить и начать trial', exact: true }).click();
  await page.getByRole('heading', { name: 'Сохраните резервные коды', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  assert(await page.locator('ul li').count() >= 8, 'GEKTA_MFA_BACKUP_CODES_MISSING');
  await page.getByLabel('Я сохранил резервные коды в безопасном месте', { exact: true }).check();
  await page.getByRole('button', { name: 'Перейти в Гекту', exact: true }).click();
  await page.waitForURL(/\/gekta(?:\?|$)/u, { timeout: 30_000 });
  await page.locator('[data-gekta-chat-workspace="true"]').waitFor({ state: 'visible', timeout: 30_000 });
  console.log('GEKTA_MANDATORY_MFA=PASS');
  return secret;
}

async function proveAccountWorkspace(page, identity) {
  stage = 'trial-and-phone';
  const account = await waitFor(async () => {
    const response = await pageJson(page, '/api/gekta/account/entitlement');
    return response.status === 200 ? response.data : null;
  }, { timeoutMs: 60_000, code: 'GEKTA_ACCOUNT_SESSION_NOT_READY' });
  const trial = entitlementWindow(account);
  assert(trial.state === 'TRIAL_ACTIVE' && trial.canAsk && trial.days !== null && trial.days > 29 && trial.days <= 30.1, 'GEKTA_TRIAL_WINDOW_INVALID');
  const phone = await pageJson(page, '/api/gekta/account/phone');
  assert(phone.status === 200 && phone.data?.state === 'DECLARED', 'GEKTA_DECLARED_PHONE_STATE_INVALID');
  console.log('GEKTA_THIRTY_DAY_TRIAL=PASS');
  console.log('GEKTA_PHONE_DECLARED=PASS');

  stage = 'server-history-search';
  const titleNeedle = identity.prompt.slice(0, 28);
  await waitFor(async () => {
    const response = await pageJson(page, `/api/gekta/account/conversations?search=${encodeURIComponent(titleNeedle)}`);
    return response.status === 200 && Array.isArray(response.data?.conversations) && response.data.conversations.length > 0;
  }, { timeoutMs: 90_000, intervalMs: 2_000, code: 'GEKTA_SERVER_HISTORY_IMPORT_FAILED' });
  const search = page.getByPlaceholder('Поиск по истории', { exact: true });
  await search.fill(titleNeedle);
  await page.locator('button').filter({ hasText: `Acceptance ${RUN_ID}` }).first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => fail('GEKTA_HISTORY_SEARCH_UI_FAILED'));
  console.log('GEKTA_SERVER_HISTORY_SEARCH=PASS');

  stage = 'server-projects';
  await search.fill('');
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click();
  await page.getByPlaceholder('Название проекта', { exact: true }).fill(identity.project);
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await waitFor(async () => {
    const response = await pageJson(page, '/api/gekta/account/projects');
    return response.status === 200 && response.data?.projects?.some((project) => project.name === identity.project);
  }, { timeoutMs: 45_000, code: 'GEKTA_SERVER_PROJECT_CREATE_FAILED' });
  console.log('GEKTA_SERVER_PROJECTS=PASS');
}

async function waitForOwnerGrants(page, identity) {
  stage = 'owner-ceremony-waiting';
  await mkdir(path.dirname(LOCATOR_FILE), { recursive: true });
  await writeFile(LOCATOR_FILE, `${identity.phone}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(LOCATOR_FILE, 0o600);
  console.log('GEKTA_OWNER_CEREMONY=WAITING');

  const deadline = Date.now() + OWNER_TIMEOUT_SECONDS * 1000;
  let lastAuthorityCheck = 0;
  const read = async () => {
    if (Date.now() - lastAuthorityCheck > 60_000) {
      assertExactMain();
      lastAuthorityCheck = Date.now();
    }
    const response = await pageJson(page, '/api/gekta/account/entitlement');
    return response.status === 200 ? entitlementWindow(response.data) : null;
  };

  await waitFor(async () => {
    const value = await read();
    return value?.state === 'MANUAL_ACCESS' && value.days !== null && value.days > 6.5 && value.days < 8.5;
  }, { timeoutMs: Math.max(1, deadline - Date.now()), intervalMs: 3_000, code: 'GEKTA_OWNER_7_DAY_GRANT_TIMEOUT' });
  console.log('GEKTA_OWNER_GRANT_7_DAYS=PASS');
  publishOwnerProgress('7_DAYS');

  await waitFor(async () => {
    const value = await read();
    return value?.state === 'MANUAL_ACCESS' && value.days !== null && value.days > 29 && value.days < 31.5;
  }, { timeoutMs: Math.max(1, deadline - Date.now()), intervalMs: 3_000, code: 'GEKTA_OWNER_30_DAY_GRANT_TIMEOUT' });
  console.log('GEKTA_OWNER_GRANT_30_DAYS=PASS');
  publishOwnerProgress('30_DAYS');

  await waitFor(async () => {
    const value = await read();
    return value?.state === 'LIFETIME_ACCESS' && value.canAsk;
  }, { timeoutMs: Math.max(1, deadline - Date.now()), intervalMs: 3_000, code: 'GEKTA_OWNER_LIFETIME_GRANT_TIMEOUT' });
  console.log('GEKTA_OWNER_GRANT_LIFETIME=PASS');
  publishOwnerProgress('LIFETIME');
}

async function logoutAndLogin(page, email, password, mfaSecret, identity) {
  stage = 'logout';
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.waitForURL(/\/gekta(?:\?|$)/u, { timeout: 30_000 });
  const signedOut = await page.evaluate(async () => (await fetch('/api/gekta/account/entitlement', { cache: 'no-store' })).status);
  assert(signedOut === 401, 'GEKTA_LOGOUT_SESSION_STILL_ACTIVE');
  console.log('GEKTA_LOGOUT=PASS');

  stage = 'fresh-login-mfa';
  await page.goto(`${LIVE_BASE}/gekta/register?lang=ru&acceptance=${encodeURIComponent(RUN_ID)}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('tab', { name: 'Вход', exact: true }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('heading', { name: 'Введите второй фактор', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByLabel('Код MFA', { exact: true }).fill(await currentTotp(mfaSecret));
  await page.getByRole('button', { name: 'Подтвердить и начать trial', exact: true }).click();
  await page.waitForURL(/\/gekta(?:\?|$)/u, { timeout: 30_000 });
  const lifetime = await waitFor(async () => {
    const response = await pageJson(page, '/api/gekta/account/entitlement');
    return response.status === 200 ? entitlementWindow(response.data) : null;
  }, { timeoutMs: 60_000, code: 'GEKTA_FRESH_LOGIN_SESSION_NOT_READY' });
  assert(lifetime.state === 'LIFETIME_ACCESS' && lifetime.canAsk, 'GEKTA_FRESH_LOGIN_ENTITLEMENT_LOST');
  const conversations = await pageJson(page, `/api/gekta/account/conversations?search=${encodeURIComponent(identity.prompt.slice(0, 28))}`);
  const projects = await pageJson(page, '/api/gekta/account/projects');
  assert(conversations.status === 200 && conversations.data?.conversations?.length > 0, 'GEKTA_FRESH_LOGIN_HISTORY_LOST');
  assert(projects.status === 200 && projects.data?.projects?.some((project) => project.name === identity.project), 'GEKTA_FRESH_LOGIN_PROJECT_LOST');
  console.log('GEKTA_FRESH_LOGIN_MFA=PASS');
  console.log('GEKTA_FRESH_LOGIN_WORKSPACE=PASS');
}

async function writeResult(passed, blocker = null) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const payload = {
    schemaVersion: 'production.gekta.first-user.acceptance.v1',
    passed,
    targetSha: TARGET_SHA,
    runId: RUN_ID,
    stage,
    blocker,
    checks: passed ? {
      exactPublicRevision: true,
      liveAnonymousAnswer: true,
      tenAnswerRegistrationGate: true,
      realVerificationEmail: true,
      mandatoryMfa: true,
      thirtyDayTrial: true,
      declaredPhone: true,
      serverHistorySearch: true,
      serverProjects: true,
      ownerPhoneSearch: true,
      ownerGrant7Days: true,
      ownerGrant30Days: true,
      ownerGrantLifetime: true,
      logoutLogin: true,
    } : {},
  };
  await writeFile(path.join(EVIDENCE_DIR, 'result.json'), `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function main() {
  validatePrerequisites();
  const identity = syntheticIdentity();
  const email = renderEmail(identity.emailIdentity);
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;

  stage = 'browser-start';
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await exactPublicRevision(context);
  console.log('GEKTA_EXACT_PUBLIC_REVISION=PASS');

  await anonymousQuotaAndHistory(page, identity);
  const mfaSecret = await registerAndActivate(page, identity, email, password);
  await proveAccountWorkspace(page, identity);
  await waitForOwnerGrants(page, identity);
  await exactPublicRevision(context);
  await logoutAndLogin(page, email, password, mfaSecret, identity);
  await exactPublicRevision(context);
  assertExactMain();

  stage = 'complete';
  await writeResult(true);
  console.log('GEKTA_FIRST_USER_ACCEPTANCE=PASS');
}

try {
  await main();
} catch (error) {
  const blocker = error instanceof AcceptanceFailure
    ? error.code
    : `GEKTA_${stage.toUpperCase().replace(/[^A-Z0-9]+/gu, '_')}_FAILED`;
  await writeResult(false, blocker).catch(() => undefined);
  console.log('GEKTA_FIRST_USER_ACCEPTANCE=FAIL');
  console.log(`GEKTA_ACCEPTANCE_STAGE=${stage.replace(/[^A-Za-z0-9._:-]/gu, '_')}`);
  console.log(`GEKTA_BLOCKER=${blocker}`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  for (const name of ['PC_P0_IMAP_PASSWORD', 'GEKTA_TARGET_EMAIL']) delete process.env[name];
}
