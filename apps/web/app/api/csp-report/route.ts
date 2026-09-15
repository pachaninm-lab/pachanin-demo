import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ASVS V3.4.7. The served Content-Security-Policy names this route, so that a
// violation - including one caused by the unsafe-inline/unsafe-eval gap
// recorded under V3.4.3 - leaves a trace somewhere the operator controls
// instead of being silently blocked or allowed in the visitor's browser.
//
// The endpoint is unauthenticated because it has to be: a browser posts a
// violation report without credentials, and a report that arrives after the
// session has gone is exactly the kind worth having. That makes every byte
// here attacker-chosen, so the handler does the least it can - bounded read,
// bounded parse, bounded log, no storage, no echo.

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_LENGTH = 512;

// Browsers send application/csp-report for report-uri and
// application/reports+json for report-to. Anything else is not a report.
const REPORT_CONTENT_TYPES = ['application/csp-report', 'application/reports+json', 'application/json'];

/**
 * A report is written to the log, so a value carrying a newline could forge a
 * second log line, and a very long one could push the real entry out of view.
 * Control characters go, and the rest is cut to a fixed length.
 */
export function safeReportField(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').trim();
  if (cleaned.length === 0) return null;
  return cleaned.length > MAX_FIELD_LENGTH ? `${cleaned.slice(0, MAX_FIELD_LENGTH)}…` : cleaned;
}

/**
 * Reads the handful of fields that say what was blocked and where, from either
 * report shape, and nothing else. The rest of the payload is discarded rather
 * than logged: it is attacker-chosen and none of it is needed to act on the
 * report.
 */
export function normaliseCspReport(payload: unknown): Record<string, string> | null {
  if (payload === null || typeof payload !== 'object') return null;

  // report-uri sends { "csp-report": {...} }; report-to sends
  // [{ "type": "csp-violation", "body": {...} }].
  const candidates: unknown[] = Array.isArray(payload)
    ? payload.filter((entry) => (entry as { type?: unknown })?.type === 'csp-violation').map((entry) => (entry as { body?: unknown }).body)
    : [(payload as { 'csp-report'?: unknown })['csp-report'] ?? payload];

  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== 'object') continue;
    const source = candidate as Record<string, unknown>;
    const report: Record<string, string> = {};
    const take = (to: string, ...from: string[]) => {
      for (const key of from) {
        const value = safeReportField(source[key]);
        if (value !== null) { report[to] = value; return; }
      }
    };
    take('directive', 'effective-directive', 'effectiveDirective', 'violated-directive', 'violatedDirective');
    take('blocked', 'blocked-uri', 'blockedURL', 'blockedURI');
    take('document', 'document-uri', 'documentURL', 'documentURI');
    take('disposition', 'disposition');
    if (Object.keys(report).length > 0) return report;
  }
  return null;
}

function noContent(): NextResponse {
  // Nothing is echoed back: the response tells a prober nothing about whether
  // the payload parsed.
  return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!REPORT_CONTENT_TYPES.includes(contentType)) return noContent();

  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return noContent();

  let body: string;
  try {
    body = await request.text();
  } catch {
    return noContent();
  }
  // content-length is a claim; the body is the fact.
  if (body.length > MAX_BODY_BYTES) return noContent();

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return noContent();
  }

  const report = normaliseCspReport(payload);
  if (report !== null) {
    console.warn(`csp-violation ${JSON.stringify(report)}`);
  }
  return noContent();
}
