// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthProfile } from '@/lib/auth-profile-server';
import { getOrganizationTeam } from '@/lib/organization-team-server';
import { getVerifiedOwnerControlledCabinet } from '@/lib/platform-v7/owner-controlled-cabinet-server';
import { getLocale } from 'next-intl/server';
import { FirstCustomerWorkspace } from '@/components/platform-v7/FirstCustomerWorkspace';
import { getFirstCustomerWorkspace } from '@/lib/first-customer-workspace-server';

vi.mock('@/lib/auth-profile-server', () => ({ getAuthProfile: vi.fn() }));
vi.mock('@/lib/organization-team-server', () => ({ getOrganizationTeam: vi.fn() }));
vi.mock('@/lib/platform-v7/owner-controlled-cabinet-server', () => ({ getVerifiedOwnerControlledCabinet: vi.fn() }));
vi.mock('@/lib/server-api', () => ({
  serverApiUrl: (path: string) => `https://api.example.test${path}`,
  serverAuthHeaders: async () => ({ Authorization: 'Bearer test-session' }),
}));
vi.mock('next-intl/server', () => ({ getLocale: vi.fn() }));
vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return { default: ({ children, ...props }: import('react').ComponentProps<'a'>) => createElement('a', props, children) };
});
vi.mock('@pc/design-system-v8', async () => {
  const { createElement } = await import('react');
  return {
    InlineNotice: ({ title, children }: { title: string; children: import('react').ReactNode }) =>
      createElement('aside', null, createElement('strong', null, title), children),
    StatusChip: ({ children }: { children: import('react').ReactNode }) => createElement('span', null, children),
  };
});

const profile = {
  available: true, id: 'user-1', email: 'user@example.test', role: 'LOGISTICIAN',
  surfaceRole: 'logistics', orgId: 'org-1', tenantId: 'tenant-1', membershipId: 'member-1',
  isOrgAdmin: false, fullName: 'Пользователь', mfaVerified: true, mfaVerifiedAt: null,
};
const organization = {
  available: true, organizationId: 'org-1', tenantId: 'tenant-1', currentMembershipId: 'member-1',
  organizationName: 'Организация', currentRole: 'LOGISTICIAN', isOrganizationAdmin: false,
  hasFreshMfa: true, members: [],
};
const rows = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `shipment-${index}`, dealId: `deal-${index}`, status: 'BLOCKED', nextAction: null, blockers: null,
}));
function respond(payload: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
    status, headers: { 'x-correlation-id': 'queue-request-1' },
  })));
}

