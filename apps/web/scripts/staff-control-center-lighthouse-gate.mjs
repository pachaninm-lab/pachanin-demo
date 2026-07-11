import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = process.env.STAFF_EVIDENCE_BASE_URL || 'https://127.0.0.1:3443';
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-control-center-acceptance-tls');
const reportPath = path.join(artifactDir, 'lighthouse-staff-control-center.json');
const summaryPath = path.join(artifactDir, 'lighthouse-summary.json');
const chromeLogPath = path.join(artifactDir, 'lighthouse-chrome.log');
const lighthouseBin = process.env.LIGHTHOUSE_BIN || '/tmp/staff-lighthouse-tools/node_modules/.bin/lighthouse';
const debuggingPort = 9222;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-lighthouse-'));
fs.mkdirSync(artifactDir, { recursive: true });

if (!fs.existsSync(lighthouseBin)) throw new Error(`Lighthouse binary missing: ${lighthouseBin}`);

const baseCookies = {
  pc_access_token: 'evidence-access-token',
  pc_csrf_token: 'evidence-csrf-token',
  pc_session_present: JSON.stringify({ role: 'operator', exp: 4102444800 }),
};
const baseCookieHeader = Object.entries(baseCookies).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');

async function post(pathname, body, cookieHeader) {
  return fetch(base + pathname, {
    method: 'POST',
    headers: {
      Origin: base,
      Referer: `${base}/platform-v7/staff`,
      'Content-Type': 'application/json',
      'x-csrf-token': baseCookies.pc_csrf_token,
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

function parseSetCookies(headers) {
  const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') || ''];
  const result = {};
  for (const value of values.flatMap((entry) => entry.split(/,(?=\s*pc_staff_)/))) {
    const pair = value.trim().split(';')[0];
    const index = pair.indexOf('=');
    if (index > 0) result[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return result;
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Chrome DevTools endpoint did not start');
}

async function cdpCommand(webSocketDebuggerUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const id = 1;
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`CDP command timed out: ${method}`));
    }, 10_000);
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('message', (event) => {
      let payload;
      try { payload = JSON.parse(String(event.data)); } catch { return; }
      if (payload.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (payload.error) reject(new Error(`CDP ${method} failed: ${payload.error.message}`));
      else resolve(payload.result || {});
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`CDP socket failed: ${method}`));
    });
  });
}

const request = await post('/api/staff/access/requests', {
  assignmentId: 'sta-owner',
  accessMode: 'CONTROL_PLANE',
  permissions: [
    'organization:list','user:list','staff-assignment:read','staff-assignment:write',
    'staff-request:read','staff-request:approve','staff-session:read','staff-session:revoke',
    'audit:read','support-case:read','support-case:update','user:session:revoke',
    'user:access-recovery:initiate','deal:list','deal:read','deal:blocker:read',
    'payment:metadata:read','payment:reconciliation:read','diagnostic:read','deployment:read',
    'feature-flag:read','critical-action:approve','break-glass:activate',
  ],
  reason: 'Authenticated mobile Lighthouse acceptance session',
  ticketId: 'LH-2353',
  durationSeconds: 900,
}, baseCookieHeader);
if (!request.ok) throw new Error(`Lighthouse request ${request.status}: ${await request.text()}`);
const grant = await request.json();
const activation = await post(`/api/staff/access/grants/${encodeURIComponent(grant.grantId)}/activate`, {}, baseCookieHeader);
if (!activation.ok) throw new Error(`Lighthouse activation ${activation.status}: ${await activation.text()}`);
const staffCookies = parseSetCookies(activation.headers);
if (!staffCookies.pc_staff_access_token || !staffCookies.pc_staff_access_meta) throw new Error('Staff cookies missing from activation response');

const chromeLog = fs.openSync(chromeLogPath, 'w');
const chrome = spawn(chromium.executablePath(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--ignore-certificate-errors',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: ['ignore', chromeLog, chromeLog], detached: false });

try {
  const version = await waitForChrome();
  const webSocketDebuggerUrl = version.webSocketDebuggerUrl;
  if (!webSocketDebuggerUrl) throw new Error('Chrome DevTools websocket URL missing');
  const expires = 4102444800;
  await cdpCommand(webSocketDebuggerUrl, 'Storage.setCookies', {
    cookies: [
      { name: 'pc_access_token', value: baseCookies.pc_access_token, domain: '127.0.0.1', path: '/', secure: true, httpOnly: true, sameSite: 'Lax', expires },
      { name: 'pc_csrf_token', value: baseCookies.pc_csrf_token, domain: '127.0.0.1', path: '/', secure: true, httpOnly: false, sameSite: 'Lax', expires },
      { name: 'pc_session_present', value: baseCookies.pc_session_present, domain: '127.0.0.1', path: '/', secure: true, httpOnly: false, sameSite: 'Lax', expires },
      { name: 'pc_staff_access_token', value: staffCookies.pc_staff_access_token, domain: '127.0.0.1', path: '/api/staff', secure: true, httpOnly: true, sameSite: 'Strict', expires },
      { name: 'pc_staff_access_meta', value: staffCookies.pc_staff_access_meta, domain: '127.0.0.1', path: '/api/staff', secure: true, httpOnly: true, sameSite: 'Strict', expires },
    ],
  });
  const stored = await cdpCommand(webSocketDebuggerUrl, 'Storage.getCookies');
  const names = new Set((stored.cookies || []).map((cookie) => cookie.name));
  for (const name of ['pc_access_token', 'pc_staff_access_token', 'pc_staff_access_meta']) {
    if (!names.has(name)) throw new Error(`Chrome cookie store missing ${name}`);
  }

  const lighthouse = spawnSync(lighthouseBin, [
    `${base}/platform-v7/staff?lang=ru`,
    '--quiet',
    `--port=${debuggingPort}`,
    '--disable-storage-reset',
    '--only-categories=performance,accessibility,best-practices',
    '--form-factor=mobile',
    '--screenEmulation.mobile=true',
    '--throttling-method=simulate',
    '--output=json',
    `--output-path=${reportPath}`,
  ], { encoding: 'utf8', env: process.env, timeout: 180_000 });
  fs.writeFileSync(path.join(artifactDir, 'lighthouse-cli.log'), `${lighthouse.stdout || ''}\n${lighthouse.stderr || ''}`);
  if (lighthouse.error) throw lighthouse.error;
  if (lighthouse.status !== 0) throw new Error(`Lighthouse CLI failed with status ${lighthouse.status}`);

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const score = (name) => Math.round((report.categories[name]?.score || 0) * 100);
  const result = {
    finalUrl: report.finalUrl,
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    lcp: report.audits['largest-contentful-paint']?.numericValue ?? Infinity,
    tbt: report.audits['total-blocking-time']?.numericValue ?? Infinity,
    cls: report.audits['cumulative-layout-shift']?.numericValue ?? Infinity,
    consoleErrors: report.audits['errors-in-console']?.details?.items?.length || 0,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (
    !String(result.finalUrl || '').includes('/platform-v7/staff')
    || result.performance < 80
    || result.accessibility < 95
    || result.bestPractices < 90
    || result.lcp > 3000
    || result.tbt > 250
    || result.cls > 0.1
    || result.consoleErrors > 0
  ) process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  fs.closeSync(chromeLog);
}
