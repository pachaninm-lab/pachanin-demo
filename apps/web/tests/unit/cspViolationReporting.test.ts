// @vitest-environment node
//
// ASVS V3.4.7. Two things have to hold together: the served policy has to name
// somewhere to send violations, and that somewhere has to be able to take what
// a browser posts. Testing only the first leaves a policy pointing at a route
// that throws; testing only the second leaves a working route nothing points at.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '../../middleware';
import { POST, normaliseCspReport, safeReportField } from '../../app/api/csp-report/route';

async function headersFor(url: string) {
  const response = await middleware(new NextRequest(new Request(url)));
  return response.headers;
}

const post = (body: string, contentType = 'application/csp-report') => POST(
  new Request('https://example.test/api/csp-report', { method: 'POST', headers: { 'content-type': contentType }, body }),
);

afterEach(() => { vi.restoreAllMocks(); });

describe('the served policy names where to report', () => {
  it('carries report-uri and report-to pointing at the route', async () => {
    const policy = (await headersFor('https://example.test/platform-v7')).get('content-security-policy') ?? '';
    expect(policy).toContain('report-uri /api/csp-report');
    expect(policy).toContain('report-to csp-endpoint');
  });

  it('declares the group that report-to refers to, or report-to names nothing', async () => {
    const headers = await headersFor('https://example.test/platform-v7');
    expect(headers.get('reporting-endpoints')).toBe('csp-endpoint="/api/csp-report"');
  });
});

describe('the route takes what a browser actually posts', () => {
  it('reads the report-uri shape', () => {
    expect(normaliseCspReport({
      'csp-report': {
        'document-uri': 'https://example.test/p',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'inline',
        disposition: 'enforce',
      },
    })).toEqual({
      directive: 'script-src-elem', blocked: 'inline', document: 'https://example.test/p', disposition: 'enforce',
    });
  });

  it('reads the report-to shape into the same fields', () => {
    expect(normaliseCspReport([
      { type: 'csp-violation', body: { documentURL: 'https://example.test/p', effectiveDirective: 'script-src-elem', blockedURL: 'inline', disposition: 'enforce' } },
    ])).toEqual({
      directive: 'script-src-elem', blocked: 'inline', document: 'https://example.test/p', disposition: 'enforce',
    });
  });

  it('ignores a payload that is not a report', () => {
    for (const payload of [null, 'text', 42, {}, [], [{ type: 'deprecation', body: { id: 'x' } }]]) {
      expect(normaliseCspReport(payload), JSON.stringify(payload)).toBeNull();
    }
  });
});

describe('every byte of a report is attacker-chosen', () => {
  it('cannot forge a second log line', () => {
    expect(safeReportField('evil\nFAKE ENTRY')).toBe('evil FAKE ENTRY');
    expect(safeReportField('a\r\nb\tc\u0000d')).toBe('a  b c d');
  });

  it('cannot push the real entry out of view', () => {
    const field = safeReportField('A'.repeat(5000)) ?? '';
    expect(field.length).toBeLessThanOrEqual(513);
    expect(field.endsWith('…')).toBe(true);
  });

  it('drops a body larger than the cap without logging it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await post(JSON.stringify({ 'csp-report': { 'blocked-uri': 'A'.repeat(40_000) } }));
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores a content type no browser sends for a report', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await post('{"csp-report":{"effective-directive":"img-src"}}', 'text/plain')).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores a body that is not JSON', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await post('not json at all')).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a genuine report, and answers every case the same way', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await post('{"csp-report":{"effective-directive":"img-src","blocked-uri":"https://evil.test/x"}}');
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('"directive":"img-src"');
  });
});
