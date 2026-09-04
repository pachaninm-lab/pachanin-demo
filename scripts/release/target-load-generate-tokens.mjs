import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const secret = process.env.JWT_SECRET;
const output = process.env.TOKENS_PATH;
const sessionCount = Number(process.env.SESSION_COUNT || 5000);
const buyerCount = Number(process.env.BUYER_COUNT || 2500);
const isolatedCount = Number(process.env.ISOLATED_COUNT || 10);

if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
if (!output) throw new Error('TOKENS_PATH is required');
if (!Number.isInteger(sessionCount) || sessionCount < 5000) throw new Error('SESSION_COUNT must be >= 5000');
if (!Number.isInteger(buyerCount) || buyerCount < 1 || buyerCount >= sessionCount) throw new Error('BUYER_COUNT invalid');
if (!Number.isInteger(isolatedCount) || isolatedCount < 1 || isolatedCount >= sessionCount - buyerCount) throw new Error('ISOLATED_COUNT invalid');

const base64url = (value) => Buffer.from(value).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const expires = now + 4 * 60 * 60;

function tokenFor(index) {
  const padded = String(index).padStart(6, '0');
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    typ: 'access',
    sub: `user-load-${padded}`,
    sid: `session-load-${padded}`,
    cv: 1,
    iss: 'transparent-price-api',
    aud: 'transparent-price-platform',
    iat: now,
    exp: expires,
    jti: `load-access-${padded}-${now}`,
  }));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const all = [];
const buyers = [];
const compliance = [];
const isolated = [];
const isolatedStart = sessionCount - isolatedCount + 1;

for (let index = 1; index <= sessionCount; index += 1) {
  const token = tokenFor(index);
  all.push(token);
  if (index <= buyerCount) buyers.push(token);
  else if (index >= isolatedStart) isolated.push(token);
  else compliance.push(token);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  expiresAt: new Date(expires * 1000).toISOString(),
  sessionCount,
  buyerCount,
  complianceCount: compliance.length,
  isolatedCount,
  all,
  buyers,
  compliance,
  isolated,
}, null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({ output, sessionCount, buyerCount, complianceCount: compliance.length, isolatedCount }));
