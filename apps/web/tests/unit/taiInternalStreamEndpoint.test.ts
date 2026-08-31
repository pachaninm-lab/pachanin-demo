import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  INTERNAL_STREAM_PATH,
  SIGNATURE_VERSION,
  canonicalJson,
  resolveInternalStreamEndpoint,
  signInternalStreamRequest,
} from '@/lib/platform-v7/tai-internal-stream';

/**
 * The address the relay calls and the path it signs must describe one operation.
 *
 * They did not. The routes built a URL for the buffered `public-generate`
 * endpoint while the signer had moved to `public-generate-stream`, so every
 * production request arrived at the buffered controller carrying a signature
 * over a different canonical path. Verification failed in milliseconds and the
 * relay reported a generic `UPSTREAM_ERROR` — indistinguishable from a dead
 * model, which is why it read as a Qwen fault for two investigation rounds.
 *
 * These tests pin the two together, and one of them reproduces the exact
 * mismatch to prove the suite would have caught it.
 */

const ROOT = path.resolve(__dirname, '../../../..');
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

const BUFFERED_PATH = '/internal/tai/public-generate';
const SECRET = 's'.repeat(48);

/** The API's verification, reimplemented exactly as the controller performs it. */
function apiVerifies(signedPath: string, body: string, timestamp: string, signature: string): boolean {
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const expected = createHmac('sha256', SECRET)
    .update([SIGNATURE_VERSION, 'POST', signedPath, timestamp, bodyHash].join('\n'), 'utf8')
    .digest('hex');
  return expected === signature;
}

describe('internal stream endpoint resolution', () => {
  it('preserves the production base path prefix', () => {
    expect(resolveInternalStreamEndpoint(new URL('http://api:3001/api/')).href)
      .toBe('http://api:3001/api/internal/tai/public-generate-stream');
  });

  it('does not discard the prefix the way an absolute path would', () => {
    // The bug this guards: `new URL('/internal/...', base)` resolves against the
    // origin and silently drops `/api`.
    const naive = new URL(INTERNAL_STREAM_PATH, new URL('http://api:3001/api/')).href;
    expect(naive).toBe('http://api:3001/internal/tai/public-generate-stream');
    expect(resolveInternalStreamEndpoint(new URL('http://api:3001/api/')).href).not.toBe(naive);
  });

  it('resolves against a bare origin too', () => {
    expect(resolveInternalStreamEndpoint(new URL('http://api:3001/')).href)
      .toBe('http://api:3001/internal/tai/public-generate-stream');
  });

  it('addresses the same operation it signs', () => {
    const endpoint = resolveInternalStreamEndpoint(new URL('http://api:3001/api/'));

    expect(endpoint.pathname.endsWith(INTERNAL_STREAM_PATH)).toBe(true);
    expect(endpoint.pathname.endsWith(BUFFERED_PATH)).toBe(false);
  });
});

describe('signature agreement between transport and canonical path', () => {
  const body = canonicalJson({ question: 'Что влияет на цену зерна?', locale: 'ru' });
  const signed = signInternalStreamRequest(SECRET, body, 1_700_000_000);

  it('is accepted by the streaming controller', () => {
    expect(apiVerifies(INTERNAL_STREAM_PATH, body, signed.timestamp, signed.signature)).toBe(true);
  });

  it('is rejected by the buffered controller — the exact production defect', () => {
    // This is what production did: stream-signed request delivered to the
    // buffered endpoint. The API refuses it, the relay turns the non-2xx into
    // UPSTREAM_ERROR, and no token frame is ever emitted.
    expect(apiVerifies(BUFFERED_PATH, body, signed.timestamp, signed.signature)).toBe(false);
  });
});

describe('active streaming routes address the streaming endpoint', () => {
  const routes = [
    'apps/web/app/api/agro-chat/route.ts',
    'apps/web/app/api/restricted-public-platform-assistant/route.ts',
  ] as const;

  it.each(routes)('%s derives its endpoint from the signed path', (route) => {
    const source = read(route);

    expect(source).toContain('resolveInternalStreamEndpoint(base)');
    // The literal that caused the outage must not come back.
    expect(source).not.toContain("new URL('internal/tai/public-generate', base)");
    expect(source).not.toContain("new URL('/internal/tai/public-generate', base)");
  });

  it.each(routes)('%s keeps no stale buffered path constant', (route) => {
    const source = read(route);

    expect(source).not.toMatch(/const INTERNAL_PATH\s*=/u);
  });

  it('leaves the buffered API contract untouched', () => {
    const controller = read('apps/api/src/modules/ai-insights/restricted-public-qwen.controller.ts');

    expect(controller).toContain("const INTERNAL_PATH = '/internal/tai/public-generate';");
    expect(controller).toContain("export const INTERNAL_STREAM_PATH = '/internal/tai/public-generate-stream';");
    // Verification must still be path-bound; a shared or defaulted path would
    // make the two endpoints interchangeable and hide this class of bug.
    expect(controller).toContain("const signed = [SIGNATURE_VERSION, 'POST', path, timestampText, bodyHash].join('\\n');");
  });
});
