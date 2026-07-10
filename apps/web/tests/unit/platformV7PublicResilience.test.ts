import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function catalog(locale: string) {
  return JSON.parse(read(`apps/web/messages/public-resilience/${locale}.json`)) as Record<string, unknown>;
}

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('platform-v7 public auth resilience', () => {
  const request = read('apps/web/lib/client/public-request.ts');
  const login = read('apps/web/app/(platform-public)/platform-v7/login/page.tsx');
  const forgot = read('apps/web/app/(platform-public)/platform-v7/forgot-password/page.tsx');
  const reset = read('apps/web/app/(platform-public)/platform-v7/reset-password/page.tsx');
  const i18n = read('apps/web/i18n/request.ts');

  it('keeps resilient RU, EN and ZH catalogs structurally identical and non-empty', () => {
    const baseline = leafKeys(catalog('ru'));
    for (const locale of ['ru', 'en', 'zh']) {
      const value = catalog(locale);
      expect(leafKeys(value)).toEqual(baseline);
      for (const key of baseline) {
        const leaf = key.split('.').reduce<unknown>((node, part) => {
          if (!node || typeof node !== 'object') return undefined;
          return (node as Record<string, unknown>)[part];
        }, value);
        expect(String(leaf || '').trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('uses one bounded same-origin JSON request implementation', () => {
    expect(request).toContain('new AbortController()');
    expect(request).toContain("controller.abort('timeout')");
    expect(request).toContain("throw new Error('REQUEST_TIMEOUT')");
    expect(request).toContain('navigator.onLine === false');
    expect(request).toContain("throw new Error('NETWORK_OFFLINE')");
    expect(request).toContain("throw new Error('NETWORK_ERROR')");
    expect(request).toContain("credentials: 'same-origin'");

    for (const source of [login, forgot, reset]) {
      expect(source).toContain("from '@/lib/client/public-request'");
      expect(source).toContain('postPublicJson<');
      expect(source).not.toContain("await fetch('/api/auth");
    }
  });

  it('distinguishes timeout, offline, network and service failures', () => {
    for (const code of ['REQUEST_TIMEOUT', 'NETWORK_OFFLINE', 'NETWORK_ERROR']) {
      expect(login).toContain(code);
    }
    expect(login).toContain('AUTH_SERVICE_UNAVAILABLE');
    expect(login).toContain("t('serviceUnavailable')");
    expect(login).toContain("t('mfaUnavailable')");
    expect(forgot).toContain("loginT('timeout')");
    expect(reset).toContain("loginT('offline')");
  });

  it('moves focus to the first invalid control and uses the alert for service failures', () => {
    expect(login).toContain("showError(t('invalidEmail'), 'email')");
    expect(login).toContain("showError(t('passwordRequired'), 'password')");
    expect(login).toContain("showError(t('mfaInvalid'), 'mfa')");
    expect(login).toContain("showError(requestErrorMessage(code), 'alert')");
    expect(forgot).toContain("setFocusTarget('email')");
    expect(forgot).toContain("setFocusTarget('alert')");
    expect(reset).toContain("showError(t('passwordPolicyError'), 'password')");
    expect(reset).toContain("showError(t('passwordMismatch'), 'confirm')");
  });

  it('deep-merges resilient login keys instead of replacing the base catalog', () => {
    expect(i18n).toContain('../messages/public-resilience/${locale}.json');
    expect(i18n).toContain('...publicEntryMessages.publicEntry.login');
    expect(i18n).toContain('...publicResilienceMessages.publicEntry.login');
  });
});