describe('authoritative first-customer workspace recovery', () => {
  beforeEach(() => {
    vi.mocked(getAuthProfile).mockResolvedValue(profile);
    vi.mocked(getOrganizationTeam).mockResolvedValue(organization);
    vi.mocked(getVerifiedOwnerControlledCabinet).mockResolvedValue(null);
    vi.mocked(getLocale).mockResolvedValue('ru');
  });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it.each([
    ['  Нужен документ\nприёмки  ', null, 'Нужен документ приёмки'],
    [['', '  Нужен анализ  ', 'Второй блокер'], null, 'Нужен анализ'],
    [null, null, null],
    ['   ', null, null],
    ['x'.repeat(501), null, null],
    [42, null, null],
    ['Нужен документ', '  Проверить акт  ', 'Проверить акт'],
    [['Нужен документ'], 'Проверить акт', 'Проверить акт'],
    [[{}, false, 'Действующий блокер'], '  ', 'Действующий блокер'],
  ])('preserves bounded authoritative action/blocker precedence (%j)', async (blockers, nextAction, expected) => {
    respond([{ ...rows(1)[0], blockers, nextAction }]);
    const result = await getFirstCustomerWorkspace('logistics');
    expect(result.available).toBe(true);
    expect(result.items[0].nextAction).toBe(expected);
    expect(result.items[0].href).toBe('/platform-v7/deals/deal-0/execution');
  });

  it.each([100, 101, 500])('accepts all %i valid shipment rows without slicing', async (count) => {
    respond(rows(count));
    const result = await getFirstCustomerWorkspace('logistics');
    expect(result.available).toBe(true);
    expect(result.items).toHaveLength(count);
    expect(result.items.at(-1)?.id).toBe(`shipment-${count - 1}`);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://api.example.test/logistics/shipments', {
      cache: 'no-store', headers: { Authorization: 'Bearer test-session' },
    });
  });

  it.each([['driver', 'DRIVER'], ['elevator', 'ELEVATOR']] as const)('accepts the shared logistics contract for %s', async (surface, role) => {
    vi.mocked(getAuthProfile).mockResolvedValue({ ...profile, role });
    respond(rows(500));
    expect((await getFirstCustomerWorkspace(surface)).items).toHaveLength(500);
  });

  it.each([['seller', 'FARMER'], ['buyer', 'BUYER'], ['bank', 'ACCOUNTING'], ['lab', 'LAB'], ['surveyor', 'SURVEYOR']] as const)(
    'does not expand the separate %s endpoint limit', async (surface, role) => {
      vi.mocked(getAuthProfile).mockResolvedValue({ ...profile, role });
      respond(rows(101));
      expect(await getFirstCustomerWorkspace(surface)).toMatchObject({ available: false, forbidden: false, items: [] });
    },
  );

  it.each([rows(501), [...rows(100), { id: 'bad' }], { items: rows(1) }])('fails closed on oversized or malformed queues', async (payload) => {
    respond(payload);
    expect(await getFirstCustomerWorkspace('logistics')).toMatchObject({ available: false, forbidden: false, items: [] });
  });

  it.each([[403, true], [503, false]] as const)('preserves HTTP %i semantics and correlation', async (status, forbidden) => {
    respond({}, status);
    expect(await getFirstCustomerWorkspace('logistics')).toMatchObject({ available: false, forbidden, correlationId: 'queue-request-1', items: [] });
  });

  it('preserves transport failure and successful empty queue as different states', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    expect((await getFirstCustomerWorkspace('logistics')).available).toBe(false);
    respond([]);
    expect(await getFirstCustomerWorkspace('logistics')).toMatchObject({ available: true, forbidden: false, items: [] });
  });

  it('does not query another role or an unavailable identity', async () => {
    respond(rows(1));
    expect(await getFirstCustomerWorkspace('bank')).toMatchObject({ available: false, forbidden: true });
    vi.mocked(getAuthProfile).mockResolvedValue({ ...profile, available: false });
    expect(await getFirstCustomerWorkspace('logistics')).toMatchObject({ available: false, forbidden: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('escapes canonical deal navigation rather than taking an upstream URL', async () => {
    respond([{ ...rows(1)[0], dealId: 'deal/with?query', href: 'https://untrusted.example' }]);
    expect((await getFirstCustomerWorkspace('logistics')).items[0].href).toBe('/platform-v7/deals/deal%2Fwith%3Fquery/execution');
  });

  it.each([
    ['ru', 'Показана текущая выборка', 'Объект из текущей выборки'],
    ['en', 'Current selection shown', 'Item from the current selection'],
    ['zh', '显示当前列表', '当前列表中的项目'],
  ])('renders bounded-window semantics in %s without asserting global priority', async (locale, notice, heading) => {
    vi.mocked(getLocale).mockResolvedValue(locale);
    respond([{ ...rows(1)[0], blockers: '<script>untrusted</script>' }]);
    const html = renderToStaticMarkup(await FirstCustomerWorkspace({ surface: 'logistics' }));
    expect(html).toContain(notice);
    expect(html).toContain(heading);
    expect(html).toContain('&lt;script&gt;untrusted&lt;/script&gt;');
    expect(html).not.toContain('<script>untrusted');
  });

  it.each([200, 403, 503])('does not show a loaded-window notice for empty/error HTTP %i', async (status) => {
    respond([], status);
    const html = renderToStaticMarkup(await FirstCustomerWorkspace({ surface: 'logistics' }));
    expect(html).not.toContain('Показана текущая выборка');
  });

  it('preserves owner-controlled navigation without customer queue access', async () => {
    vi.mocked(getVerifiedOwnerControlledCabinet).mockResolvedValue({
      role: 'logistics', apiRole: 'LOGISTICIAN', ownerId: 'owner-1', ownerEmail: 'owner@example.test',
      organizationId: 'controlled-org', organizationName: 'Controlled', tenantId: 'controlled-tenant',
    });
    respond(rows(500));
    const result = await getFirstCustomerWorkspace('logistics');
    expect(result).toMatchObject({ available: true, ownerControlled: true });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].href).toBe('/platform-v7/logistics');
    const html = renderToStaticMarkup(await FirstCustomerWorkspace({ surface: 'logistics' }));
    expect(html).not.toContain('Показана текущая выборка');
    expect(fetch).not.toHaveBeenCalled();
    expect(getAuthProfile).not.toHaveBeenCalled();
    expect(getOrganizationTeam).not.toHaveBeenCalled();
  });
});
