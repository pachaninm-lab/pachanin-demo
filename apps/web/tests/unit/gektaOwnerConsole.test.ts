import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveBridgePath, safeSearch, upstreamUrl } from '@/lib/gekta/account-bridge';
import {
  buildSearchQuery,
  formatMetric,
  formatShare,
  phoneStateLabel,
  revocableGrants,
  visibleActions,
  type ConsoleAccount,
} from '@/lib/gekta/console-model';

const root = resolve(__dirname, '../..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

const OWNER = [
  'account.search',
  'account.read_metadata',
  'entitlement.grant_manual',
  'entitlement.grant_lifetime',
  'entitlement.revoke_manual',
  'entitlement.reset_quota',
  'entitlement.extend_trial',
  'account.suspend',
  'metrics.read_global',
  'audit.read',
];

const SUPPORT = ['account.search', 'account.read_metadata'];

const ACCOUNT: ConsoleAccount = {
  accountId: 'acc-1',
  userId: 'u-1',
  suspended: false,
  grants: [
    { id: 'g-1', kind: 'MANUAL', grantedAt: '2026-08-01T00:00:00.000Z', expiresAt: '2026-08-20T00:00:00.000Z', revokedAt: null, reason: '' },
    { id: 'g-2', kind: 'MANUAL', grantedAt: '2026-07-01T00:00:00.000Z', expiresAt: '2026-07-20T00:00:00.000Z', revokedAt: '2026-07-05T00:00:00.000Z', reason: '' },
  ],
};

describe('Gekta console shows only actions the role can actually perform', () => {
  it('gives support no way to hand out or take away access', () => {
    const visible = visibleActions(SUPPORT, ACCOUNT).map((action) => action.id);
    expect(visible).toEqual([]);
    expect(revocableGrants(SUPPORT, ACCOUNT)).toEqual([]);
  });

  it('gives the owner the full set of grant lengths', () => {
    const visible = visibleActions(OWNER, ACCOUNT).map((action) => action.id);
    expect(visible).toContain('DAYS_7');
    expect(visible).toContain('DAYS_30');
    expect(visible).toContain('UNTIL_DATE');
    expect(visible).toContain('LIFETIME');
  });

  it('offers suspension and its removal as mutually exclusive states', () => {
    const active = visibleActions(OWNER, ACCOUNT).map((action) => action.id);
    expect(active).toContain('SUSPEND');
    expect(active).not.toContain('UNSUSPEND');

    const suspended = visibleActions(OWNER, { ...ACCOUNT, suspended: true }).map((action) => action.id);
    expect(suspended).toContain('UNSUSPEND');
    expect(suspended).not.toContain('SUSPEND');
  });

  it('offers revocation only for grants that are still in force', () => {
    expect(revocableGrants(OWNER, ACCOUNT).map((grant) => grant.id)).toEqual(['g-1']);
    expect(revocableGrants(OWNER, null)).toEqual([]);
  });
});

describe('Gekta console reports numbers without inventing them', () => {
  it('shows a dash instead of a made-up zero', () => {
    expect(formatMetric(null)).toBe('—');
    expect(formatMetric(undefined)).toBe('—');
    expect(formatMetric(Number.NaN)).toBe('—');
    expect(formatMetric(0)).toBe('0');
  });

  it('leaves conversion empty until real payments exist', () => {
    expect(formatShare(null)).toBe('—');
    expect(formatShare(0.5)).toContain('50');
  });

  it('never calls a declared phone verified', () => {
    expect(phoneStateLabel('DECLARED')).not.toContain('подтверждён,');
    expect(phoneStateLabel('DECLARED')).toContain('не подтверждён');
    expect(phoneStateLabel('VERIFIED')).toBe('подтверждён');
    expect(phoneStateLabel(null)).toBe('не указан');
  });

  it('refuses an empty or oversized search value before calling the server', () => {
    expect(buildSearchQuery('email', '   ')).toBeNull();
    expect(buildSearchQuery('email', 'a'.repeat(321))).toBeNull();
    expect(buildSearchQuery('phone', '+7 916 277-89-89')).toBe('phone=%2B7%20916%20277-89-89');
  });
});

describe('Gekta account bridge keeps the token on approved routes only', () => {
  it('accepts the routes the API actually exposes', () => {
    expect(resolveBridgePath('account', ['entitlement'])).toBe('entitlement');
    expect(resolveBridgePath('account', ['conversations', 'c-1', 'messages'])).toBe('conversations/c-1/messages');
    expect(resolveBridgePath('operator', ['grants', 'g-1', 'revoke'])).toBe('grants/g-1/revoke');
    expect(resolveBridgePath('operator', ['accounts', 'a-1', 'grant-lifetime'])).toBe('accounts/a-1/grant-lifetime');
  });

  it('rejects traversal, unknown routes and cross-surface access', () => {
    expect(resolveBridgePath('account', ['..', 'auth', 'me'])).toBeNull();
    expect(resolveBridgePath('account', ['metrics'])).toBeNull();
    // Операторские маршруты не должны открываться через пользовательский мост.
    expect(resolveBridgePath('account', ['accounts', 'a-1', 'grant'])).toBeNull();
    expect(resolveBridgePath('operator', ['entitlement'])).toBeNull();
    expect(resolveBridgePath('account', [])).toBeNull();
    expect(resolveBridgePath('account', ['projects', 'p-1/../../secret'])).toBeNull();
  });

  it('forwards only the query parameters the API reads', () => {
    const input = new URLSearchParams({ search: 'пшеница', projectId: 'p-1', redirect: 'https://evil.example' });
    const forwarded = safeSearch('account', input);
    expect(forwarded).toContain('projectId=p-1');
    expect(forwarded).not.toContain('redirect');
  });

  it('reports the API as unavailable instead of guessing a host', () => {
    const previousApi = process.env.API_URL;
    const previousPublic = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(upstreamUrl('account', 'entitlement', '')).toBeNull();

    process.env.API_URL = 'https://api.example/';
    expect(upstreamUrl('operator', 'metrics', '')).toBe('https://api.example/gekta/operator/metrics');

    // Значение без схемы — конфигурационная ошибка, а не повод собрать относительный URL.
    process.env.API_URL = 'api.example';
    expect(upstreamUrl('account', 'entitlement', '')).toBeNull();

    if (previousApi === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApi;
    if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previousPublic;
  });
});

describe('Gekta console surfaces stay server-authoritative', () => {
  it('requires a session and rejects cross-site writes at the bridge', () => {
    const handler = read('lib/gekta/bridge-handler.ts');
    expect(handler).toContain('assertCsrf');
    expect(handler).toContain("fail('authentication_required', 401)");
    // Токен уходит только на настроенный API, иначе честный 503.
    expect(handler).toContain("fail('service_unavailable', 503)");
  });

  it('sends the CSRF token on every method the bridge treats as unsafe', () => {
    // DELETE тоже небезопасен: без токена удаление диалога вернуло бы 403.
    const client = read('lib/gekta/server-workspace.ts');
    expect(client).toContain("...(method === 'GET' ? {} : { 'x-csrf-token': csrfToken() })");
    expect(client).not.toContain("method === 'GET' || method === 'DELETE' ? {}");
  });

  it('keeps the owner console out of search engines', () => {
    const page = read('app/gekta/console/page.tsx');
    expect(page).toContain('index: false');
  });

  it('never decides permissions in the browser', () => {
    const console_ = read('components/gekta/GektaOwnerConsole.tsx');
    // Права приходят с сервера; клиент только прячет то, что всё равно запрещено.
    expect(console_).toContain("operatorApi<{ permissions: string[] }>('permissions')");
    expect(console_).not.toContain('GEKTA_OWNER');
  });

  it('records a reason for every access change', () => {
    const console_ = read('components/gekta/GektaOwnerConsole.tsx');
    expect(console_).toContain('она попадёт в неизменяемый журнал');
    expect(console_).toContain('requireReason()');
  });
});

describe('Gekta phone card stays honest about verification', () => {
  const card = read('components/gekta/GektaPhoneCard.tsx');

  it('hides itself when there is no account instead of failing on submit', () => {
    expect(card).toContain('if (!available) return null;');
  });

  it('never hardcodes a verification claim of its own', () => {
    // Статус телефона приходит из общей функции, а не из строки в компоненте.
    // Комментарии не считаются: в них слово встречается как раз в запрете.
    const code = card
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/u.test(line))
      .join('\n');
    expect(code).not.toContain('подтверждён');
    expect(card).toContain('phoneStateLabel');
  });

  it('says plainly when the phone storage is not configured', () => {
    expect(card).toContain('Хранилище телефонов не настроено');
  });
});

describe('Gekta history search states are visible in every language', () => {
  const sidebar = read('components/gekta/GektaSidebar.tsx');

  it('announces loading, failure and empty results', () => {
    expect(sidebar).toContain("role='status'");
    expect(sidebar).toContain("aria-live='polite'");
    expect(sidebar).toContain('ui.searching');
    expect(sidebar).toContain('ui.searchFailed');
    expect(sidebar).toContain('ui.searchEmpty');
  });

  it('translates every search state into RU, EN and ZH', () => {
    for (const key of ['searching', 'searchFailed', 'searchEmpty']) {
      // Три локали продукта: пропуск любой оставил бы состояние без текста.
      expect(sidebar.match(new RegExp(`${key}:`, 'gu'))?.length).toBe(3);
    }
  });
});
