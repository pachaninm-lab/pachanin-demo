import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { admit, extractReports, normaliseReport } from '../../app/api/csp-report/route';

/**
 * ASVS 5.0 V3.4.7 (адрес отчётов CSP), V3.4.8 (Cross-Origin-Opener-Policy) и
 * парная к ней Cross-Origin-Resource-Policy. До этого изменения ни один ответ
 * не нёс ни одного из трёх: поиск по apps/web давал ноль совпадений.
 */

const MIDDLEWARE = '../../middleware';

async function headersFor(path: string): Promise<Headers> {
  const { middleware } = await import(MIDDLEWARE);
  const request = new NextRequest(`https://example.invalid${path}`);
  const response = await middleware(request as never);
  return response.headers as Headers;
}

describe('заголовки кросс-доменной изоляции', () => {
  it('ответ несёт Cross-Origin-Opener-Policy: same-origin', async () => {
    expect((await headersFor('/')).get('cross-origin-opener-policy')).toBe('same-origin');
  });

  it('ответ несёт Cross-Origin-Resource-Policy: same-origin', async () => {
    expect((await headersFor('/')).get('cross-origin-resource-policy')).toBe('same-origin');
  });

  it('CSP называет адрес отчётов обоими механизмами', async () => {
    const csp = (await headersFor('/')).get('content-security-policy') ?? '';
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('report-to csp-endpoint');
  });

  it('адресат report-to объявлен заголовком Reporting-Endpoints', async () => {
    expect((await headersFor('/')).get('reporting-endpoints')).toBe('csp-endpoint="/api/csp-report"');
  });

  it('прежние заголовки не потеряны', async () => {
    const headers = await headersFor('/');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });
});

describe('достижимость точки приёма', () => {
  it('POST /api/csp-report не перехватывается middleware', async () => {
    // Без этого вся конструкция декоративна: политика называет адрес, на
    // который браузер получал бы редирект на форму входа.
    const { middleware } = await import(MIDDLEWARE);
    const request = new NextRequest('https://example.invalid/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: '{}',
    });
    const response = await middleware(request as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('разбор отчёта CSP', () => {
  it('читает формат report-uri', () => {
    const report = normaliseReport({
      'csp-report': {
        'effective-directive': 'script-src',
        'blocked-uri': 'https://evil.invalid/x.js',
        'document-uri': 'https://example.invalid/page',
        disposition: 'enforce',
      },
    });
    expect(report).toEqual({
      directive: 'script-src',
      blocked: 'https://evil.invalid/x.js',
      document: 'https://example.invalid/page',
      disposition: 'enforce',
    });
  });

  it('читает формат report-to', () => {
    const report = normaliseReport({
      body: { effectiveDirective: 'img-src', blockedURL: 'data:', documentURL: 'https://example.invalid/' },
    });
    expect(report?.directive).toBe('img-src');
    expect(report?.blocked).toBe('data:');
  });

  it('вырезает управляющие символы, чтобы отправитель не дописывал строки в лог', () => {
    const report = normaliseReport({
      'csp-report': { 'effective-directive': 'script-src\n[csp-report] directive=подделка' },
    });
    expect(report?.directive).not.toContain('\n');
    expect(report?.directive).toBe('script-src [csp-report] directive=подделка');
  });

  it('обрезает длинное поле', () => {
    const report = normaliseReport({ 'csp-report': { 'blocked-uri': 'x'.repeat(5000) } });
    expect(report?.blocked.length).toBe(256);
  });

  it('отвергает то, что отчётом не является', () => {
    expect(normaliseReport(null)).toBeNull();
    expect(normaliseReport('строка')).toBeNull();
    expect(normaliseReport({ 'csp-report': { unrelated: 1 } })).toBeNull();
  });

  it('берёт не более 16 отчётов из пачки', () => {
    const many = Array.from({ length: 40 }, () => ({ body: { effectiveDirective: 'script-src' } }));
    expect(extractReports(many)).toHaveLength(16);
  });
});

describe('бюджет окна', () => {
  it('пропускает до предела и отбрасывает сверх него', () => {
    const window = { startedAt: 0, accepted: 0, dropped: 0 };
    const now = 1_000_000;
    let admitted = 0;
    for (let i = 0; i < 200; i += 1) if (admit(now, window)) admitted += 1;
    expect(admitted).toBe(120);
    expect(window.dropped).toBe(80);
  });

  it('новое окно открывает бюджет заново и сообщает об отброшенных', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const window = { startedAt: 0, accepted: 0, dropped: 0 };
    for (let i = 0; i < 200; i += 1) admit(1_000_000, window);
    expect(admit(1_000_000 + 60_000, window)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('отброшено 80'));
    warn.mockRestore();
  });
});
