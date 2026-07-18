#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import process from 'node:process';

const output = process.argv[2];
if (!output) throw new Error('Usage: build-target-load-tokens.mjs <output.json>');

const secret = String(process.env.JWT_SECRET ?? '').trim();
if (secret.length < 32) throw new Error('JWT_SECRET with at least 32 characters is required');

const buyerCount = positiveInteger('TARGET_LOAD_BUYER_SESSIONS', 5_000);
const complianceCount = positiveInteger('TARGET_LOAD_COMPLIANCE_SESSIONS', 100);
const dealCount = positiveInteger('TARGET_LOAD_DEALS', 50_000);
const tokenTtlSeconds = positiveInteger('TARGET_LOAD_TOKEN_TTL_SECONDS', 6 * 60 * 60);

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function padded(value, width = 5) {
  return String(value).padStart(width, '0');
}

function sign(userId, sessionId) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    typ: 'access',
    sid: sessionId,
    cv: 1,
    sub: userId,
    iss: 'transparent-price-api',
    aud: 'transparent-price-platform',
    iat: issuedAt,
    exp: issuedAt + tokenTtlSeconds,
    jti: `load-jti-${sessionId}`,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

function base64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

const buyers = Array.from({ length: buyerCount }, (_, offset) => {
  const index = offset + 1;
  const suffix = padded(index);
  const userId = `load-buyer-user-${suffix}`;
  const sessionId = `load-buyer-session-${suffix}`;
  return {
    index,
    userId,
    sessionId,
    organizationId: `load-buyer-org-${suffix}`,
    token: sign(userId, sessionId),
  };
});

const compliance = Array.from({ length: complianceCount }, (_, offset) => {
  const index = offset + 1;
  const suffix = padded(index, 3);
  const userId = `load-compliance-user-${suffix}`;
  const sessionId = `load-compliance-session-${suffix}`;
  return {
    index,
    userId,
    sessionId,
    organizationId: 'load-compliance-org',
    token: sign(userId, sessionId),
  };
});

const farmerUserId = 'load-farmer-user-001';
const farmerSessionId = 'load-farmer-session-001';
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  buyerCount,
  complianceCount,
  dealCount,
  buyers,
  compliance,
  farmer: {
    userId: farmerUserId,
    sessionId: farmerSessionId,
    organizationId: 'load-seller-org',
    token: sign(farmerUserId, farmerSessionId),
  },
};

await writeFile(output, `${JSON.stringify(result)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ output, buyerCount, complianceCount, dealCount })}\n`);
